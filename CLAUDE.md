# Real Work Systems

## Overview
A portfolio and demo project built by Exequiel to show prospective clients. It should show real-world systems work: clean architecture, reliable automation, and polished results.

**Project:** AI Invoice Processing System. Invoices come in by email or upload, Claude extracts the data, the system checks it (math, duplicates, PO match), a person approves it in Slack, and it gets posted to Xero. A live dashboard shows every invoice and its status.

> Status: Phase 1 (setup) in progress. Repo, folders, env template and database schema are done; accounts still need creating. Full plan in [docs/PLAN.md](docs/PLAN.md).

## Context
Exequiel's existing portfolio (workwithbori.cloud, workwithzeki.vercel.app) already covers lead routing, email triage and CRM sync, mostly as n8n/Make/Zapier workflows. This project fills the gaps: finance/back-office work, a live clickable demo, and code he wrote himself. Don't suggest rebuilding lead routing.

## Goals
- Build a working demo that clients can see and understand quickly.
- Keep the code clean and well-organized, since the codebase is part of the portfolio.
- Document decisions so the project is easy to walk through in a client conversation.

## Tech Stack
- **Orchestration:** n8n (Exequiel's existing self-hosted instance)
- **AI extraction:** Claude API (PDF input, structured JSON output)
- **Database and storage:** Supabase (Postgres + Storage)
- **Dashboard:** Next.js + Tailwind on Vercel
- **Approvals and alerts:** Slack app
- **Accounting:** Xero API (demo company only)
- **Intake:** Gmail and dashboard upload

## Project Structure (planned)
```
Real Work Systems/
├── CLAUDE.md
├── README.md            # Client-facing overview and demo link
├── .env.example
├── .claude/             # Claude Code project settings
├── docs/                # Plan, architecture, decisions
├── dashboard/           # Next.js app
├── n8n/workflows/       # Exported workflow JSON
├── supabase/            # migrations/ and seed.sql
└── sample-invoices/     # Test PDFs, including edge cases
```

## Conventions
- Favor clarity and maintainability over clever code.
- Use descriptive names and keep files focused.
- Never commit secrets. Use environment variables and a `.env.example` file.
- Write a short README section for any feature a client might see.
- Never use em dashes in anything written for this project.
- Only use fake sample data and the Xero demo company. No real financial data.
- Export n8n workflows to `n8n/workflows/` after changes so they're versioned.

## Working Notes
- Environment: Windows 11, PowerShell and Git Bash available.
- Git repo initialized on `main`. No commits and no remote yet: git name/email aren't configured on this machine. Set them for this repo before the first commit.
- Account setup steps (Supabase, Slack, Xero, etc.) are in [docs/SETUP.md](docs/SETUP.md).
