# Society management product specification

## Scope and checkpoint

This repository starts empty. Stage 1 delivers an authenticated, responsive vertical slice for society hierarchy, a permanent flat register, synthetic residents, effective-dated ownership/occupancy, explicit resident access, parking, validated flat import and audit. Later financial and operational modules are planned, not completed.

Supported clients: current Chrome, Edge, Firefox and Safari, including modern Android Chrome and iOS Safari. Target WCAG 2.2 AA; certification requires independent review. Installable PWA caches only the public offline shell and icons. No authenticated pages, API data or documents are cached by the service worker.

## Business assumptions

- Flats persist through transfers. Area uses PostgreSQL decimal square feet; billable area is explicit and independent of occupancy classification.
- A society has phases and blocks. Flat numbers are unique within a block. Flat type is configurable text in Stage 1.
- Ownership can have multiple owners. Occupancy and ownership intervals are start-inclusive/end-exclusive. Ending occupancy revokes linked grants atomically, retaining history. Resident grants are explicit; creating occupancy does not grant access.
- A user may belong to multiple societies and have multiple grants. Membership and grants are read from the database on every request. Historical document access is separately modeled and unused until documents are implemented.
- All parking slots in Stage 1 are exclusive; overlapping allocation intervals are forbidden by PostgreSQL. Entitlements do not themselves allocate a slot.
- Directory access for security and optional vehicle lookup are disabled by default. Contact disclosure requires an explicit approved phone. Cashiers receive the active operational directory, without internal notes.
- Imports are admin-only, all-or-nothing, limited to 500 flat rows, with preview and a second validated commit. Import covers flat master data, not legal ownership or financial opening balances.
- New account provisioning is an operator-controlled process in Stage 1. Public signup is disabled. Synthetic seed identities use reserved example.test addresses and fictional phone placeholders.
- Taxes, penalties, exemptions, waivers and maker-checker financial rules remain configurable and disabled until confirmed. Vacant/unsold flats are not automatically exempt.

## Stage 1 workflows

Sign in; enroll privileged-role MFA; select a society; view a role dashboard and flat map; search authorized directory; create flat/person/ownership/occupancy; explicitly grant resident access; end occupancy; manage parking entitlements, allocations and linked vehicles; preview/commit flat import; change society security settings and membership roles; read admin audit history. Residents see physical flat details and their own profile only, not other occupants' history. Security uses a separate minimized lookup endpoint.

## Deferred workflows

Invoices, ledger, payments, billing accounts, gateway integrations, reports/exports, complaints, vendors, assets and notifications. Navigation identifies planned modules without pretending these workflows work. Revised Stage1 implements private flat document quarantine/downloads, audited host MFA recovery, encrypted backups and fresh-stack restore; finance document access remains a separate unconfirmed policy.

## Acceptance

Database-backed tests must cover society foreign keys, isolation, cashier restrictions, resident ID tampering, minimal security projections and immediate disablement, move-out revocation/history, immutable audit, decimal area and concurrent parking. Browser tests cover login, flat directory and profile at mobile/tablet/desktop widths. Financial acceptance cases 7–18 from the request become mandatory in their delivery stages and are not claimed here.
