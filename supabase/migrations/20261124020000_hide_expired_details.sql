-- An expired upload's line items and history are now hidden with the invoice.
--
-- The invoice itself disappears from the public key the moment it expires
-- (20261116000000), but these two tables could still be read until the hourly
-- cleanup deleted them. The history includes the file name.
--
-- The check goes through the invoices table, so whatever is hidden there is
-- hidden here too. The server (service role) still sees everything.

drop policy if exists "public read" on public.invoice_line_items;
create policy "public read" on public.invoice_line_items
  for select using (exists (select 1 from public.invoices i where i.id = invoice_id));

drop policy if exists "public read" on public.invoice_events;
create policy "public read" on public.invoice_events
  for select using (exists (select 1 from public.invoices i where i.id = invoice_id));
