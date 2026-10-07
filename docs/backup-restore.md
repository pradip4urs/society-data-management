# Backup and restore runbook

Stage 1 stores data in PostgreSQL. Redis counters/probe jobs have no authoritative business evidence. No attachments or financial records are created yet. When documents/outbox exist, backup and restore must coordinate DB pointers, storage versions and event replay rules.

## Backup

Use PostgreSQL 18 client tools matching the server. Store encrypted backups away from the application host, with tightly scoped operator access and agreed retention. Set password using a secrets manager/pgpass or environment, never a command argument. Do not put credentials or resident data in logs.

```powershell
# Development Compose example; choose an encrypted external destination in production.
New-Item -ItemType Directory -Force -Path .local/backups | Out-Null
docker compose exec -T postgres pg_dump -U society -d society -Fc -f /tmp/society.dump
docker compose cp postgres:/tmp/society.dump .local/backups/society.dump
```

The server-side file avoids Windows pipeline binary-encoding corruption. Record UTC backup time, release/schema version, checksum, encrypted object identifier and expected recovery point. Enable managed PITR/WAL archiving for production and regularly test restoration; target RPO/RTO must be agreed by the society before launch.

## Restore drill

Create a separate empty database, restore without overwriting the source, and compare row counts/history/scoping and trigger/exclusion behavior. Use a safe name you explicitly created. Never drop or truncate live society data as part of a drill.

```powershell
docker compose exec -T postgres createdb -U society society_restore_drill
docker compose exec -T postgres pg_restore -U society -d society_restore_drill --no-owner --exit-on-error /tmp/society.dump
docker compose exec -T postgres psql -U society -d society_restore_drill -c 'SELECT count(*) FROM "Society";'
docker compose exec -T postgres psql -U society -d society_restore_drill -c 'SELECT count(*) FROM "AuditEvent";'
```

Inspect audit immutability and no_exclusive_parking_overlap on the restored database, check composite foreign keys, and compare counts to source. A restored auth database contains session/password/MFA evidence: isolate it from real users and invalidate restored sessions before enabling a recovery instance. Rotate operational credentials if compromise is suspected. Keep drill access private. Approval to delete a drill DB does not authorize deleting any other database.

## Actual incident

Pause writes through controlled maintenance, identify last safe recovery point, restore to a fresh isolated instance, verify referential and evidence invariants, revoke old sessions, reconcile post-backup operations and then redirect traffic through the release gate. Preserve compromised/original evidence for investigation; do not silently rewrite audit history. Document data loss and affected parties under the approved retention/privacy process.

Automated production restore drills, managed PITR, storage restore and financial recovery acceptance tests are Stage 5 work. Local validation results are recorded in validation.md; this runbook alone is not proof of recoverability.

`scripts/restore-drill.ts` is an optional Windows synthetic-only drill with live row-count/trigger/exclusion verification. It requires `PG_TOOLS_DIR` pointing to a PostgreSQL 18 client bin directory and a local seeded database. It creates a uniquely named target without deleting/overwriting a database. The embedded server package does not include pg_dump/pg_restore; the attempted drill in this run did not complete. A fresh empty `society_restore_drill` DB from the failed attempt is retained locally and has no production data. Do not treat it as a validated backup.
