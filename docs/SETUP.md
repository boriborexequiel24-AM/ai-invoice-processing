# Setup

Every value below goes in `.env` (copy it from `.env.example`). Never commit `.env`.

## 1. Supabase
- [ ] Create a new project at supabase.com (free tier is fine).
- [ ] In **SQL Editor**, run each file in `supabase/migrations/` in name order, then `supabase/seed.sql`.
- [ ] In **Storage**, create a private bucket named `invoices`.
- [ ] From **Project Settings > Data API**, copy the Project URL into `SUPABASE_URL`, without the `/rest/v1/` ending.
- [ ] From **Project Settings > API Keys**, copy the publishable key into `SUPABASE_ANON_KEY` and the secret key into `SUPABASE_SERVICE_ROLE_KEY`.

## 2. OpenAI
- [ ] Create an API key at platform.openai.com (API keys) and put it in `OPENAI_API_KEY`.
- [ ] Set a monthly budget limit under Settings > Limits as a backstop for the public demo.
- [ ] Leave `AI_PROVIDER=openai`. Anthropic is optional and only needed to compare providers later.

## 3. n8n (self-hosted)
- [ ] Put the public HTTPS URL in `N8N_BASE_URL` (no trailing slash).
- [ ] Generate a long random string for `N8N_WEBHOOK_SECRET`. The dashboard sends it with each request so only it can call the webhooks.
- [ ] In n8n, **Settings > n8n API**, create an API key and put it in `N8N_API_KEY`.
- [ ] Deploy the workflow: `.venv/Scripts/python.exe scripts/build_n8n_workflow.py --deploy`
- [ ] Open **Invoice Processing | 1. Intake + Extraction** in n8n and set three credentials:
  - **Invoice upload** node: Header Auth, Name `x-webhook-secret`, Value = `N8N_WEBHOOK_SECRET`.
  - **Store PDF** node: Supabase API, Host = `SUPABASE_URL`, Service Role Secret = `SUPABASE_SERVICE_ROLE_KEY`.
  - **Extract with AI** node: OpenAI.
- [ ] Run the deploy command again. It copies the Supabase credential to the other Supabase nodes.
- [ ] Activate the workflow, then test: `.venv/Scripts/python.exe scripts/test_n8n_intake.py --reset`
## 4. Slack
- [ ] Use a separate free workspace for demos, so client screen-shares stay clean.
- [ ] At api.slack.com/apps, click **Create New App**, then **Paste a manifest**, and use:
  ```json
  {
    "display_information": { "name": "Invoice Approvals" },
    "features": { "bot_user": { "display_name": "Invoice Approvals", "always_online": true } },
    "oauth_config": { "scopes": { "bot": ["chat:write", "chat:write.public"] } },
    "settings": { "org_deploy_enabled": false, "socket_mode_enabled": false, "token_rotation_enabled": false }
  }
  ```
  Skip the Slack CLI steps it shows afterwards; they're for coded apps.
- [ ] **Install to Workspace**, then copy the bot token (`xoxb-...`) into `SLACK_BOT_TOKEN` and the **Signing Secret** (Basic Information) into `SLACK_SIGNING_SECRET`.
- [ ] Create `#invoice-approvals` and `#invoice-alerts`, and copy their channel IDs into `.env`.
- [ ] In n8n, create a **Slack API** credential with the bot token and pick it on the **Post to Slack** node.
- [ ] After deploying, turn on **Interactivity & Shortcuts** in the Slack app with Request URL `{N8N_BASE_URL}/webhook/invoice-slack-actions`.

## 5. Xero
- [ ] Sign up or log in at xero.com, then open **Try the Demo Company** from my.xero.com.
- [ ] At developer.xero.com, create a **Web app** with redirect URI `{N8N_BASE_URL}/rest/oauth2-credential/callback`. It should show "0 of 5 connections" (the free Starter tier).
- [ ] Copy the Client ID and a generated secret into `.env`.
- [ ] In n8n, create a generic **OAuth2 API** credential, not the built-in Xero one. Apps created after March 2026 must use Xero's newer, narrower permissions, and the built-in credential asks for an old one, which fails with `invalid_scope`.
  - Authorization URL: `https://login.xero.com/identity/connect/authorize`
  - Access Token URL: `https://identity.xero.com/connect/token`
  - Scope: `offline_access accounting.settings accounting.contacts accounting.invoices accounting.attachments`
  - Authentication: Header
- [ ] Connect it to the **Demo Company** and pick it on the **Xero organisations** node in workflow 2.
- [ ] The Demo Company resets about every 28 days. When that happens, reconnect the credential.
- [ ] Optional: the Demo Company only has USD. To post the EUR sample invoice, add EUR under Settings > Currencies in Xero.

## 6. Dashboard
- [ ] Run `supabase/migrations/20261116000000_dashboard_access.sql` (limits what the public key can read).
- [ ] Fill the dashboard settings from the main `.env`: `.venv/Scripts/python.exe scripts/sync_dashboard_env.py` (also creates `IP_HASH_SALT`).
- [ ] `npm install --prefix dashboard`, then `npm run dev --prefix dashboard` and open http://localhost:3000.
- [ ] Activate **Invoice Processing | 3. Cleanup expired uploads** in n8n (hourly).
- [ ] To publish: import the repo on vercel.com with **Root Directory** `dashboard`, and add the variables from `dashboard/.env.example` under Environment Variables.

## After Slack and Xero
- [ ] Run the migrations again if any are new, then deploy: `.venv/Scripts/python.exe scripts/build_n8n_workflow.py --deploy`
- [ ] Activate **Invoice Processing | 2. Approval + Xero**.
- [ ] Test: `scripts/test_n8n_intake.py --reset`, then `scripts/test_approval.py`.

## 7. Email intake

Workflow 4 watches a Gmail label and posts each PDF to the same intake webhook the dashboard uses, so emailed and uploaded invoices follow one path.

**Use a demo mailbox, not a client or personal one.** Anything this workflow picks up ends up in a public demo: the PDF is stored, the data is extracted, and the invoice appears on the dashboard for anyone to read. The label filter means only labelled messages are touched, but the account itself should still be one that holds nothing private.

- [ ] Pick (or create) a Gmail account that holds no real mail.
- [ ] In that account, create a label named `invoices`. Gmail search is case-insensitive, but the name must have no spaces to match `label:invoices`.
- [ ] Optional: add a filter so invoices get the label automatically, for example "has attachment" plus a sender or subject rule. Otherwise label them by hand.
- [ ] In n8n, open **Invoice Processing | 4. Email intake** and pick a **Gmail OAuth2** credential on the **New email** node. Create one if none points at the demo account.
- [ ] Run `scripts/build_n8n_workflow.py --deploy` again so the credential is copied forward on future deploys.
- [ ] Activate the workflow.
- [ ] Test: email a PDF to that account, apply the `invoices` label, and wait up to a minute. It should appear on the dashboard and in `#invoice-approvals`.

The workflow only reads labelled messages, only takes PDF attachments, and leaves the mail untouched. A repeat of the same file is answered with 409 by workflow 1 and is not processed twice. Anything else that fails raises an alert in `#invoice-alerts`.
