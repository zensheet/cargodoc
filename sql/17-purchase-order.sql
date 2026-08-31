-- =============================================
-- PURCHASE ORDER (PRD roadmap #4 — Sales/Order)
-- Jalankan SETELAH file 14 (butuh is_developer(), is_account_usable(),
-- has_feature() dari migration sebelumnya).
-- =============================================

-- ---------- TABLES ----------
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,

  po_number text not null,
  po_date date default current_date,
  currency text default 'USD',
  payment_terms text,
  delivery_terms text,
  expected_delivery_date date,
  reference_number text,
  notes text,

  -- Supplier (snapshot, sama pola dengan shipper/receiver di invoices)
  supplier_name text, supplier_pic text, supplier_address text,
  supplier_city text, supplier_country text,
  supplier_phone text, supplier_email text,

  -- Deliver To (opsional -- kalau kosong berarti dikirim ke alamat sendiri)
  deliver_to_name text, deliver_to_pic text, deliver_to_address text,
  deliver_to_city text, deliver_to_country text,
  deliver_to_phone text, deliver_to_email text,

  subtotal numeric default 0,
  other_charges numeric default 0,
  discount numeric default 0,
  grand_total numeric default 0,

  status text default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (user_id, po_number)
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references purchase_orders on delete cascade,
  product_id uuid references products,
  description text, sku text,
  quantity numeric, unit text, unit_price numeric, amount numeric,
  created_at timestamptz default now()
);

create index if not exists purchase_orders_user_idx on purchase_orders (user_id);
create index if not exists purchase_order_items_po_idx on purchase_order_items (purchase_order_id);

-- ---------- RLS ----------
-- Sama persis pola invoices/invoice_items (lihat SQL Schema.sql +
-- 14-account-activation-pending-status.sql): select/update/delete cukup
-- kepemilikan (user_id = auth.uid()), insert butuh akun tidak locked +
-- feature 'purchase_order' aktif.
alter table purchase_orders enable row level security;

drop policy if exists "own select" on purchase_orders;
create policy "own select" on purchase_orders for select using (
  user_id = auth.uid() or public.is_developer());

drop policy if exists "own insert" on purchase_orders;
create policy "own insert" on purchase_orders for insert with check (
  user_id = auth.uid() and public.is_account_usable() and public.has_feature('purchase_order'));

drop policy if exists "own update" on purchase_orders;
create policy "own update" on purchase_orders for update using (
  user_id = auth.uid());

drop policy if exists "own delete" on purchase_orders;
create policy "own delete" on purchase_orders for delete using (
  user_id = auth.uid());

alter table purchase_order_items enable row level security;

drop policy if exists "own select" on purchase_order_items;
create policy "own select" on purchase_order_items for select using (
  exists(select 1 from purchase_orders po where po.id = purchase_order_id and po.user_id = auth.uid())
  or public.is_developer());

drop policy if exists "own insert" on purchase_order_items;
create policy "own insert" on purchase_order_items for insert with check (
  exists(select 1 from purchase_orders po where po.id = purchase_order_id and po.user_id = auth.uid()));

drop policy if exists "own update" on purchase_order_items;
create policy "own update" on purchase_order_items for update using (
  exists(select 1 from purchase_orders po where po.id = purchase_order_id and po.user_id = auth.uid()));

drop policy if exists "own delete" on purchase_order_items;
create policy "own delete" on purchase_order_items for delete using (
  exists(select 1 from purchase_orders po where po.id = purchase_order_id and po.user_id = auth.uid()));

-- ---------- AKTIFKAN FEATURE ----------
-- Feature 'purchase_order' sudah ada di seed (SQL Schema.sql) tapi
-- active=false ("coming soon"). Sekarang beneran dibangun -> aktifkan.
-- Catatan: 'active' di sini artinya fitur SIAP DIPAKAI (bisa muncul di
-- has_feature()) -- bukan berarti semua user otomatis dapat akses; itu
-- tetap diatur per-user lewat user_features (dan self-signup TIDAK
-- otomatis dapat 'purchase_order' -- lihat handle_new_user(), yang cuma
-- auto-enable invoice + packing_list; admin enable purchase_order manual
-- kalau perlu per pelanggan).
update features set active = true where feature_key = 'purchase_order';
