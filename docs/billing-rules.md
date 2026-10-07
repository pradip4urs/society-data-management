# Billing rules (design only; Stage 2)

No billing/payment/ledger functionality is completed in Stage 1.

Money will be exact integer paise (BIGINT) and area/rates decimal. Multiply Decimal area × Decimal INR rate, round each charge once to paise using ROUND_HALF_UP, then sum integers; no JavaScript number arithmetic for financial values. Boundary tests include 0.005 INR, large amounts and fractional square feet. Return money as decimal strings to avoid JSON integer precision loss.

Use effective-dated society-global rates; preview does not issue evidence. Posting snapshots rate, area basis, payer and charge lines. One regular invoice per billing account/period is enforced by unique DB constraint; separately numbered adjustments require an explicit path. Retries and concurrent jobs use transactions and uniqueness. Invoice total includes only current charges, approved additions/taxes and approved invoice discounts. Show arrears separately; never re-bill unpaid prior invoices.

Outstanding = immutable invoice total − posted allocations − posted credits + applicable reversals. Paid/partial/unpaid is derived; overdue is independent. Advance payments remain unapplied liabilities/credits. Opening balances use a controlled balanced journal. Each journal balances exactly and must post to an open financial period. Invoice/receipt sequence allocation is concurrency safe and financial-year scoped.

Vacant/unsold classification never creates an automatic exemption. Liability is configured explicitly. Tax, late fee, waiver and exemption policies are disabled until approved; sensitive adjustments require configurable maker-checker with no self-approval. Corrections use credit notes/refunds/reversals, not edits to posted evidence.

Payment posting, allocations, journal and receipt commit atomically with an outbox notification. Offline cash/bank/UPI/cheque verification, cheque clearance, settlement and reconciliation are separate states. Future gateway provider validates raw-body signature, amount/currency/order/account/provider and unique event ID. Browser success/redirect has no financial authority. Mock provider must throw at initialization in production. Production provider implementation requires official current Razorpay/Cashfree documentation and sandbox verification.
