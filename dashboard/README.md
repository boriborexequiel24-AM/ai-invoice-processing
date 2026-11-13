# Dashboard

The public demo page for the AI Invoice Processing System. Next.js 15 (App Router), Tailwind CSS 4 and PDF.js.

## Layout
| Path | What it does |
|---|---|
| `src/app/page.tsx` | Home: how it works, Try it, metrics, invoice list |
| `src/app/invoices/[id]/page.tsx` | One invoice: PDF, what the AI read, checks, line items, history |
| `src/app/api/process/route.ts` | Sends a sample or upload to the n8n intake workflow and enforces the demo limits |
| `src/lib/invoices.ts` | All Supabase reads |
| `src/components/` | UI pieces (TryIt and PdfPreview run in the browser, the rest on the server) |

## Security
- Every setting is server-side. Nothing starting with `NEXT_PUBLIC_` exists, so no key reaches the browser.
- Pages read Supabase with the public key, which can only see display columns (see `supabase/migrations/20261116000000_dashboard_access.sql`).
- The service key is used only on the server, for signed PDF links and rate-limit counts.
- The n8n webhook secret stays in the server route.

## Running
From the project root:
```bash
.venv/Scripts/python.exe scripts/sync_dashboard_env.py
```
```bash
npm run dev --prefix dashboard
```
Sample PDFs are copied from `../sample-invoices` into `public/samples` automatically before `dev` and `build`.
