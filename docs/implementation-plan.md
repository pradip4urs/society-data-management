# Implementation checklist

The original registry checkpoint and revised single-host foundation form one deployable product. See validation.md for actual measured results.

## Stage 1 foundation

- [x] Specification, architecture, model, permission/billing/threat/deployment/backup plans before coding.
- [x] Pinned compiled AMD64 web/worker/operator images; Compose/Caddy/private networking/secrets, development override.
- [x] Better Auth local accounts, TOTP, hashed single-use recovery, audited operator recovery, empty-installation first-admin.
- [x] Society composite FKs, history/grants/move-out revocation, append-only audit and live permissions.
- [x] Hierarchy/decimal flats/CSV+JSON preview-commit, profile, minimized security lookup.
- [x] Separate parking entitlement/allocation, transactional overlap prevention, vehicle make/model/color.
- [x] Private filesystem upload quarantine, scanner freshness guard, worker scan recovery, audience-scoped downloads.
- [x] Host bootstrap/deploy/verify, encrypted backup/restore/timer, admin backup status, Azure/save-load/rollback guide.
- [x] Responsive 390/820/1440 Chromium workflows and static-only PWA.
- [x] Unit/Postgres/compiled HTTPS container smoke, persistence and synthetic fresh-stack restore.
- [ ] Independent security/privacy/retention/accessibility acceptance, full browser matrix, capacity and failure/reconciliation checks on target host.
- [ ] Resolve outdated lint-tool peer ecosystem/developer advisories; monitor signatures, backup ages and disk capacity.

## Stage 2

- [ ] Confirm billing account/liability/access policies; exact rate/area rounding and effective rates.
- [ ] Concurrent retry-safe recurring billing, snapshots/numbering/due dates and immutable posting.
- [ ] Balanced double-entry ledger, periods/closing, opening balances and maker-checker.
- [ ] Offline payments/claims/cheque clearance/partial/advance/credits/refunds/reversals, receipts/vouchers.
- [ ] Financial acceptance and race/rollback/outage catch-up tests.

## Stage 3

- [ ] Allowlisted flat/invoice/payment/parking report builder, safe aggregates/saved reports and CSV/PDF/PNG.
- [ ] Controlled Playwright render worker with no arbitrary HTML/URLs and restricted egress/resource limits.
- [ ] Optional gateway verified webhooks/idempotency/event ordering/settlement reconciliation; mocks development-only.
- [ ] DB authoritative job/outbox reconciliation and export revocation tests.

## Stage 4

- [ ] Resident financial portal, approved vendors/reviews, assets/maintenance/work orders, complaints/internal notes/attachments.
- [ ] Resident-visible society/security/emergency contacts and in-app notifications; optional email/SMS.

## Stage 5 / production gates

- [ ] Independent security/WCAG/privacy review and full Chrome/Edge/Firefox/Safari/mobile validation.
- [ ] Measured scale budgets, disk alerts, backup RPO/RTO and real VM restore/failure drills.
- [ ] Azure domain/ACME/firewall deployment, actual host recovery operators/identity verification and secret escrow.
- [ ] Full financial/report/payment acceptance before any production-readiness claim.
