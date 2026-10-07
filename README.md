# Society Desk

A working Stage 1 foundation for Indian housing societies, running entirely on one host. The same compiled AMD64 web/worker/operator images run in local Docker Compose and on an Azure Ubuntu VM. No managed database, storage, queue, auth, email or payment service is required.

Implemented: local Better Auth password/TOTP authentication, hashed single-use recovery codes, audited host recovery, secure first-admin bootstrap, live society permissions, resident flat grants and move-out revocation; hierarchy/decimal flat areas/ownership and occupancy history; exclusive parking with vehicle make/model; CSV/JSON import preview and atomic commit; private document quarantine, ClamAV scanning and scoped downloads; responsive directory/map/profile/audit and backup status.

Billing, ledger, payments, reports/exports, vendors, complaints, assets and notifications remain in later stages. This is not a production-readiness claim. See [implementation checklist](docs/implementation-plan.md) and [actual validation](docs/validation.md).

## Local production rehearsal

Use Docker Desktop with Linux containers and WSL integration, or Docker Engine/Compose on Linux. Node 24 is required only for development/tests and building outside Docker. Host operating scripts require Bash, flock, openssl, jq, age, tar and curl. On Ubuntu: `sudo apt-get install age jq openssl curl`.

```bash
cp .env.compose.example .env
# If ports 80/443 are unavailable, add HTTP_PORT=8088, HTTPS_PORT=8443
# and APP_URL=https://localhost:8443 to .env.
sudo bash scripts/bootstrap.sh
bash scripts/deploy.sh
```

Follow [deployment](docs/deployment.md) to trust Caddy's local HTTPS root and create the first admin using a password on stdin. Never run the synthetic seed for production onboarding. Enroll TOTP before business access. In-app **Use a recovery code** consumes a generated single-use recovery code. The default installation sends no email/SMS and collects no online payment.

Hot reload uses `docker compose -f compose.yaml -f compose.dev.yaml up --build`. Run migrations through the operator first. Mailpit at localhost:8025 is an optional development tool. Production never applies this override.

## Checks

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run test:integration
docker compose --profile tools build web worker operator
bash scripts/verify.sh
```

Integration tests create/migrate/seed/destroy a separate real PostgreSQL database on port 55432. Legacy browser tests (`npm run test:e2e`) require the native seeded development app plus Redis, and cover Chromium at 390/820/1440 widths. `playwright.production.config.ts` targets an explicitly bootstrapped disposable HTTPS Compose stack; it never seeds production. See validation.md for fixture setup and measured results.

## Files and authorization

Admin uploads flat documents through flat details. PDF/PNG/JPEG up to 10 MiB are accepted only when scanner signatures are current. New content stays quarantined until the worker records CLEAN; failed scans remain inaccessible. Society quota is 1 GiB. New versions get new random IDs; hashes/size/content scope and audience are immutable. Resident sharing snapshots currently authorized memberships and checks live flat grants again on every download; later occupants inherit no older documents. Cashier/security/auditor private-document access is denied. Private files are outside public/ and never cached offline.

## Registry import

**Manage records** accepts CSV with this required header (optional internalRemarks/residentRemarks columns):

```csv
blockId,number,floor,flatType,areaSqFt,billableAreaSqFt,areaBasis,classification
replace-with-authorized-block-id,201,2,2BHK,1024.125,1024.125,CARPET,VACANT
```

JSON arrays using the same fields remain supported, with numeric floor and decimal areas as strings. Preview and commit revalidate; unknown fields, malformed decimals, duplicate/existing flats and other-society blocks are rejected. No implicit replacement or ownership import occurs. Maximum 500 rows. Area basis is an explicit society decision, not inferred.

Directory pages are 50 rows. Administrative selectors currently use the first 50 flats; parking views are bounded at 200 and person/membership/slot selectors at 1000. Full searchable selectors/pagination are outstanding scalability work.

## Operations

[Single-host architecture](docs/architecture.md), [permission matrix](docs/permissions.md), [threat model](docs/threat-model.md), [data model](docs/data-model.md), [billing rules](docs/billing-rules.md), [Azure/upgrade runbook](docs/deployment.md), [encrypted backup and fresh-stack restore](docs/backup-restore.md). Private file storage replaces the earlier S3 design completely.

Before live resident data: confirm privacy/retention and account-recovery identity verification; complete independent security/accessibility review, browser compatibility and capacity/failure checks; resolve developer-tool advisories and choose measured RPO/RTO. Financial acceptance tests remain mandatory before their modules are usable. Taxes/penalties/exemptions are unconfirmed and disabled.
