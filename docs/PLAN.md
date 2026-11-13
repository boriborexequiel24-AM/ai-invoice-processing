# AI Invoice Processing System | Project Plan

## Goal
A working accounts payable system that a client can try in under a minute. An invoice comes in, AI reads it, the system checks it, a person approves it in Slack, and it gets posted to Xero. A live dashboard shows every invoice and where it is.

The portfolio is missing three things this project should cover:
- Finance and back-office work, which applies to any industry
- A clickable demo, not only workflow screenshots
- Code I wrote myself (dashboard and database) alongside n8n

## How it works

```
Email (Gmail)  ─┐
                ├─> n8n: Intake ─> AI: Extract ─> n8n: Validate ─> Slack: Approve ─> Xero: Create bill
Dashboard upload┘        │                │                 │                 │                 │
                         └────────────────┴─────────────────┴─────────────────┴─────────────────┘
                                                  Supabase (invoices + audit log)
                                                           │
                                                 Next.js dashboard (Vercel)
```

1. **Intake.** Someone uploads a PDF from the dashboard (email intake is planned, not built). The file is saved to Supabase Storage. A hash of the file stops the same invoice from being processed twice.
2. **Extraction.** n8n sends the PDF to the AI model (OpenAI for now) and asks for strict JSON: vendor, invoice number, dates, currency, line items, subtotal, tax, total, PO number. Each field gets a confidence score.
3. **Validation.** A code step runs these checks:
   - Line items add up to the subtotal, and subtotal plus tax equals the total
   - The same vendor and invoice number don't already exist (duplicate check)
   - The PO exists and the amount is within a set tolerance (PO match)
   - The vendor is known
   - No field is below the confidence threshold

   The result is one of three statuses: **ready for approval**, **needs review**, or **flagged** (with reasons).
4. **Approval.** A Slack message shows the summary and any flags, with Approve and Reject buttons. The same actions work from the dashboard.
5. **Posting.** Approved invoices are created as bills in a Xero demo company with the PDF attached. The Xero ID is saved back to the database.
6. **Audit trail.** Every step writes an event row (who, what, when), so each invoice has a full timeline.
7. **Errors.** An n8n error workflow sends Slack alerts. API calls retry with backoff, and failed invoices are marked so nothing gets lost quietly.

## Dashboard (what the client sees)
- **Invoice list** with status badges and filters
- **Invoice detail:** the PDF beside the extracted fields, flags explained in plain words, and a status timeline
- **Metrics:** invoices processed, average processing time, flag rate, estimated hours saved
- **Demo mode:** "Try a sample invoice" buttons (clean, duplicate, math error, no PO, blurry scan) so anyone can see the edge cases handled

## Tech stack
| Part | Tool |
|---|---|
| Orchestration | n8n |
| AI extraction | OpenAI API (PDF input, structured JSON output), provider swappable |
| Database, file storage | Supabase (Postgres + Storage) |
| Dashboard | Next.js + Tailwind, hosted on Vercel |
| Approvals, alerts | Slack app (buttons via interactivity webhook) |
| Accounting | Xero API (demo company) |
| Intake | Dashboard upload (Gmail planned) |

## Data model (Supabase)
- `vendors`: name, email, default currency
- `purchase_orders`: PO number, vendor, amount, status
- `invoices`: file path, file hash, extracted fields, confidence, status, flags, Xero ID
- `invoice_line_items`: description, quantity, unit price, amount
- `invoice_events`: invoice, step, actor, details, timestamp

## Folder layout
```
Real Work Systems/
├── CLAUDE.md
├── README.md                # Client-facing overview and demo link
├── .env.example
├── docs/                    # Plan, architecture diagram, decisions
├── dashboard/               # Next.js app
├── n8n/workflows/           # Exported workflow JSON
├── supabase/
│   ├── migrations/          # Schema SQL
│   └── seed.sql             # Demo vendors and POs
└── sample-invoices/         # Test PDFs, including edge cases
```

## Build phases
1. **Setup.** git init, Supabase project, connect the self-hosted n8n, OpenAI API key, Slack app, Xero demo company, `.env.example`.
2. **Sample invoices.** Make 10 to 15 fake invoices that cover the normal case and every edge case.
3. **Extraction.** Intake workflow plus AI extraction, saving results to Supabase. Test against all samples.
4. **Validation.** Math, duplicate, PO, vendor and confidence checks, with status and flag reasons.
5. **Approval and posting.** Slack buttons, Xero bill creation, audit events, error workflow.
6. **Dashboard.** List, detail, metrics, upload, demo mode. Deploy to Vercel.
7. **Polish.** README, architecture diagram, a short demo video, and a case study on workwithzeki.vercel.app.

## Decisions made
- **n8n hosting:** Use Exequiel's existing self-hosted n8n instance. It's already reachable at a public HTTPS URL, so Slack button clicks and dashboard uploads can call its webhooks directly. Keep the URL in `.env` (`N8N_BASE_URL`), never in code.
- **AI provider:** OpenAI for now, using existing API credits. The extraction step reads `AI_PROVIDER` so Anthropic can be swapped in later, for example to compare accuracy and cost on the sample invoices.
- **Public uploads:** Visitors can use the sample invoices or upload their own PDFs, with limits:
  - 5 uploads per visitor per day (rate limit by IP)
  - 5 MB max per file, PDF only, 10 pages max
  - A daily cap on total uploads, so the AI API cost can't run away
  - Visitor uploads are never posted to Xero. They stop at the approval step and are deleted after 24 hours.
  - A notice on the upload screen: don't upload real or sensitive invoices.

## Open decisions
- **Model:** Pick the OpenAI model for extraction when we start phase 3, and test whether a smaller, cheaper model is accurate enough.
