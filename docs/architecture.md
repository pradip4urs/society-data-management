# Architecture and decisions

The maintained Next.js 16.4 App Router/TypeScript modular monolith uses thin APIs, server-side domain services and explicit DTO projections. Better Auth owns password hashing, TOTP/challenges and sessions. Prisma/PostgreSQL owns transactions, constraints and evidence. Tailwind/local shadcn-style Radix components, RHF/Zod and TanStack Table provide the UI. Versions are pinned in package.json/lockfile.

## Single-host topology

Browser → Caddy HTTPS → compiled standalone non-root web. PostgreSQL18, password-protected Redis8, compiled BullMQ/scan worker and ClamAV1.4.6 run on internal backend networks. Only Caddy proxy ports publish in production. Scanner has outbound signature update access; web serves no external auth/payment/email dependency. Private bind-mounted documents replace earlier S3/SeaweedFS; no Azure managed service, Kubernetes or registry is required. The same AMD64 images/topology run locally and on one Ubuntu VM.

Web/worker are read-only non-root with temporary folders and least-privilege mounts. No Docker socket is mounted. Secrets arrive as mounted files, not image layers. Postgres owner is available only to one-off migration/operator steps; runtime society_app cannot create schema objects, update/delete audit evidence or delete history/documents. Deployment/backup/restore serialize using host flock. App startup does not migrate.

## Authorization/evidence

Authenticated session → fresh live society membership/MFA → capability → strict Zod input → record/field scoped service → transaction with audit → minimized response. Composite foreign keys enforce same-society relationships. Admin business mutation cannot rewrite audit. Resident grants support multiple users/flats, are date-bound and live; move-out revokes linked grants immediately. Security lookup has its own explicit field SELECT allowlist and admin-off defaults. Redis throttling fails closed; Caddy overwrites forwarding IP/protocol headers.

Better Auth cookie cache is disabled. Production privileged roles require MFA; bypass/mock flags cause startup failure. Supported Better Auth middleware/storage extension hashes random recovery codes while retaining library generation/challenge/atomic consumption; successful recovery use is audited. First-admin bootstrap is a serialized empty-installation CLI with password stdin. Trusted operator MFA recovery requires externally verified identity/reason and revokes sessions. No public signup/email dependency.

## Files and worker

Random document IDs never expose user paths. PDFs/PNGs/JPEGs are limited to 10 MiB and society quota1GiB, declared/magic types checked, safe forced-download filename and no-store. Stale/unavailable scanner blocks uploads. New content enters private quarantine; PostgreSQL queued rows/row locks govern workers, with crash recovery after filesystem rename. Hash-verified clean files alone are downloadable. Immutable content/audience prevents earlier occupant document inheritance; live flat grants also apply. Admin may upload; unrelated roles are denied. Rejected files remain private for later approved retention handling. Transaction rollback can leave a private orphan; review controlled reconciliation/retention before large use, never serve orphan paths.

Redis holds counters and infrastructure probe jobs only. Scheduled finance/export/outbox jobs are pending and must add DB source-of-truth recovery/catch-up. Controlled Playwright rendering/egress/resource limits belong to Stage3; no arbitrary rendering endpoint exists.

## Backup and limits

Write maintenance window creates consistent logical DB dump/document tar with manifest/hash checks, age public-recipient encryption and retention. Host timer requires no socket in an app container. Fresh-stack restore verifies exact release, counts, document hashes, revokes sessions and runs migrations before startup. Same-host copies need separate off-host download/key escrow to survive VM loss.

PWA caches only public offline assets; all private requests remain online/no-store. CSP currently permits framework inline scripts/styles; nonce tightening needs independent review. UI selectors/parking views are bounded. Stage2–5 finance/report/operational modules and production operational acceptance remain outstanding. ESLint9 is retained for supported React/import plugin peers despite end of maintenance; developer-tool braces/glob advisories are unresolved and must be reviewed before production. Production npm dependencies currently audit clean.
