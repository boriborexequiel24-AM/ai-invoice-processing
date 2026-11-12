# Setup

Every value below goes in `.env` (copy it from `.env.example`). Never commit `.env`.

## 1. Supabase
- [ ] Create a new project at supabase.com (free tier is fine).
- [ ] In **SQL Editor**, run `supabase/migrations/20261113000000_initial_schema.sql`, then `supabase/seed.sql`.
- [ ] In **Storage**, create a private bucket named `invoices`.
- [ ] From **Project Settings > API**, copy the URL, anon key and service role key into `.env`.

## 2. Anthropic
- [ ] Create an API key at console.anthropic.com and put it in `ANTHROPIC_API_KEY`.
- [ ] Set a monthly spend limit in the console as a backstop for the public demo.

## 3. n8n (self-hosted)
- [ ] Put the public HTTPS URL in `N8N_BASE_URL`.
- [ ] Generate a long random string for `N8N_WEBHOOK_SECRET`. The dashboard sends it with each request so only it can call the webhooks.
- [ ] Add credentials in n8n for Supabase, Anthropic, Slack, Xero and Gmail.

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
