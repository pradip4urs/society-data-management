# Society Desk

Stage 1 of an Indian housing society management application. This is a working administration foundation, with later financial modules explicitly deferred. No production readiness or compliance claim is made.

Implemented: Better Auth password/TOTP sessions, live society role checks, explicit resident flat grants, phase/block/flat register, decimal area, owner/occupant history, move-out revocation, exclusive parking and vehicles, validated flat import, own-profile editing, restricted security lookup, append-only audit, responsive directory/cards/map and public-only PWA shell.

## Local setup (PowerShell)

Install Node.js 24 LTS and Docker Desktop with Compose. All service ports bind to loopback. These credentials are for a private local machine only.

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env: generate a secret and set SEED_PASSWORD (at least 12 characters).
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. Mailpit: http://localhost:8025. Private S3 endpoint: http://localhost:9000 (SeaweedFS; no public console). Keep the application URL exactly consistent with BETTER_AUTH_URL; mutations reject a different origin. Seed operates on an empty database only and refuses production. Demo identities: `admin@example.test`, `cashier@example.test`, `resident-a@example.test`, `resident-b@example.test`, `security@example.test`, `auditor@example.test`; password is the SEED_PASSWORD you selected. The second synthetic society prefixes these accounts with `other-`.

Privileged roles must enroll TOTP under **Account security** before business access. For disposable local UI testing only, `DEV_MFA_BYPASS=true` permits unenrolled privileged accounts; application startup rejects this flag in production. Residents still use normal authenticated sessions. Security directory policy starts disabled; admin enables it in **Access & settings**. There are no public signup, payment, document upload/download or export endpoints.

Without Docker, `npm run db:local` starts an embedded real PostgreSQL on port 5432, stored under `.local/postgres`; keep that terminal open. Run migrations/seed in another terminal. Redis must still be provided on REDIS_URL; auth and mutations fail closed without it. Do not run embedded PostgreSQL and Compose PostgreSQL on the same port. The embedded package uses upstream native binaries and requires its documented install scripts; if your npm installation blocks those, review/approve `@embedded-postgres/windows-x64`, `@prisma/engines`, `prisma` and `esbuild` scripts via `npm approve-scripts`. Do not disable script review globally.

## Checks

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run test:integration
npx playwright install chromium
$env:SEED_PASSWORD = 'your-local-seed-password'
$env:DEV_MFA_BYPASS = 'true'
npm run test:e2e
Remove-Item Env:DEV_MFA_BYPASS
npm run build
```

Integration tests create, migrate, seed and destroy an isolated PostgreSQL database on port 55432. They never target your configured application DB. Browser tests require the local seeded application database and Redis, and create additional fictional persons. They cover 390px/820px/1440px widths using Chromium; Firefox/Safari remain a compatibility target requiring additional runs. The isolated synthetic MFA test uses `other-auditor@example.test` and returns it to its initial state. Do not enroll that fixture manually before running the suite.

Exact observed commands/results and outstanding validation are in [docs/validation.md](docs/validation.md). Database acceptance cases for finance are deferred with their modules, not mocked to claim completion.

## Worker

```powershell
npm run worker
# In a second terminal:
npm run worker:probe
```

The separate BullMQ process supports only an infrastructure probe in Stage 1. Business queues, outbox notifications and retry-safe recurring invoices are Stage 2/3 work.

## Provision a user (trusted operator only)

Users are created through a controlled operator CLI; assign a society-scoped Person ID to link an existing profile. This is not a production invitation/recovery system. Environment values keep passwords out of command arguments/history.

```powershell
$env:PROVISION_EMAIL = 'fictional-new@example.test'
$env:PROVISION_NAME = 'Fictional New Resident'
$env:PROVISION_PASSWORD = 'choose-a-unique-strong-password'
$env:PROVISION_SOCIETY_ID = 'demo-society'
$env:PROVISION_ROLE = 'RESIDENT'
$env:PROVISION_PERSON_ID = 'copy-person-id-from-your-controlled-record'
npm run user:provision
Remove-Item Env:PROVISION_PASSWORD
```

A membership confers no resident flat access by itself. Admin must create an explicit grant. Link tenant grants to the occupancy ID shown in flat details so move-out revokes access atomically. Ending occupancy revokes immediately even with a future end date. Historical document access remains a separate unimplemented financial workflow.

## Import

In **Manage records**, paste a JSON array, validate/preview, then commit. Unknown fields, malformed decimals, duplicate or existing flats, other-society blocks, invalid dates and more than 500 rows are rejected. Commit revalidates and inserts all rows in one transaction. Use the block ID from the hierarchy API (admin only), not its label.

```json
[
  {
    "blockId": "replace-with-authorized-block-id",
    "number": "201",
    "floor": 2,
    "flatType": "2 BHK",
    "areaSqFt": "1024.125",
    "billableAreaSqFt": "1024.125",
    "areaBasis": "SUPER_BUILT_UP",
    "classification": "VACANT",
    "internalRemarks": "",
    "residentRemarks": ""
  }
]
```

The directory has 50-row pages. Administrative selectors currently show the first page (50 flats); parking views show up to 200 records and person/membership/slot selectors up to 1000. Large-society searchable selectors and full parking pagination are Stage 5 scalability work. No unrestricted CSV export exists. Contact phones are disclosed only if approvedPhone was explicitly set by admin.

## Structure and migrations

- `src/app`: pages and thin API handlers; `src/components`: accessible forms/navigation/table/cards.
- `src/server`: auth, fresh permissions, validation, domain services, Redis request protection.
- `prisma/schema.prisma`: Better Auth and society foundation models; seed is synthetic.
- `202610080001_foundation`: tables, indexes and composite society foreign keys.
- `202610080002_invariants`: decimal/date checks, GiST parking exclusion, audit immutability and occupancy-grant checks/revocation.
- `202610080003_auth_mfa`: current Better Auth verification/lockout fields.
- `public/sw.js`: public static assets only; no private offline data.
- `docs`: specifications, assumptions, architecture, permissions, threat model, billing design, staged checklist and runbooks.

## Production blockers and remaining work

Stages 2–5 are not completed: rates/invoices/ledger/payments/gateway/reconciliation/reports/exports, financial resident self-service, vendors/assets/complaints/contacts, business notifications, upload quarantine and document links. No Razorpay/Cashfree sandbox instructions apply until integration exists. Tax, waiver, penalty and exemption decisions remain unconfirmed and disabled by design.

Before any live resident data: production invitation/recovery and MFA identity-verification process, least-privilege infrastructure roles, TLS/secret management, multi-instance trusted-proxy/rate-limit configuration, retention/privacy approval, monitoring and backup/restore drill, accessibility/security review and browser matrix testing. CSP still allows inline framework scripts/styles; nonce-based tightening needs a deployment-specific pass. Local Compose images must be pulled/verified on a Docker-enabled host. SeaweedFS is local S3-compatible storage; choose and harden a maintained production private S3 service. See [deployment](docs/deployment.md) and [backup/restore](docs/backup-restore.md).
