SET log_statement = 'none';
SET log_min_error_statement = 'panic';
SELECT format('CREATE ROLE shift_report LOGIN PASSWORD %L', :'reporting_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shift_report')
\gexec
ALTER ROLE shift_report LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD :'reporting_password';
GRANT CONNECT ON DATABASE shift_booking TO shift_report;
