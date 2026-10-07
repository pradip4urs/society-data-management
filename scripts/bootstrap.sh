#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
operator_lock
command -v openssl >/dev/null
command -v age >/dev/null || { echo 'Install age (Ubuntu: sudo apt-get install age) before operating backups.' >&2; exit 1; }
mkdir -p "$SECRETS_DIR" "$DATA_ROOT/documents" "$DATA_ROOT/backup-status" "$BACKUP_ROOT"
chmod 700 "$SECRETS_DIR" "$BACKUP_ROOT"
for name in auth_secret db_owner_password db_app_password redis_password; do
  if [[ ! -f "$SECRETS_DIR/$name" ]]; then openssl rand -hex 32 > "$SECRETS_DIR/$name"; fi
  # Compose mounts the existing file; runtime UID 1000 must read it. Host parent stays 0700.
  chmod 444 "$SECRETS_DIR/$name"
done
chown 1000:1000 "$DATA_ROOT/documents"
chmod 700 "$DATA_ROOT/documents"
chmod 755 "$DATA_ROOT/backup-status"
printf '%s\n' 'Host folders/secrets ready. Run bash scripts/deploy.sh, then bootstrap-admin with a password on stdin.'
