# Validation rules

After the AI reads an invoice, the database function `validate_invoice` checks it and sets its status. The rules live in [supabase/migrations/20261124000000_po_vendor_unknown.sql](../supabase/migrations/20261124000000_po_vendor_unknown.sql) (the latest version of the function), so n8n, the dashboard and scripts all use the same logic. An invoice can be re-checked any time, for example after adding a missing vendor or PO.

## Checks

| # | Check | Flag if it fails | Example message |
|---|---|---|---|
| 1 | Vendor, invoice number and total were found | `missing_required_field` | Could not find the total on the invoice. |
| 2 | Vendor is in the vendor list (by name or email) | `unknown_vendor` | "Quantum Desk Rentals" is not in the vendor list. |
| 3 | Line items add up to the subtotal | `line_items_mismatch` | Line items add up to 2,165.00, but the subtotal says 2,045.00. |
| 4 | Subtotal plus tax equals the total | `total_mismatch` | Subtotal 450.00 plus tax 30.00 is 480.00, but the total says 520.00. |
| 5 | Same vendor and invoice number not received before | `duplicate` | Invoice NW-20418 from Northwind Office Supply was already received on Nov 13, 2026. |
| 6 | PO number is on the invoice | `missing_po` | There is no PO number on the invoice. |
| 7 | PO exists | `po_not_found` | PO PO-2040 does not exist. |
| 8 | PO is still open | `po_closed` | PO PO-1003 is already closed. |
| 9 | PO belongs to this vendor | `po_vendor_mismatch` | PO PO-1002 belongs to a different vendor. An unknown vendor quoting a real PO fails this too. |
| 10 | Invoice and PO use the same currency | `currency_mismatch` | Invoice is in USD, but PO PO-1010 is in EUR. |
| 11 | Total is no more than 2% over the PO | `po_amount_exceeded` | Total 1,560.00 is 30% over PO PO-1007 (1,200.00). |
| 12 | AI confidence is at least 0.80 on every field | (no flag) | Lists the unsure fields instead. |

## When a check can't run
Some checks need something to compare. They don't raise a flag when it's missing, and the dashboard shows them as skipped, not passed:

| Check | Skipped when |
|---|---|
| 2 | There is no vendor name on the invoice, and its email matches nobody |
| 3 | There are no line items, or no subtotal |
| 4 | There is no subtotal, or no total |
| 5 | There is no invoice number, or no vendor |
| 7 | There is no PO number |
| 8 to 11 | There is no PO number, or that PO doesn't exist |
| 9 | Also when the vendor couldn't be identified |
| 10 | Also when there is no currency |
| 11 | Also when there is no total |

## Result

| Status | When |
|---|---|
| **flagged** | One or more checks failed. Each reason is stored in `invoices.flags`. |
| **needs_review** | All checks passed, but the AI was unsure about at least one field. |
| **ready_for_approval** | Everything checks out. |

Tolerances: 0.01 for rounding in the math checks, 2% over the PO amount, and 0.80 minimum confidence. They're constants at the top of the function.

## Tested
All 13 sample invoices get the expected status and flags, both when the function is called directly and through the live n8n workflow (`scripts/test_n8n_intake.py --reset`). The needs-review path was tested by lowering the confidence on one invoice. The public dashboard key cannot run the function.
