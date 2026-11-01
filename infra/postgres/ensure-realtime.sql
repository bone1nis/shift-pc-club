-- Аддитивно создаёт роль и базы realtime в уже работающем PostgreSQL (для чистой установки есть init.sh).
-- Ничего не удаляет и не трогает другие базы. Запуск: см. scripts/backend-init.sh.
SET log_statement = 'none';
SET log_min_error_statement = 'panic';
SELECT format('CREATE ROLE realtime LOGIN PASSWORD %L', :'realtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'realtime')
\gexec
ALTER ROLE realtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD :'realtime_password';
SELECT 'CREATE DATABASE shift_realtime OWNER realtime'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'shift_realtime')
\gexec
SELECT 'CREATE DATABASE shift_realtime_test OWNER realtime'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'shift_realtime_test')
\gexec
REVOKE CONNECT ON DATABASE shift_realtime FROM PUBLIC;
REVOKE CONNECT ON DATABASE shift_realtime_test FROM PUBLIC;
GRANT CONNECT ON DATABASE shift_realtime TO realtime;
GRANT CONNECT ON DATABASE shift_realtime_test TO realtime;
