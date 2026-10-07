# Architecture and decisions

## ADR 001: stack and boundaries

No existing code or stack was found. Use Next.js App Router/TypeScript, Tailwind and local shadcn-style accessible Radix components, React Hook Form/Zod and TanStack Table; PostgreSQL with Prisma. Select stable packages explicitly (Prisma 7 rather than the registry's 8 release candidate) and commit package-lock.json. Record installed versions in package.json.

The modular monolith has thin route handlers and server-only domain services in src/server. Authorization creates a fresh society context using the authenticated session and live membership. Services receive this context and enforce capabilities and row scope. DTOs are explicit projections. PostgreSQL composite foreign keys enforce society consistency even if application checks fail.

## ADR 002: authentication

Better Auth owns passwords, HttpOnly sessions, CSRF/origin checking and TOTP enrollment. Public signup is disabled; users are provisioned by an operator. No membership or resident grant is embedded in a long-lived token. Session cookie caching is disabled. Privileged roles ADMIN/CASHIER/AUDITOR require TOTP in production; the explicit development-only MFA bypass is rejected in production. Enrollment is accessible without business permissions. MFA recovery and identity verification require an operator runbook and must not be bypassed by assigning a different role.

## ADR 003: isolation and evidence

All society-owned tables carry societyId and composite keys. A record's ID alone is never authority. API, worker and future storage/export services must repeat live authorization. Runtime DB credentials must not have schema-owner rights in production. PostgreSQL triggers make audit append-only; the operational DB role cannot bypass triggers. Application logs omit request payloads and personal data.

## ADR 004: infrastructure

Compose provides PostgreSQL, Redis, private SeaweedFS S3, Mailpit and ClamAV. A separate BullMQ worker runs a non-sensitive infrastructure probe only in Stage 1; business jobs/outbox arrive with Stage 2. No payment mock or provider is implemented in this stage. Email is captured locally; production SMTP must be configured. No attachment upload/download endpoint is exposed until quarantine, scanning and authorization are complete.

SeaweedFS 4.48 replaces the initially considered MinIO containers after registry access failed for those images. Official release source confirms mini-mode flags, pre-created bucket support and explicit S3 credential identities. No anonymous identity is configured. The native 4.48 build was exercised locally; Docker Compose runtime remains unverified. Only the S3 port is published in Compose; WebDAV is disabled.

ESLint 9.39.5 is retained because the current Next.js React/import/accessibility plugins do not support ESLint 10. Prisma's vulnerable tooling dependencies are overridden to current stable deepmerge-ts/mysql2 releases and validated with migrations/build/tests. Full npm audit still reports the braces/glob developer-tool chain (no patched braces release available); production dependency audit is clean at this checkpoint. Review before production and do not pass untrusted glob patterns to tooling.

## Request path

Browser → Better Auth session → membership/MFA/capability → Zod input → scoped service → transaction (business mutation + audit) → minimized DTO. API responses use no-store and same-origin mutation checks; Redis limits authenticate-sensitive and security-directory operations, failing closed when unavailable.

## PWA and rendering

App data is fetched dynamically with no-store. Service worker caches only /offline.html and static icons. It never intercepts authenticated page/API requests for cache storage. UI uses native labels, keyboard-operable controls, explicit text statuses, focus management and mobile navigation.

## Limits

No financial modules or production deployment is implied by this foundation. Stage 1 import is synchronous and limited. Audit reads are bounded. Directory and parking are bounded/paginated. Production MFA, backups, least-privilege credentials, dependency/security review, TLS, Redis isolation, monitoring and independent accessibility review are deployment gates.
