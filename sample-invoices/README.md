# Sample invoices

Fake invoices for testing and demoing the system. Each one covers a normal case or a specific problem the system should catch. All companies and numbers are made up, and the vendors and purchase orders match [supabase/seed.sql](../supabase/seed.sql).

| File | What it tests | Expected result |
|---|---|---|
| 01-clean-northwind | Normal invoice, matches PO-1001 | Ready for approval |
| 02-clean-brightline | Normal invoice with no tax | Ready for approval |
| 03-clean-cedar | Normal service invoice | Ready for approval |
| 04-clean-atlas | Normal invoice with tax | Ready for approval |
| 05-duplicate-of-01 | Invoice 01 sent again as a reminder | Flagged: duplicate |
| 06-math-error-harbor | Line items don't add up to the subtotal | Flagged: line items mismatch |
| 07-wrong-total-cedar | Subtotal plus tax doesn't equal the total | Flagged: total mismatch, over PO |
| 08-missing-po-northwind | No PO number | Flagged: missing PO |
| 09-over-po-brightline | Total is 30% over the PO | Flagged: over PO |
| 10-unknown-vendor | Vendor not in the system, no PO | Flagged: unknown vendor, missing PO |
| 11-blurry-scan-atlas | Blurry, tilted scan with no text layer | Ready, or needs review if confidence is low |
| 12-multi-page-harbor | 32 line items over two pages | Ready for approval |
| 13-euro-lindqvist | EUR with European date and number formats | Ready for approval |

[expected.json](expected.json) has the exact values printed on each invoice. Phase 3 uses it to measure how accurately Claude extracts the data.

## Regenerating
```bash
.venv/Scripts/python.exe scripts/generate_sample_invoices.py
```
First-time setup: `python -m venv .venv` then `.venv/Scripts/python.exe -m pip install -r scripts/requirements.txt`.
