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
- [ ] Slack, Xero and Gmail credentials come in phase 5.

## 4. Slack
- [ ] Create a Slack app at api.slack.com/apps.
- [ ] Bot scopes: `chat:write`, `chat:write.public`.
- [ ] Turn on **Interactivity** and set the Request URL to the n8n approval webhook (we'll make it in phase 5).
- [ ] Install to your workspace, copy the bot token and signing secret.
- [ ] Create `#invoice-approvals` and `#invoice-alerts` channels and copy their IDs.

## 5. Xero
- [ ] Turn on the **Demo Company** in your Xero account.
- [ ] Create an app at developer.xero.com (Web app), with the redirect URL from your n8n Xero credential.
- [ ] Copy the client ID and secret, connect the Demo Company in n8n, and note its tenant ID.

## 6. Gmail intake
- [ ] Use a separate Gmail account for the demo inbox, not your personal one.
- [ ] Create a label named `invoices` and a filter that applies it to messages with PDF attachments.
