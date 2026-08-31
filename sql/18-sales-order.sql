-- =============================================
-- SALES ORDER (lanjutan dari Purchase Order — file 17)
-- Kebalikan dari Purchase Order: PO = kita BELI dari Supplier,
-- SO = kita JUAL ke Customer. Field & pola RLS 1:1 sama dengan
-- purchase_orders/purchase_order_items, cuma "Supplier" -> "Customer"
-- dan "Deliver To" -> "Ship To".
-- Jalankan SETELAH file 17 (butuh is_developer(), is_account_usable(),
-- has_feature() dari migration sebelumnya, pola sama persis).
-- =============================================

-- ---------- TABLES ----------
create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,

  so_number text not null,
  so_date date default current_date,
  currency text default 'USD',
  payment_terms text,
  delivery_terms text,
  expected_delivery_date date,
  reference_number text, -- nomor PO dari customer (kalau ada)
  notes text,

  -- Customer (snapshot, sama pola dengan shipper/receiver di invoices)
  customer_name text, customer_pic text, customer_address text,
  customer_city text, customer_country text,
  customer_phone text, customer_email text,

  -- Ship To (opsional -- kalau kosong berarti sama dengan alamat customer)
  ship_to_name text, ship_to_pic text, ship_to_address text,
  ship_to_city text, ship_to_country text,
  ship_to_phone text, ship_to_email text,

  subtotal numeric default 0,
  other_charges numeric default 0,
  discount numeric default 0,
  grand_total numeric default 0,

  status text default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (user_id, so_number)
);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references sales_orders on delete cascade,
  product_id uuid references products,
  description text, sku text,
  quantity numeric, unit text, unit_price numeric, amount numeric,
  created_at timestamptz default now()
);

create index if not exists sales_orders_user_idx on sales_orders (user_id);
create index if not exists sales_order_items_so_idx on sales_order_items (sales_order_id);

-- ---------- RLS ----------
-- Pola persis purchase_orders/purchase_order_items: select/update/delete
-- cukup kepemilikan (user_id = auth.uid()), insert butuh akun tidak locked
-- + feature 'sales_order' aktif.
alter table sales_orders enable row level security;

drop policy if exists "own select" on sales_orders;
create policy "own select" on sales_orders for select using (
  user_id = auth.uid() or public.is_developer());

drop policy if exists "own insert" on sales_orders;
create policy "own insert" on sales_orders for insert with check (
  user_id = auth.uid() and public.is_account_usable() and public.has_feature('sales_order'));

drop policy if exists "own update" on sales_orders;
create policy "own update" on sales_orders for update using (
  user_id = auth.uid());

drop policy if exists "own delete" on sales_orders;
create policy "own delete" on sales_orders for delete using (
  user_id = auth.uid());

alter table sales_order_items enable row level security;

drop policy if exists "own select" on sales_order_items;
create policy "own select" on sales_order_items for select using (
  exists(select 1 from sales_orders so where so.id = sales_order_id and so.user_id = auth.uid())
  or public.is_developer());

drop policy if exists "own insert" on sales_order_items;
create policy "own insert" on sales_order_items for insert with check (
  exists(select 1 from sales_orders so where so.id = sales_order_id and so.user_id = auth.uid()));

drop policy if exists "own update" on sales_order_items;
create policy "own update" on sales_order_items for update using (
  exists(select 1 from sales_orders so where so.id = sales_order_id and so.user_id = auth.uid()));

drop policy if exists "own delete" on sales_order_items;
create policy "own delete" on sales_order_items for delete using (
  exists(select 1 from sales_orders so where so.id = sales_order_id and so.user_id = auth.uid()));

-- ---------- FEATURE ----------
-- Beda dari purchase_order (yang sudah ada di seed SQL Schema.sql dari
-- awal dengan active=false), 'sales_order' belum pernah ada baris-nya
-- sama sekali di tabel features -- jadi INSERT baru, bukan UPDATE.
-- active=true langsung (fitur ini sudah jadi/siap dipakai). Sama seperti
-- purchase_order, TIDAK auto-enable untuk self-signup -- admin enable
-- manual per customer di admin.html (lihat handle_new_user(), yang cuma
-- auto-enable invoice + packing_list).
insert into features (feature_key, feature_name, active)
values ('sales_order', 'Sales Order', true)
on conflict (feature_key) do update set active = true;
