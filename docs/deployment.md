# Deployment runbook and gates

Stage 1 can be built and run locally; deployment to a public production environment is not verified. Do not load real PII until the blockers in threat-model.md and README are resolved.

## Preflight

Use Node 24, pinned lockfile and UTF-8 PostgreSQL 18 with btree_gist available. Provision separate database migration owner and runtime role. Migration credentials can create extensions/triggers; runtime cannot ALTER, DROP, TRUNCATE or disable triggers. Runtime needs SELECT/INSERT/UPDATE on auth and master data, INSERT/SELECT only on AuditEvent. No DELETE business endpoints exist. Restrict DB, Redis and private storage to application networks. Compose defaults are local only.

Use TLS and exact BETTER_AUTH_URL/NEXT_PUBLIC_APP_URL origin. Generate strong secret; set NODE_ENV=production and DEV_MFA_BYPASS=false. Configure trusted reverse-proxy IP handling with a deployment-specific review; do not accept arbitrary forwarding headers. Auth and security/mutation limits use atomic Redis counters and fail closed. Protect Redis with TLS/ACLs; outages block new auth requests. No sensitive cache keys/values are created by this application.

Current CSP permits Next.js inline framework scripts and inline styles. Plan nonce-based CSP with production asset/route validation before high-assurance deployment. Public service worker caches only static shell assets. Private pages/APIs must preserve no-store through CDN/reverse proxy; do not override these headers. No private document/attachment endpoints should be introduced without quarantine/authorization.

## Release

```powershell
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
# Take encrypted backup and complete restore drill before migrations.
npm run db:migrate
npm start
# Separate process only if required:
npm run worker
```

The runtime DATABASE_URL must use the restricted role; migrations use a controlled elevated identity in a separate job. Seed is never part of production startup. Provision initial society/user/membership using a reviewed operator transaction (synthetic dev seed cannot bootstrap real production). Operator CLI creates users within an existing society and audits provisioning. Require verified TOTP before granting privileged access. Better Auth invalidates pre-enrollment sessions upon successful enrollment. Confirm real cookie Secure/HttpOnly/SameSite attributes under HTTPS.

## Smoke test / rollback

Verify login/MFA, resident isolation, cross-society denial, security directory disable, audit INSERT/UPDATE rejection and a harmless master-data transaction. Check Redis failure behavior. Monitor error rates without recording PII/request bodies or secrets. Retain encrypted audit exports through a separate trusted operational process only; application exports are not implemented.

Roll back the app artifact only after confirming schema compatibility. Do not reverse evidence by deleting audits/history. Forward corrective migrations are preferred; restoring a database is a separately authorized recovery operation with a clear recovery point and impact assessment. Never point automated test suites at production.

## Authentication lifecycle gap

Stage 1 deliberately has no public signup, self-service email reset or production invitation UI. Establish identity verification, invitation expiry, privileged-role MFA recovery, lockout support and session revocation operational controls before rollout. Never reset MFA based solely on a claimed name/email. Removing a user or disabling membership immediately denies new business requests; already viewed data cannot be recalled. Adding an occupant grants no access by itself.

## Infrastructure limits

Docker Compose starts local Postgres/Redis/SeaweedFS/Mailpit/ClamAV; no public application container/cloud deployment is verified. ClamAV availability is infrastructure only: no upload pipeline exists. Mailpit is email capture only: no resident notification jobs exist. SeaweedFS uses explicit credential-only identities (no anonymous identity) and creates the private bucket on startup; use a maintained production S3-compatible service with private policies/versioning/lifecycle. Pin deployed images by reviewed digest after pulling on the target platform.
