#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
REPO_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$REPO_ROOT"
ENV_FILE=${ENV_FILE:-.env}
[[ -f "$ENV_FILE" ]] || { echo 'Copy .env.compose.example to .env first.' >&2; exit 1; }
set -a
source "$ENV_FILE"
set +a
DATA_ROOT=$(realpath -m -- "${DATA_ROOT:-./data}")
BACKUP_ROOT=$(realpath -m -- "${BACKUP_ROOT:-./backups}")
SECRETS_DIR=$(realpath -m -- "${SECRETS_DIR:-./secrets}")
export DATA_ROOT BACKUP_ROOT SECRETS_DIR
DC=(docker compose --env-file "$ENV_FILE" -f compose.yaml)
if [[ ${DEPLOYMENT_MODE:-local} == public ]]; then DC+=(-f compose.production.yaml); fi
dc() { "${DC[@]}" "$@"; }
operator_lock() {
  mkdir -p "$DATA_ROOT"
  exec 9>"$DATA_ROOT/operator.lock"
  flock -n 9 || { echo 'Another deployment/backup/restore is running.' >&2; exit 1; }
}
wait_db() { dc up -d --wait postgres redis; }
db_counts() {
  dc exec -T postgres psql -U society_owner -d society -At -v ON_ERROR_STOP=1 -c 'SELECT json_build_object('\''societies'\'',(SELECT count(*) FROM "Society"),'\''flats'\'',(SELECT count(*) FROM "Flat"),'\''users'\'',(SELECT count(*) FROM "user"),'\''attachments'\'',(SELECT count(*) FROM "Attachment"),'\''audit'\'',(SELECT count(*) FROM "AuditEvent"))'
}
