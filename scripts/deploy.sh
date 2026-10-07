#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
operator_lock
dc config --quiet
if [[ ${BUILD_IMAGES:-1} == 1 ]]; then dc --profile tools build web worker operator; fi
# Migration failure deliberately leaves traffic stopped for operator investigation.
dc stop caddy web worker
wait_db
dc run --rm -T operator sh infra/migrate.sh
dc up -d --wait --wait-timeout 240 web worker caddy
dc up -d clamav
echo 'Release started. Run bash scripts/verify.sh. Scanner must be healthy before uploading.'
