-- =============================================
-- SHIPPING INSTRUCTION (SI) — lanjutan roadmap dokumen shipping
-- (setelah Purchase Order file 17, Sales Order file 18).
-- SI adalah instruksi dari Shipper ke Forwarder/Carrier tentang
-- bagaimana sebuah shipment harus diproses & di-dokumentasikan
-- (dipakai carrier untuk menerbitkan Bill of Lading).
-- Pola RLS 1:1 sama dengan purchase_orders/sales_orders.
-- Jalankan SETELAH file 18 (butuh is_developer(), is_account_usable(),
-- has_feature() dari migration sebelumnya).
-- =============================================

-- ---------- TABLES ----------
create table if not exists shipping_instructions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,

  si_number text not null,
  si_date date default current_date,
  reference_number text, -- PO/SO/invoice number terkait (kalau ada)
  notes text,

  -- Booking & Carrier
  booking_number text,
  carrier_name text,
  vessel_voyage text,
  mode_of_transport text, -- Sea / Air / Land
  shipment_mode text,     -- FCL / LCL / Air / etc
  container_type text,
  container_count integer,

  -- Routing
  port_of_loading text,
  port_of_discharge text,
  place_of_delivery text,
  final_destination text,

  -- Terms
  freight_terms text,   -- Prepaid / Collect
  incoterms text,
  bl_type text,          -- Original B/L / Seaway Bill / Telex Release
  bl_originals_count integer,

  -- Shipper (snapshot, pola sama dengan invoices/purchase_orders)
  shipper_name text, shipper_pic text, shipper_address text,
  shipper_city text, shipper_country text,
  shipper_phone text, shipper_email text,

  -- Consignee
  consignee_name text, consignee_pic text, consignee_address text,
  consignee_city text, consignee_country text,
  consignee_phone text, consignee_email text,

  -- Notify Party (opsional -- kalau kosong berarti sama dengan consignee)
  notify_party_name text, notify_party_pic text, notify_party_address text,
  notify_party_city text, notify_party_country text,
  notify_party_phone text, notify_party_email text,

  status text default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (user_id, si_number)
);

create table if not exists shipping_instruction_items (
  id uuid primary key default gen_random_uuid(),
  shipping_instruction_id uuid references shipping_instructions on delete cascade,
  product_id uuid references products,
  description text, hs_code text,
  package_count numeric, package_type text,
  quantity numeric, unit text,
  gross_weight numeric, net_weight numeric, measurement numeric, -- CBM
  created_at timestamptz default now()
);

create index if not exists shipping_instructions_user_idx on shipping_instructions (user_id);
create index if not exists shipping_instruction_items_si_idx on shipping_instruction_items (shipping_instruction_id);

-- ---------- RLS ----------
-- Pola persis purchase_orders/sales_orders: select/update/delete cukup
-- kepemilikan (user_id = auth.uid()), insert butuh akun tidak locked +
-- feature 'shipping_instruction' aktif.
alter table shipping_instructions enable row level security;

drop policy if exists "own select" on shipping_instructions;
create policy "own select" on shipping_instructions for select using (
  user_id = auth.uid() or public.is_developer());

drop policy if exists "own insert" on shipping_instructions;
create policy "own insert" on shipping_instructions for insert with check (
  user_id = auth.uid() and public.is_account_usable() and public.has_feature('shipping_instruction'));

drop policy if exists "own update" on shipping_instructions;
create policy "own update" on shipping_instructions for update using (
  user_id = auth.uid());

drop policy if exists "own delete" on shipping_instructions;
create policy "own delete" on shipping_instructions for delete using (
  user_id = auth.uid());

alter table shipping_instruction_items enable row level security;

drop policy if exists "own select" on shipping_instruction_items;
create policy "own select" on shipping_instruction_items for select using (
  exists(select 1 from shipping_instructions si where si.id = shipping_instruction_id and si.user_id = auth.uid())
  or public.is_developer());

drop policy if exists "own insert" on shipping_instruction_items;
create policy "own insert" on shipping_instruction_items for insert with check (
  exists(select 1 from shipping_instructions si where si.id = shipping_instruction_id and si.user_id = auth.uid()));

drop policy if exists "own update" on shipping_instruction_items;
create policy "own update" on shipping_instruction_items for update using (
  exists(select 1 from shipping_instructions si where si.id = shipping_instruction_id and si.user_id = auth.uid()));

drop policy if exists "own delete" on shipping_instruction_items;
create policy "own delete" on shipping_instruction_items for delete using (
  exists(select 1 from shipping_instructions si where si.id = shipping_instruction_id and si.user_id = auth.uid()));

-- ---------- FEATURE ----------
-- Belum pernah ada baris 'shipping_instruction' di tabel features sama
-- sekali -- INSERT baru (sama seperti sales_order di file 18). active=true
-- langsung. TIDAK auto-enable untuk self-signup -- admin enable manual per
-- customer di admin.html (lihat handle_new_user(), yang cuma auto-enable
-- invoice + packing_list, dan sekarang purchase_order + sales_order kalau
-- file 19 sudah dijalankan).
insert into features (feature_key, feature_name, active)
values ('shipping_instruction', 'Shipping Instruction', true)
on conflict (feature_key) do update set active = true;
