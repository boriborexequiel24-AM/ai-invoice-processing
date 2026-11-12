# AI Invoice Processing System

Invoices come in by email or upload. AI reads them, the system checks them, a person approves them in Slack, and they get posted to Xero. A live dashboard shows every invoice and where it is.

> Status: In development. Live demo link coming soon.

## What it does
1. **Receives invoices** from a Gmail inbox or a dashboard upload, and skips any file it has already seen.
2. **Reads each invoice with AI** (Claude), pulling out the vendor, invoice number, dates, line items and totals, with a confidence score for each field.
3. **Checks the numbers:** line items add up, no duplicate invoices, the purchase order exists and matches, the vendor is known.
4. **Sends it for approval** in Slack with Approve and Reject buttons, and explains any problems in plain words.
5. **Posts approved invoices to Xero** as bills, with the PDF attached.
6. **Logs every step**, so each invoice has a full history.

## Built with
n8n, Claude API, Supabase, Next.js, Vercel, Slack, Xero.

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
