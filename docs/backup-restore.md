# Encrypted backup and restore

## Consistency and recovery scope

`scripts/backup.sh` takes a host operator lock shared with deployment/restore, stops web and worker for a maintenance window, takes a PostgreSQL custom-format logical dump, archives immutable private documents, and records row counts, schema migration names, image IDs/release/git manifest and SHA-256 checksums. Caddy stays up but requests receive temporary upstream-unavailable responses. It restarts only previously running writers on exit. Never copy a live PostgreSQL data directory as a general backup.

The resulting tar is encrypted with age to a public recipient before retention. Plaintext exists only in a private scoped temporary directory and is removed on exit. Default retention is 30 days. Backup status is recorded atomically in DATA_ROOT/backup-status/status.json; admin sees last complete/failed/unknown status under Audit trail. An old successful status must be treated as stale by operators; inspect timer/logs and timestamp.

Redis counters/probes are disposable; PostgreSQL quarantine rows resume scanning after outages. Future financial/outbox jobs must remain DB authoritative and reconcile/catch up idempotently; they are not implemented yet.

## Keys and schedule

Generate the age identity on a separate trusted recovery machine; configure only its public recipient on the VM:

```bash
age-keygen -o society-backup-identity.key
age-keygen -y society-backup-identity.key
# Paste public recipient into BACKUP_RECIPIENT in .env on the VM.
bash scripts/backup.sh
```

Store the decryption identity separately from backups and from the VM. Escrow application auth encryption secret separately: restoring MFA requires the original BETTER_AUTH_SECRET. Keep encrypted offline escrow for all operational secrets plus .env/release inventory; secret files are deliberately excluded from the backup bundle. DB/Redis operational passwords can be new for a fresh restore. Do not rotate the auth encryption secret casually: it encrypts TOTP data and affects sessions.

Install systemd units after adjusting /opt/society paths if needed:

```bash
sudo cp infra/society-backup.service infra/society-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now society-backup.timer
systemctl list-timers society-backup.timer
journalctl -u society-backup.service
```

Timer runs daily at 02:30 Asia/Kolkata, catches missed executions after restart, and adds a short randomized delay. This incurs a write maintenance window. Agree an RPO (currently up to one day for a daily schedule) and measure RTO with real data.

Same-VM backups do not protect against complete VM/disk loss. Download encrypted archive plus .sha256 off the VM with scp/rsync to separately protected storage; verify checksums on receipt. No managed storage is required. Keep the private decryption key offline. Test key usability periodically.

## Fresh-stack restoration

Use a distinct .env.restore with COMPOSE_PROJECT_NAME containing `restore`, separate empty DATA_ROOT/BACKUP_ROOT, unused loopback proxy ports and matching APP_URL. Keep the backed-up exact RELEASE_TAG images loaded and the original auth secret from escrow. The script refuses existing containers/volumes/documents for that project; it never deletes an existing stack.

```bash
ENV_FILE=.env.restore bash scripts/restore.sh /absolute/society-TIME-ID.tar.age /absolute/offline-identity.key
ENV_FILE=.env.restore CURL_CA_BUNDLE=/path/to/restored-caddy-public-root.crt bash scripts/verify.sh
```

Create the target secret files from escrow first; do not run bootstrap.sh against the restore target because it creates a documents directory and the restore intentionally refuses nonempty targets. Secret parent mode 0700, files readable by container UID1000. Restore can use new db_owner/db_app/redis passwords, but requires old auth secret. On an actual single host never reuse the source document directory/ports. Disposable test rehearsals may use the same synthetic secrets, explicitly confined to fictional data.

Restore verifies outer/inner checksums and allowed archive entries, rejects document links/traversal/special files, matches image IDs, restores DB with pg_restore, compares row counts, restores document files/ownership, invalidates sessions, applies serialized migrations and verifies every referenced document hash before starting web/worker/Caddy. Exact image restoration is followed by separately reviewed upgrades. Use an isolated restored stack and verify login/TOTP, directory/permissions, document download, audit mutation rejection and parking conflict before cutover. Test invalid/expired sessions and process restarts. Restore fails closed on missing/corrupt referenced files.

Checksums detect accidental corruption; protect backup/key permissions because checksums alone do not identify a trusted sender. A compromised host can alter application data and backups. Keep independent off-host copies and incident evidence.

## Failure/rollback

Failed restore preserves the source and may leave the separately named target partly restored; investigate and choose a new empty target for retry. Do not silently drop that target or any production volumes. Deployment migration failure leaves writers stopped. A destructive schema rollback may require restore and lose all writes since the recovery point; reconcile later transactions manually with auditable records after financial modules exist. Do not delete posted evidence.

A synthetic encrypted backup/fresh-stack restore is recorded in validation.md. This is evidence of the foundation path, not production RPO/RTO or complete financial recoverability.
