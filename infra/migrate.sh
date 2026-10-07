#!/bin/sh
set -eu
export DB_PASSWORD_FILE=/run/secrets/db_owner_password
export DB_USER=society_owner
export DATABASE_URL="$(node -e 'const fs=require("fs");process.stdout.write("postgresql://society_owner:"+encodeURIComponent(fs.readFileSync(process.env.DB_PASSWORD_FILE,"utf8").trim())+"@postgres:5432/society")')"
exec node node_modules/prisma/build/index.js migrate deploy
