#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
operator_lock
[[ -n ${BACKUP_RECIPIENT:-} ]] || { echo 'Set the age public BACKUP_RECIPIENT.' >&2; exit 1; }
command -v age >/dev/null
command -v jq >/dev/null
mkdir -p "$BACKUP_ROOT" "$DATA_ROOT/backup-status"
work=$(mktemp -d "$BACKUP_ROOT/.snapshot-XXXXXX")
running=()
for service in web worker; do [[ -z $(dc ps --status running -q "$service") ]] || running+=("$service"); done
finish() {
  code=$?
  # The only recursive removal is the verified private mktemp child.
  [[ "$work" == "$BACKUP_ROOT"/.snapshot-* ]] && rm -rf -- "$work"
  if ((${#running[@]})); then dc start "${running[@]}" >/dev/null; fi
  if ((code)); then
    printf '{"state":"failed","updatedAt":"%s"}\n' "$(date -u +%FT%TZ)" > "$DATA_ROOT/backup-status/status.tmp"
    chmod 644 "$DATA_ROOT/backup-status/status.tmp"
    mv "$DATA_ROOT/backup-status/status.tmp" "$DATA_ROOT/backup-status/status.json"
  fi
  exit "$code"
}
trap finish EXIT
dc stop web worker
dc exec -T postgres pg_dump -U society_owner -d society -Fc --no-owner > "$work/database.dump"
tar -C "$DATA_ROOT" -cf "$work/documents.tar" documents
db_counts > "$work/counts.json"
dc exec -T postgres psql -U society_owner -d society -At -c 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name' > "$work/schema.txt"
# Tags may have been rebuilt since startup: record the actual deployed image IDs.
web_id=$(docker inspect -f '{{.Image}}' "$(dc ps -aq web)")
worker_id=$(docker inspect -f '{{.Image}}' "$(dc ps -aq worker)")
operator_id=$(docker image inspect -f '{{.Id}}' "society-operator:${RELEASE_TAG:-local}")
jq -n --arg created "$(date -u +%FT%TZ)" --arg release "${RELEASE_TAG:-local}" --arg git "$(git rev-parse HEAD)" --arg web "$web_id" --arg worker "$worker_id" --arg operator "$operator_id" '{format:1,createdAt:$created,release:$release,git:$git,web:$web,worker:$worker,operator:$operator}' > "$work/manifest.json"
(cd "$work" && sha256sum database.dump documents.tar counts.json schema.txt manifest.json > SHA256SUMS)
archive="$BACKUP_ROOT/society-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4).tar.age"
tar -C "$work" -cf - database.dump documents.tar counts.json schema.txt manifest.json SHA256SUMS | age -r "$BACKUP_RECIPIENT" -o "$archive.tmp"
mv "$archive.tmp" "$archive"
(cd "$BACKUP_ROOT" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
# Strict glob limits retention to this script's archives, never database/documents.
days=${BACKUP_RETENTION_DAYS:-30}
[[ "$days" =~ ^[1-9][0-9]*$ ]] || exit 1
find "$BACKUP_ROOT" -maxdepth 1 -type f \( -name 'society-*.tar.age' -o -name 'society-*.tar.age.sha256' \) -mtime "+$days" -delete
jq -n --arg time "$(date -u +%FT%TZ)" --arg file "$(basename "$archive")" '{state:"complete",updatedAt:$time,archive:$file}' > "$DATA_ROOT/backup-status/status.tmp"
chmod 644 "$DATA_ROOT/backup-status/status.tmp"
mv "$DATA_ROOT/backup-status/status.tmp" "$DATA_ROOT/backup-status/status.json"
echo "Encrypted backup: $archive"
