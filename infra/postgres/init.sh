#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v identity_password="$IDENTITY_DB_PASSWORD" -v club_password="$CLUB_DB_PASSWORD" -v booking_password="$BOOKING_DB_PASSWORD" -v reporting_password="$REPORTING_DB_PASSWORD" <<'SQL'
CREATE USER identity WITH PASSWORD :'identity_password';
CREATE USER club WITH PASSWORD :'club_password';
CREATE USER booking WITH PASSWORD :'booking_password';
CREATE USER shift_report WITH PASSWORD :'reporting_password';
CREATE DATABASE shift_identity OWNER identity;
CREATE DATABASE shift_club OWNER club;
CREATE DATABASE shift_booking OWNER booking;
CREATE DATABASE shift_identity_test OWNER identity;
CREATE DATABASE shift_club_test OWNER club;
CREATE DATABASE shift_booking_test OWNER booking;
REVOKE CONNECT ON DATABASE shift_identity FROM PUBLIC;
REVOKE CONNECT ON DATABASE shift_club FROM PUBLIC;
REVOKE CONNECT ON DATABASE shift_booking FROM PUBLIC;
REVOKE CONNECT ON DATABASE shift_identity_test FROM PUBLIC;
REVOKE CONNECT ON DATABASE shift_club_test FROM PUBLIC;
REVOKE CONNECT ON DATABASE shift_booking_test FROM PUBLIC;
GRANT CONNECT ON DATABASE shift_identity TO identity;
GRANT CONNECT ON DATABASE shift_club TO club;
GRANT CONNECT ON DATABASE shift_booking TO booking;
GRANT CONNECT ON DATABASE shift_booking TO shift_report;
GRANT CONNECT ON DATABASE shift_identity_test TO identity;
GRANT CONNECT ON DATABASE shift_club_test TO club;
GRANT CONNECT ON DATABASE shift_booking_test TO booking;
SQL
