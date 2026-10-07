#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
operator_lock
[[ $# == 2 ]] || { echo 'Usage: ENV_FILE=.env.restore bash scripts/restore.sh /absolute/archive.tar.age /absolute/identity.key' >&2; exit 1; }
archive=$(realpath -- "$1")
identity=$(realpath -- "$2")
[[ ${COMPOSE_PROJECT_NAME:-society} != society && ${COMPOSE_PROJECT_NAME:-} == *restore* ]] || { echo 'Restore requires an explicitly named separate *restore* Compose project.' >&2; exit 1; }
[[ -z $(dc ps -aq) && ! -e "$DATA_ROOT/documents" ]] || { echo 'Restore target must have no containers or document directory.' >&2; exit 1; }
[[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME") ]] || { echo 'Restore target already has volumes.' >&2; exit 1; }
work=$(mktemp -d "$DATA_ROOT/.restore-XXXXXX")
cleanup() { [[ "$work" == "$DATA_ROOT"/.restore-* ]] && rm -rf -- "$work"; }
trap cleanup EXIT
(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
age -d -i "$identity" "$archive" > "$work/snapshot.tar"
tar -tf "$work/snapshot.tar" | sort > "$work/entries"
printf '%s\n' SHA256SUMS counts.json database.dump documents.tar manifest.json schema.txt | sort | cmp - "$work/entries"
tar -tvf "$work/snapshot.tar" | awk 'substr($0,1,1)!="-" {bad=1} END {exit bad}'
tar --no-same-owner --no-same-permissions -C "$work" -xf "$work/snapshot.tar"
(cd "$work" && sha256sum -c SHA256SUMS)
[[ $(jq -r .format "$work/manifest.json") == 1 ]] || exit 1
for image in web worker operator; do
  [[ $(docker image inspect -f '{{.Id}}' "society-$image:${RELEASE_TAG:-local}") == $(jq -r ".$image" "$work/manifest.json") ]] || { echo 'Load the exact backed-up release images before restoring.' >&2; exit 1; }
done
# Reject traversal, hard/symbolic links, special files before touching target data.
tar -tf "$work/documents.tar" | awk '/(^\/|(^|\/)\.\.(\/|$))/ || $0 !~ /^documents(\/|$)/ {bad=1} END {exit bad}'
tar -tvf "$work/documents.tar" | awk 'substr($0,1,1)!="-" && substr($0,1,1)!="d" {bad=1} END {exit bad}'
mkdir -p "$DATA_ROOT/backup-status"
chmod 755 "$DATA_ROOT/backup-status"
wait_db
dc exec -T postgres pg_restore -U society_owner -d society --no-owner --exit-on-error < "$work/database.dump"
db_counts | jq -S . > "$work/restored.json"
jq -S . "$work/counts.json" | cmp - "$work/restored.json"
tar --no-same-owner --no-same-permissions -C "$DATA_ROOT" -xf "$work/documents.tar"
chown -R 1000:1000 "$DATA_ROOT/documents"
find "$DATA_ROOT/documents" -type d -exec chmod 700 {} +
find "$DATA_ROOT/documents" -type f -exec chmod 600 {} +
# Recover the auth encryption key separately from offline secret escrow before starting.
# All restored sessions are revoked; restored users must authenticate again.
dc exec -T postgres psql -U society_owner -d society -v ON_ERROR_STOP=1 -c 'DELETE FROM "session";'
dc run --rm -T operator sh infra/migrate.sh
dc run --rm -T operator node dist/restore-check.js
dc up -d --wait --wait-timeout 240 web worker caddy
dc up -d clamav
echo 'Counts/checksums/exact release restored to isolated stack; sessions revoked. Verify TLS, login and document access before cutover.'
