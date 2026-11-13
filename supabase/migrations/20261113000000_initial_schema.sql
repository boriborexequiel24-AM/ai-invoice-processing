-- Initial schema for the AI Invoice Processing System.
-- Tables: vendors, purchase_orders, invoices, invoice_line_items, invoice_events.

create extension if not exists "pgcrypto";

-- Invoice lifecycle statuses
create type invoice_status as enum (
  'received',            -- file stored, not processed yet
  'extracting',          -- sent to the AI model
  'ready_for_approval',  -- all checks passed
  'needs_review',        -- low confidence on one or more fields
  'flagged',             -- failed one or more checks
  'approved',
  'rejected',
  'posted',              -- bill created in Xero
  'failed'               -- processing error, see events
);

create type invoice_source as enum ('email', 'upload', 'sample');

-- Vendors the business already knows
create table vendors (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  email            text,
  default_currency char(3) not null default 'USD',
  created_at       timestamptz not null default now()
);

-- Purchase orders that invoices get matched against
create table purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  po_number   text not null unique,
  vendor_id   uuid not null references vendors(id),
  amount      numeric(12,2) not null check (amount >= 0),
  currency    char(3) not null default 'USD',
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now()
);

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  source            invoice_source not null,
  status            invoice_status not null default 'received',

  -- File
  file_path         text not null,          -- path in Supabase Storage
  file_hash         text not null unique,   -- SHA-256, stops the same file being processed twice
  file_name         text,

  -- Extracted fields
  vendor_id         uuid references vendors(id),
  vendor_name_raw   text,                   -- vendor name exactly as read from the invoice
  invoice_number    text,
  invoice_date      date,
  due_date          date,
  currency          char(3),
  subtotal          numeric(12,2),
  tax               numeric(12,2),
  total             numeric(12,2),
  po_number         text,
  purchase_order_id uuid references purchase_orders(id),

  -- AI output and checks
  confidence        jsonb,                  -- per-field scores, e.g. {"total": 0.98}
  raw_extraction    jsonb,                  -- full AI response, for debugging
  flags             jsonb not null default '[]'::jsonb,  -- e.g. [{"code": "math_mismatch", "message": "..."}]

  -- Xero
  xero_bill_id      text,

  -- Public demo uploads
  uploader_ip_hash  text,                   -- hashed, used for rate limiting
  expires_at        timestamptz,            -- visitor uploads are deleted after this time

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Duplicate check: same vendor and invoice number
create index invoices_vendor_number_idx on invoices (vendor_id, invoice_number);
create index invoices_status_idx on invoices (status);
create index invoices_created_at_idx on invoices (created_at desc);
create index invoices_expires_at_idx on invoices (expires_at) where expires_at is not null;

create table invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  position    int not null,
  description text not null,
  quantity    numeric(12,3) not null default 1,
  unit_price  numeric(12,2),
  amount      numeric(12,2) not null
);

create index invoice_line_items_invoice_idx on invoice_line_items (invoice_id);

-- Audit trail: one row for every step
create table invoice_events (
  id          bigint generated always as identity primary key,
  invoice_id  uuid not null references invoices(id) on delete cascade,
  step        text not null,     -- e.g. 'received', 'extracted', 'validated', 'approved', 'posted', 'error'
  actor       text not null,     -- 'system', 'ai', or a Slack/dashboard user
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index invoice_events_invoice_idx on invoice_events (invoice_id, created_at);

-- Keep updated_at current
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger invoices_set_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- Row level security: the dashboard reads with the anon key, all writes go
-- through n8n or server code with the service role key.
alter table vendors            enable row level security;
alter table purchase_orders    enable row level security;
alter table invoices           enable row level security;
alter table invoice_line_items enable row level security;
alter table invoice_events     enable row level security;

create policy "public read" on vendors            for select using (true);
create policy "public read" on purchase_orders    for select using (true);
create policy "public read" on invoices           for select using (true);
create policy "public read" on invoice_line_items for select using (true);
create policy "public read" on invoice_events     for select using (true);
