# Implementation checklist

## Stage 1 (this run)

- [x] Inspect empty repository; create specification, architecture, model, permissions, threat and billing documents before implementation.
- [x] Pin compatible stable stack and lockfile; local Compose and environment (Docker runtime validation pending).
- [x] Better Auth login/TOTP, controlled operator onboarding and fresh role authorization.
- [x] Prisma schema/migrations with society composite FKs, audit triggers and parking exclusion.
- [x] Synthetic seed, hierarchy/flat register, resident history and explicit grants.
- [x] Admin mutation/import UI, role policy, profile, parking and minimal security lookup.
- [x] Responsive shell, table/cards, flat map and static-only PWA.
- [x] Unit + PostgreSQL invariant/isolation/concurrency tests; Chromium browser widths.
- [x] Exact validation outcomes, setup/deployment/backup/restore runbooks and blockers.

Stage 1 reached a working local checkpoint. See validation.md for 4 unit, 11 PostgreSQL and 13 browser/API tests passing (2 duplicate MFA viewport cases skipped), clean build/type/lint and private-storage/worker probes. Docker startup, restore drill, production onboarding/recovery, developer-tool audit findings, full accessibility/browser matrix and large-society selectors remain explicit hardening gates. Stages 2–5 below are not implemented.

## Stage 2

- [ ] Effective rates/billing preview/post; exact arithmetic and immutable snapshots.
- [ ] Balanced ledger, period/numbering controls and opening balances.
- [ ] Atomic offline payments, receipts/vouchers/credit/refunds, maker-checker.
- [ ] Acceptance cases 7, 8, 11–14; database concurrency and rollback tests.

## Stage 3

- [ ] Production gateway + development-only mock, raw webhooks and replay tests.
- [ ] Outbox, settlement/fee/reconciliation models.
- [ ] Allowlisted report query builder, safe CSV, controlled PDF/PNG, private expiring exports.
- [ ] Acceptance 9, 10, 15–18 and download-revocation tests.

## Stage 4

- [ ] Financial resident portal, complaints, vendors/reviews, contacts, assets/work orders and notifications.

## Stage 5

- [ ] Independent accessibility/security review, performance budgets and monitoring.
- [ ] Production onboarding/MFA recovery, upload quarantine, retention and privacy policy.
- [ ] Migration tools, limited production DB roles, automated restore drills and deployment gates.

Updates below will distinguish checks actually run from pending validation.
