-- Phase 4: validation.
--
-- validate_invoice(id) checks an extracted invoice and sets its final status:
--   flagged             one or more checks failed (see invoices.flags)
--   needs_review        checks passed, but the AI was unsure about a field
--   ready_for_approval  everything checks out
--
-- The rules live in the database so n8n, the dashboard and scripts all use
-- the same logic, and an invoice can be re-checked any time (for example
-- after adding a missing vendor or PO).

-- Compare names and numbers ignoring case, spaces and punctuation.
create or replace function public.normalize_key(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9]', '', 'g')), '');
$$;

create or replace function public.validate_invoice(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Tolerances
  c_money_tolerance  constant numeric := 0.01;  -- rounding allowed in the math checks
  c_po_tolerance     constant numeric := 0.02;  -- invoice may exceed its PO by up to 2%
  c_min_confidence   constant numeric := 0.80;  -- below this, a person should double check

  inv             invoices%rowtype;
  v_vendor        vendors%rowtype;
  v_vendor_id     uuid;
  v_po            purchase_orders%rowtype;
  v_po_id         uuid;
  v_dup           invoices%rowtype;
  v_flags         jsonb := '[]'::jsonb;
  v_missing       text[] := '{}';
  v_line_sum      numeric;
  v_line_count    int;
  v_min_conf      numeric;
  v_unsure_fields text;
  v_status        invoice_status;
begin
  select * into inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;
  if inv.status not in ('extracted', 'needs_review', 'flagged', 'ready_for_approval') then
    raise exception 'Invoice % has status %, which cannot be validated', p_invoice_id, inv.status;
  end if;

  -- 1. Required fields
  if inv.vendor_name_raw is null then v_missing := array_append(v_missing, 'vendor'); end if;
  if inv.invoice_number is null then v_missing := array_append(v_missing, 'invoice number'); end if;
  if inv.total is null then v_missing := array_append(v_missing, 'total'); end if;
  if cardinality(v_missing) > 0 then
    v_flags := v_flags || jsonb_build_object(
      'code', 'missing_required_field',
      'message', 'Could not find the ' || array_to_string(v_missing, ', ') || ' on the invoice.');
  end if;

  -- 2. Known vendor (by name, or by the email printed on the invoice)
  select * into v_vendor
  from vendors
  where normalize_key(name) = normalize_key(inv.vendor_name_raw)
     or (email is not null and lower(email) = lower(inv.raw_extraction ->> 'vendor_email'))
  order by (normalize_key(name) = normalize_key(inv.vendor_name_raw)) desc
  limit 1;
  if found then
    v_vendor_id := v_vendor.id;
  elsif inv.vendor_name_raw is not null then
    v_flags := v_flags || jsonb_build_object(
      'code', 'unknown_vendor',
      'message', format('"%s" is not in the vendor list.', inv.vendor_name_raw));
  end if;

  -- 3. Line items add up to the subtotal
  select coalesce(sum(amount), 0), count(*) into v_line_sum, v_line_count
  from invoice_line_items where invoice_id = p_invoice_id;
  if v_line_count > 0 and inv.subtotal is not null
     and abs(v_line_sum - inv.subtotal) > c_money_tolerance then
    v_flags := v_flags || jsonb_build_object(
      'code', 'line_items_mismatch',
      'message', format('Line items add up to %s, but the subtotal says %s.',
                        to_char(v_line_sum, 'FM999,999,990.00'), to_char(inv.subtotal, 'FM999,999,990.00')));
  end if;

  -- 4. Subtotal plus tax equals the total
  if inv.subtotal is not null and inv.total is not null
     and abs(inv.subtotal + coalesce(inv.tax, 0) - inv.total) > c_money_tolerance then
    v_flags := v_flags || jsonb_build_object(
      'code', 'total_mismatch',
      'message', format('Subtotal %s plus tax %s is %s, but the total says %s.',
                        to_char(inv.subtotal, 'FM999,999,990.00'),
                        to_char(coalesce(inv.tax, 0), 'FM999,999,990.00'),
                        to_char(inv.subtotal + coalesce(inv.tax, 0), 'FM999,999,990.00'),
                        to_char(inv.total, 'FM999,999,990.00')));
  end if;

  -- 5. Duplicate: same vendor and invoice number received earlier
  if inv.invoice_number is not null then
    select * into v_dup
    from invoices o
    where o.id <> inv.id
      and o.status not in ('failed', 'rejected')
      and o.created_at < inv.created_at
      and normalize_key(o.invoice_number) = normalize_key(inv.invoice_number)
      and (o.vendor_id = v_vendor_id or normalize_key(o.vendor_name_raw) = normalize_key(inv.vendor_name_raw))
    order by o.created_at
    limit 1;
    if found then
      v_flags := v_flags || jsonb_build_object(
        'code', 'duplicate',
        'message', format('Invoice %s from %s was already received on %s.',
                          inv.invoice_number, coalesce(v_vendor.name, inv.vendor_name_raw),
                          to_char(v_dup.created_at, 'Mon DD, YYYY')),
        'duplicate_of', v_dup.id);
    end if;
  end if;

  -- 6. Purchase order
  if normalize_key(inv.po_number) is null then
    v_flags := v_flags || jsonb_build_object('code', 'missing_po', 'message', 'There is no PO number on the invoice.');
  else
    select * into v_po from purchase_orders where normalize_key(po_number) = normalize_key(inv.po_number);
    if not found then
      v_flags := v_flags || jsonb_build_object(
        'code', 'po_not_found', 'message', format('PO %s does not exist.', inv.po_number));
    else
      v_po_id := v_po.id;
      if v_po.status = 'closed' then
        v_flags := v_flags || jsonb_build_object(
          'code', 'po_closed', 'message', format('PO %s is already closed.', v_po.po_number));
      end if;
      if v_vendor_id is not null and v_po.vendor_id <> v_vendor_id then
        v_flags := v_flags || jsonb_build_object(
          'code', 'po_vendor_mismatch', 'message', format('PO %s belongs to a different vendor.', v_po.po_number));
      end if;
      if inv.currency is not null and inv.currency <> v_po.currency then
        v_flags := v_flags || jsonb_build_object(
          'code', 'currency_mismatch',
          'message', format('Invoice is in %s, but PO %s is in %s.', inv.currency, v_po.po_number, v_po.currency));
      end if;
      if inv.total is not null and inv.total > v_po.amount * (1 + c_po_tolerance) then
        v_flags := v_flags || jsonb_build_object(
          'code', 'po_amount_exceeded',
          'message', format('Total %s is %s%% over PO %s (%s).',
                            to_char(inv.total, 'FM999,999,990.00'),
                            round((inv.total / nullif(v_po.amount, 0) - 1) * 100),
                            v_po.po_number, to_char(v_po.amount, 'FM999,999,990.00')));
      end if;
    end if;
  end if;

  -- 7. AI confidence
  select min(value::numeric), string_agg(key, ', ') filter (where value::numeric < c_min_confidence)
  into v_min_conf, v_unsure_fields
  from jsonb_each_text(coalesce(inv.confidence, '{}'::jsonb));

  -- Final status
  v_status := case
    when jsonb_array_length(v_flags) > 0 then 'flagged'
    when v_min_conf is null or v_min_conf < c_min_confidence then 'needs_review'
    else 'ready_for_approval'
  end;

  update invoices
  set vendor_id = v_vendor_id,
      purchase_order_id = v_po_id,
      flags = v_flags,
      status = v_status
  where id = p_invoice_id;

  insert into invoice_events (invoice_id, step, actor, details)
  values (p_invoice_id, 'validated', 'system', jsonb_build_object(
    'status', v_status,
    'flags', v_flags,
    'min_confidence', v_min_conf,
    'unsure_fields', v_unsure_fields));

  return jsonb_build_object(
    'invoice_id', p_invoice_id,
    'status', v_status,
    'flags', v_flags,
    'min_confidence', v_min_conf,
    'unsure_fields', v_unsure_fields);
end;
$$;

-- Only the server (service role) may run validation. The public dashboard key may not.
revoke execute on function public.validate_invoice(uuid) from public, anon, authenticated;
grant execute on function public.validate_invoice(uuid) to service_role;
