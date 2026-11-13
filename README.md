# AI Invoice Processing System

Invoices come in by email or upload. AI reads them, the system checks them, a person approves them in Slack, and they get posted to Xero. A live dashboard shows every invoice and where it is.

> Status: In development. Live demo link coming soon.

## What it does
1. **Receives invoices** from a Gmail inbox or a dashboard upload, and skips any file it has already seen.
2. **Reads each invoice with AI** (OpenAI, with the provider swappable), pulling out the vendor, invoice number, dates, line items and totals, with a confidence score for each field.
3. **Checks the numbers:** line items add up, no duplicate invoices, the purchase order exists and matches, the vendor is known.
4. **Sends it for approval** in Slack with Approve and Reject buttons, and explains any problems in plain words.
5. **Posts approved invoices to Xero** as bills, with the PDF attached.
6. **Logs every step**, so each invoice has a full history.

## Tested, not just demoed
- **13 test invoices** cover clean cases and the problems real AP teams see: duplicates, wrong math, missing or exceeded POs, unknown vendors, a blurry scan, a 2-page invoice and a euro invoice.
- **AI accuracy is measured**, not assumed. Four OpenAI models were scored against an answer key, and the chosen one read all 13 invoices perfectly at about $0.0025 each. See [docs/extraction-eval.md](docs/extraction-eval.md).
- **12 validation checks** with plain-English reasons, like "Total 1,560.00 is 30% over PO PO-1007 (1,200.00)." See [docs/validation.md](docs/validation.md).
- **End-to-end test:** every sample goes through the live n8n workflow, and the extracted fields, final status, flags and database rows are all checked. Duplicate files, non-PDFs and bad credentials are rejected.

## Built with
n8n, OpenAI API, Supabase, Next.js, Vercel, Slack, Xero.

## Project layout
| Folder | What's in it |
|---|---|
| `dashboard/` | Next.js dashboard |
| `n8n/workflows/` | Exported n8n workflows |
| `supabase/` | Database schema and demo data |
| `sample-invoices/` | Fake test invoices, including edge cases |
| `docs/` | Plan and setup notes |

## Running it yourself
See [docs/SETUP.md](docs/SETUP.md).

All data in this project is fake. The Xero connection uses a demo company.
