-- Phase 6: what the public dashboard key (anon) may read.
--
-- The dashboard reads with the public key. It only needs display columns,
-- so internal ones stay server-only: file_path, file_hash, raw_extraction,
-- uploader_ip_hash and the Slack message IDs.

revoke select on public.invoices from anon, authenticated;
grant select (
  id, source, status, file_name,
  vendor_id, vendor_name_raw, invoice_number, invoice_date, due_date,
  currency, subtotal, tax, total, po_number, purchase_order_id,
  confidence, flags, xero_bill_id, xero_url, decided_by, decided_at,
  expires_at, created_at, updated_at
) on public.invoices to anon, authenticated;

-- Hide expired demo uploads right away, even before the cleanup job deletes them.
drop policy if exists "public read" on public.invoices;
create policy "public read" on public.invoices
  for select using (expires_at is null or expires_at > now());

-- Rate limiting for public uploads looks up recent uploads by hashed IP.
create index if not exists invoices_uploader_idx on public.invoices (uploader_ip_hash, created_at)
  where uploader_ip_hash is not null;
