# Threat model and security controls

## Boundaries and threats

Untrusted browser input → same-origin API → authorization/domain → DB. Untrusted signup is disabled. Trusted operator provisioning is separate. Threats include IDOR, cross-society joins, stale grants, excessive security lookup, credential compromise, audit tampering, CSV injection, document URL guessing, concurrent parking/billing and webhook replay.

## Stage 1 controls

- Better Auth password hashing, HttpOnly sessions, origin/CSRF checks and TOTP. API mutations additionally require exact configured Origin. No cookie-cached role/grant decisions.
- Zod rejects unknown keys, malformed dates and excessive import sizes. Parameterized Prisma access and composite DB relationships preserve scope.
- Separate security projection; resident read scope applied in the query. Redis fixed-window limits use opaque user/IP hashes; fail closed. Search terms and PII are not logged/audited.
- Audit INSERT in mutation transaction and DB UPDATE/DELETE prevention. No arbitrary SQL/report/rendering surface. Private flat-document routes require live record scope and clean scan state.
- No-store private responses, CSP and security headers; static-only offline shell. Production secrets are file mounted and excluded from images. Seed requires explicit development context and uses fictional identities.
- Database exclusion/check constraints prevent overlapping parking and invalid areas. Tests use actual PostgreSQL.

## Deployment gates / residual risks

Protect infrastructure with TLS/private networks, restricted DB role, file secrets and verified MFA recovery operators. Compose generates random secrets and requires no SMTP. Review authentication updates and CSP against production assets. Stage1 uses host-controlled onboarding/recovery; self-service email invitations are optional future work. MFA enrollment/recovery depends on correct Better Auth session behavior and operational identity verification. Infrastructure rate limiter availability is required. No independent penetration/accessibility test has been performed.

Attachments now use private filesystem/quarantine, size/type/quota limits, integrity hashes, immutable audience snapshot and live-authorized forced downloads. Stale/unavailable scanner fails closed; maintain update connectivity. Host operator/root remains a trusted boundary. Private orphan/rejected retention needs approved reconciliation; never expose orphan paths. Before exports: field allowlists, formula-safe CSV, bounded controlled PDF/PNG rendering and audited authorization. Before finance: idempotent postings, balanced ledger, immutable evidence, closed periods and replay-safe webhooks. A synthetic encrypted fresh-stack restore passed; actual host monitoring/RPO/RTO and independent review remain gates.

## Retention and revocation

Move-out retains legal history and audits but revokes active occupancy grants. Membership disable blocks all new authorized requests. Already viewed data cannot be recalled; no offline private cache is created. Document link issuance and expiry must be tested when documents exist. Retention periods and lawful processing policy require society approval before live PII is loaded; do not purge accounting/history through generic deletes.
