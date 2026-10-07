# Single-host foundation checkpoint (8 October 2026)

The revised product deployment constraint supersedes the initial S3/externally provisioned infrastructure design. Retain Next.js/Better Auth/Prisma registry and live permissions; replace S3 with a private filesystem adapter. Stages 2–5 financial/operational workflows remain pending. No taxes, penalties, transfer liability or historical financial access policy is invented.

## Product / model / permissions additions

First-admin setup is a trusted host CLI, serialized in the database, with a password supplied on stdin and no default credential/email dependency. Privileged users must enroll TOTP. Recovery codes are high-entropy single-use values stored as SHA-256 hashes through Better Auth's supported middleware/storage extension; Better Auth still owns challenge/session/atomic consumption. Operator recovery requires a recorded reason, revokes sessions, and requires fresh MFA enrollment; it does not grant access to previous financial documents.

Stage 1 adds Attachment with society/flat/creator scope, random internal ID, immutable content hash/size/audience, quarantine/clean/rejected status and explicit resident-visible flag. Admin can upload flat documents; admin or explicitly authorized resident can download clean authorized documents. Cashier/security/auditor access is denied until document categories and field policies exist. No automatic historical document inheritance. Files use private persistent directories owned by application UID1000; API never accepts a path. Uploads are size/type/quota limited, checked against live access, and fail closed if ClamAV is unavailable. Worker recovers quarantine rows from PostgreSQL; Redis is not the source of truth. Future exports share this adapter and use controlled render templates with browser egress limits.

Registry adds CSV preview/commit with strict schema and duplicate rejection (no silent replacement), vehicle make/model and approved contact editing. Current pagination/selector limits remain documented.

## Architecture / threat decisions

Single Compose topology: Caddy → compiled non-root web; PostgreSQL/Redis/ClamAV/compiled worker on a private backend network. Only proxy ports are published. Scanner has outbound connectivity for signature updates; stale/unavailable scanning fails closed. No Docker socket inside application containers. Private documents and backup status are least-privilege mounts. Secrets are file-mounted; production rejects MFA bypass/payment mock flags. Production DB owner is separate from runtime permissions. Migrations run once in a serialized operator deployment step, never in app entrypoints.

One host is a single failure domain. Encrypted same-host backups do not protect against VM/disk loss; download copies off-host, retaining decryption identity separately. Backups use a documented write maintenance window, logical PostgreSQL dump, stable document snapshot, release/schema manifest and checksums. Host systemd timer schedules the operator backup script (no socket mount). Restore targets a separately named empty stack and is verified before traffic. Destructive rollback may require restore and lose writes after the recovery point.

## Deployment / implementation checklist

- [x] Compiled multi-stage web/worker images, production Compose, dev override, Caddy HTTPS and local trusted TLS instructions.
- [x] File secrets and startup guards, first-admin bootstrap, hashed recovery and audited operator recovery.
- [x] Private filesystem quarantine/download adapter, ClamAV fail-closed scanning, DB queue recovery and tests.
- [x] CSV import/vehicle updates and admin backup status.
- [x] Host bootstrap/deploy/verify, encrypted backup/restore, retention, systemd timer, image save/load and Azure disk/firewall guide.
- [x] Docker production rehearsal: migrations/bootstrap/MFA, access tests, restart persistence, backup/fresh-stack restore; lint/type/tests/build.

Actual results and target-host/independent-review blockers are recorded in validation.md. Systemd/Azure public deployment and full product stages remain pending.

## Remaining product stages

Stage 2: billing account/liability policy, exact invoice snapshots/concurrent jobs, balanced immutable ledger, offline verification/payments/receipts/vouchers and closed periods. Stage 3: allowlisted report builder, controlled CSV/PDF/PNG exports, optional gateway/reconciliation. Stage 4: financial resident self-service, vendors/assets/complaints/contacts/in-app notifications. Stage 5: independent security/accessibility, full browser matrix, scale limits and failure/recovery validation. No placeholder dashboard may claim these complete.
