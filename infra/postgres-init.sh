#!/bin/sh
set -eu
password=$(cat /run/secrets/db_app_password)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$password" <<'SQL'
CREATE USER society_app PASSWORD :'app_password';
GRANT CONNECT ON DATABASE society TO society_app;
GRANT USAGE ON SCHEMA public TO society_app;
ALTER DEFAULT PRIVILEGES FOR ROLE society_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO society_app;
ALTER DEFAULT PRIVILEGES FOR ROLE society_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO society_app;
SQL
