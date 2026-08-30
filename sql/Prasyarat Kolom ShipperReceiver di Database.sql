-- TAMBAHAN schema: shipper/receiver snapshot di invoices
alter table invoices
  add column if not exists shipper_name text,
  add column if not exists shipper_pic text,
  add column if not exists shipper_address text,
  add column if not exists shipper_city text,
  add column if not exists shipper_country text,
  add column if not exists shipper_phone text,
  add column if not exists shipper_email text,
  add column if not exists receiver_name text,
  add column if not exists receiver_pic text,
  add column if not exists receiver_address text,
  add column if not exists receiver_city text,
  add column if not exists receiver_country text,
  add column if not exists receiver_phone text,
  add column if not exists receiver_email text;
