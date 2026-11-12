-- Demo data: fake vendors and purchase orders for the sample invoices.
-- All names are made up. See sample-invoices/expected.json for which
-- invoice uses which PO.

insert into vendors (name, email, default_currency) values
  ('Northwind Office Supply', 'billing@northwind-office.example', 'USD'),
  ('Brightline Logistics',    'ar@brightline-logistics.example', 'USD'),
  ('Cedar & Pine Cleaning',   'accounts@cedarpine.example',      'USD'),
  ('Atlas Cloud Hosting',     'invoices@atlascloud.example',     'USD'),
  ('Harbor Print Co.',        'hello@harborprint.example',       'USD'),
  ('Lindqvist Design Studio', 'faktura@lindqvist.example',       'EUR');

insert into purchase_orders (po_number, vendor_id, amount, currency) values
  ('PO-1001', (select id from vendors where name = 'Northwind Office Supply'), 1240.50, 'USD'),
  ('PO-1002', (select id from vendors where name = 'Brightline Logistics'),    3875.00, 'USD'),
  ('PO-1003', (select id from vendors where name = 'Cedar & Pine Cleaning'),    950.00, 'USD'),
  ('PO-1004', (select id from vendors where name = 'Atlas Cloud Hosting'),      612.80, 'USD'),
  ('PO-1005', (select id from vendors where name = 'Harbor Print Co.'),        2210.00, 'USD'),
  ('PO-1006', (select id from vendors where name = 'Cedar & Pine Cleaning'),    480.00, 'USD'),
  ('PO-1007', (select id from vendors where name = 'Brightline Logistics'),    1200.00, 'USD'),
  ('PO-1008', (select id from vendors where name = 'Atlas Cloud Hosting'),     1089.00, 'USD'),
  ('PO-1009', (select id from vendors where name = 'Harbor Print Co.'),        11378.88, 'USD'),
  ('PO-1010', (select id from vendors where name = 'Lindqvist Design Studio'), 2904.00, 'EUR');
