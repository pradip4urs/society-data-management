# Data model

## Implemented foundation

Global Better Auth User/Session/Account/Verification/TwoFactor records are authentication infrastructure. SocietyMembership joins User to Society with one role and optional Person. Society-scoped tables expose unique (societyId,id); foreign keys reference the pair, not a global ID alone.

Society → Phase → Block → Flat. Flat contains floor, number, type, decimal areaSqFt/billableAreaSqFt, areaBasis, classification and separate internal/resident remarks. Person owns profile and approved contact data. Ownership and Occupancy join flat/person with historical intervals. ResidentAccessGrant joins society membership/user and flat, optionally an occupancy; revokedAt terminates authority. historicalDocuments is separate from active flat access for future documents.

ParkingSlot has identity/location/type. ParkingEntitlement records effective ownership/right separately. ParkingAllocation joins slot/flat with allocation type and effective dates. A PostgreSQL GiST exclusion constraint on society + slot + daterange prevents exclusive overlap, including concurrent inserts. Vehicle joins a same-society flat and optional same-flat allocation. Registrations are normalized; identity is unique within the society.

AuditEvent stores actor ID, action, entity type/ID, minimal non-PII metadata and timestamp. INSERT is allowed; UPDATE/DELETE are rejected by a trigger. Cross-society and auth audit responses never leak target record content.

## Invariants

Dates use DATE and end-exclusive intervals. endedAt must exceed startedAt; allocation ranges may be unbounded above. Positive areas and billable-area checks are enforced in DB and Zod. User/person associations must be unique within a society. Effective occupancy grants cannot outlive their linked occupancy. Audit insertion is in the same transaction as mutations. Closed/inactive memberships confer no permissions.

## Planned model

Stage 2 adds MaintenanceRate, BillingRun, BillingAccount, Invoice/InvoiceLine, Account, JournalEntry/JournalLine, Payment/PaymentAllocation, Receipt, CreditNote, Refund, Expense, VendorBill, Voucher, FinancialPeriod and ApprovalRequest with immutable posting/snapshot constraints. Stage 3 adds GatewayEvent/Settlement, ReconciliationRecord, SavedReport, ExportJob, Attachment and durable outbox. Stage 4 adds Vendor/Review, Asset/MaintenanceSchedule/WorkOrder, Complaint/Comment, Contact and Notification. Tables are deliberately not scaffolded without their transactional invariants.

## Revised single-host foundation

Attachment is now implemented: random ID, same-society flat FK, creator, safe original name, MIME/size/SHA-256, quarantine/clean/rejected state, created/scanned times, resident-visible flag and immutable membership audience snapshot. Content/scope/audience cannot be mutated. Download requires CLEAN plus current flat access and captured membership; a new occupant gets no older files. Private content is stored outside public/ on persistent filesystem mounts. Vehicle now includes make/model. Better Auth recovery codes use SHA-256 hashes through its supported storage extension, with library atomic single-use consumption. No financial snapshot/account models have been introduced prematurely.
