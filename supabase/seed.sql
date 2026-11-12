-- Demo data: fake vendors and purchase orders for the sample invoices.
-- All names are made up.

insert into vendors (name, email, default_currency) values
  ('Northwind Office Supply', 'billing@northwind-office.example', 'USD'),
  ('Brightline Logistics',    'ar@brightline-logistics.example', 'USD'),
  ('Cedar & Pine Cleaning',   'accounts@cedarpine.example',      'USD'),
  ('Atlas Cloud Hosting',     'invoices@atlascloud.example',     'USD'),
  ('Harbor Print Co.',        'hello@harborprint.example',       'USD');

insert into purchase_orders (po_number, vendor_id, amount, currency) values
  ('PO-1001', (select id from vendors where name = 'Northwind Office Supply'), 1240.50, 'USD'),
  ('PO-1002', (select id from vendors where name = 'Brightline Logistics'),    3875.00, 'USD'),
  ('PO-1003', (select id from vendors where name = 'Cedar & Pine Cleaning'),    950.00, 'USD'),
  ('PO-1004', (select id from vendors where name = 'Atlas Cloud Hosting'),      612.80, 'USD'),
  ('PO-1005', (select id from vendors where name = 'Harbor Print Co.'),        2210.00, 'USD');
