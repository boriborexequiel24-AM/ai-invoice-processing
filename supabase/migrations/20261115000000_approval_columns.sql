-- Phase 5: Slack approval and Xero posting.

-- Where the approval message lives in Slack, so it can be updated after a decision.
alter table invoices add column if not exists slack_channel    text;
alter table invoices add column if not exists slack_message_ts text;

-- Who approved or rejected the invoice, and when.
alter table invoices add column if not exists decided_by text;
alter table invoices add column if not exists decided_at timestamptz;

-- Link to the bill in Xero once it's posted.
alter table invoices add column if not exists xero_url text;
