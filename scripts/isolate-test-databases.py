#!/usr/bin/env python3
"""Provision existing local test databases without migrating or deleting data."""
import hashlib
import hmac
import base64
import os
from pathlib import Path
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SERVICES = ('identity', 'club', 'booking')
SECRET_FILE = ROOT / '.runtime' / 'test-db.env'


def docker(args, sql=None, password=None, allow_failure=False):
    env = os.environ.copy()
    command = ['docker', 'compose', 'exec', '-T']
    if password is not None:
        env['PGPASSWORD'] = password
        command += ['-e', 'PGPASSWORD']
    result = subprocess.run(command + ['postgres'] + args, input=sql,
                            text=True, capture_output=True, cwd=ROOT, env=env)
    if result.returncode and not allow_failure:
        raise RuntimeError('PostgreSQL operation failed; output withheld to protect credentials.')
    return result


def admin(sql, database='postgres'):
    return docker(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                   '-U', 'postgres', '-d', database], sql).stdout.strip()


def verifier(password):
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 4096)
    stored = hashlib.sha256(hmac.digest(salted, b'Client Key', 'sha256')).digest()
    server = hmac.digest(salted, b'Server Key', 'sha256')
    encode = lambda value: base64.b64encode(value).decode()
    return f'SCRAM-SHA-256$4096:{encode(salt)}${encode(stored)}:{encode(server)}'


def main():
    if admin('SELECT rolsuper FROM pg_roles WHERE rolname=current_user;') != 't':
        raise RuntimeError('A PostgreSQL administrator is required.')
    existing = {}
    if SECRET_FILE.exists():
        if SECRET_FILE.stat().st_mode & 0o077:
            raise RuntimeError('Test password file must have mode 600.')
        existing = dict(line.split('=', 1) for line in SECRET_FILE.read_text().splitlines())
    passwords = {}
    for service in SERVICES:
        key = f'{service.upper()}_TEST_DB_PASSWORD'
        passwords[key] = os.environ.get(key) or existing.get(key) or secrets.token_hex(32)
        if len(passwords[key]) < 24 or not passwords[key].isalnum():
            raise RuntimeError('Use separate alphanumeric test passwords of at least 24 characters.')
        if admin(f"SELECT count(*) FROM pg_database WHERE datname='shift_{service}_test';") != '1':
            raise RuntimeError('Expected existing test database is missing; no database will be created.')
    if len(set(passwords.values())) != 3:
        raise RuntimeError('Test passwords must differ.')
    SECRET_FILE.parent.mkdir(mode=0o700, exist_ok=True)
    fd = os.open(SECRET_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(''.join(f'{key}={value}\n' for key, value in passwords.items()))

    demo_before = admin("SELECT datname, datdba, datacl FROM pg_database WHERE datname IN ('shift_identity','shift_club','shift_booking') ORDER BY datname;")
    for service in SERVICES:
        role = f'{service}_test'
        database = f'shift_{service}_test'
        password_hash = verifier(passwords[f'{service.upper()}_TEST_DB_PASSWORD'])
        admin(f"""
SET log_statement = 'none';
SET log_min_error_statement = 'panic';
BEGIN;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{role}') THEN
        CREATE ROLE {role};
    END IF;
    IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='{role}')) THEN
        RAISE EXCEPTION 'Test role must have no role memberships';
    END IF;
END $$;
ALTER ROLE {role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '{password_hash}';
ALTER DATABASE {database} OWNER TO {role};
REVOKE ALL ON DATABASE {database} FROM PUBLIC, {service};
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE {database} TO {role};
COMMIT;
""")
        # REASSIGN OWNED не используем: он может поменять владельца общих объектов базы.
        admin(f"""
BEGIN;
ALTER SCHEMA public OWNER TO {role};
REVOKE ALL ON SCHEMA public FROM PUBLIC, {service};
GRANT ALL ON SCHEMA public TO {role};
DO $$ DECLARE item record; BEGIN
    FOR item IN SELECT c.relname, c.relkind FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
        AND NOT (c.relkind='S' AND EXISTS (SELECT 1 FROM pg_depend d
            WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype IN ('a','i')))
    LOOP
        EXECUTE format('ALTER %s public.%I OWNER TO {role}',
            CASE item.relkind WHEN 'S' THEN 'SEQUENCE' WHEN 'v' THEN 'VIEW'
            WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'f' THEN 'FOREIGN TABLE' ELSE 'TABLE' END, item.relname);
    END LOOP;
END $$;
COMMIT;
""", database)

    hba_path = admin('SHOW hba_file;')
    hba = docker(['cat', hba_path]).stdout
    begin, end = '# PC Club test isolation begin', '# PC Club test isolation end'
    if begin in hba:
        prefix, rest = hba.split(begin, 1)
        _, suffix = rest.split(end, 1)
        hba = prefix + suffix.lstrip('\n')
    rules = [begin]
    for service in SERVICES:
        role, database = f'{service}_test', f'shift_{service}_test'
        rules += [f'local {database} {role} scram-sha-256',
                  f'local all {role} reject',
                  f'host {database} {role} all scram-sha-256',
                  f'host all {role} all reject']
    rules.append(end)
    docker(['sh', '-c', 'cat > "$1"', 'sh', hba_path], '\n'.join(rules) + '\n' + hba)
    if admin('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL;') != '0':
        docker(['sh', '-c', 'cat > "$1"', 'sh', hba_path], hba)
        raise RuntimeError('Invalid HBA rules; previous configuration restored.')
    if admin('SELECT pg_reload_conf();') != 't':
        raise RuntimeError('Unable to reload HBA configuration.')

    for service in SERVICES:
        role, database = f'{service}_test', f'shift_{service}_test'
        password = passwords[f'{service.upper()}_TEST_DB_PASSWORD']
        args = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-U', role]
        actual = docker(args + ['-d', database], 'SELECT current_database(), current_user;', password).stdout.strip()
        if actual != f'{database}|{role}':
            raise RuntimeError('Unexpected authenticated database or user.')
        for forbidden in ['shift_identity', 'shift_club', 'shift_booking', 'postgres'] + [f'shift_{s}_test' for s in SERVICES if s != service]:
            result = docker(args + ['-d', forbidden], 'SELECT 1;', password, allow_failure=True)
            if result.returncode == 0:
                raise RuntimeError('Test role can connect to a forbidden database.')
        print(f'{role}: authenticated to own test database; six other database connections denied.')
    if admin("SELECT datname, datdba, datacl FROM pg_database WHERE datname IN ('shift_identity','shift_club','shift_booking') ORDER BY datname;") != demo_before:
        raise RuntimeError('Demo database ownership or ACL changed unexpectedly.')
    print('Demo database owners/ACL unchanged. No migrations or tests executed. Passwords saved in .runtime/test-db.env (600).')


if __name__ == '__main__':
    main()
