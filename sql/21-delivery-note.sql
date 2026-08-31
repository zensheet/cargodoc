-- =============================================
-- DELIVERY NOTE (DN) — lanjutan roadmap dokumen shipping
-- (setelah Shipping Instruction file 20).
-- DN adalah bukti serah-terima barang secara fisik: dibawa bersama
-- barang saat dikirim, ditandatangani penerima sebagai bukti barang
-- sudah diterima. TIDAK menampilkan harga (bukan dokumen komersial,
-- sama seperti Shipping Instruction) -- cuma deskripsi & jumlah barang.
-- Pola RLS 1:1 sama dengan purchase_orders/sales_orders/shipping_instructions.
-- Jalankan SETELAH file 20 (butuh is_developer(), is_account_usable(),
-- has_feature() dari migration sebelumnya).
-- =============================================

-- ---------- TABLES ----------
create table if not exists delivery_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,

  dn_number text not null,
  dn_date date default current_date,
  reference_number text, -- nomor invoice/SO/PO terkait (kalau ada)
  notes text,

  -- Delivery (kendaraan/pengiriman)
  driver_name text,
  vehicle_number text,
  vehicle_type text,

  -- From (pengirim/gudang -- snapshot, pola sama dengan shipper di dokumen lain)
  from_name text, from_pic text, from_address text,
  from_city text, from_country text,
  from_phone text, from_email text,

  -- Deliver To (penerima)
  deliver_to_name text, deliver_to_pic text, deliver_to_address text,
  deliver_to_city text, deliver_to_country text,
  deliver_to_phone text, deliver_to_email text,

  -- Bukti terima (diisi manual setelah barang diterima -- opsional)
  received_by_name text,
  received_date date,

  status text default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (user_id, dn_number)
);

create table if not exists delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  delivery_note_id uuid references delivery_notes on delete cascade,
  product_id uuid references products,
  description text, sku text,
  package_count numeric, package_type text,
  quantity numeric, unit text,
  created_at timestamptz default now()
);

create index if not exists delivery_notes_user_idx on delivery_notes (user_id);
create index if not exists delivery_note_items_dn_idx on delivery_note_items (delivery_note_id);

-- ---------- RLS ----------
-- Pola persis purchase_orders/sales_orders/shipping_instructions:
-- select/update/delete cukup kepemilikan (user_id = auth.uid()), insert
-- butuh akun tidak locked + feature 'delivery_note' aktif.
alter table delivery_notes enable row level security;

drop policy if exists "own select" on delivery_notes;
create policy "own select" on delivery_notes for select using (
  user_id = auth.uid() or public.is_developer());

drop policy if exists "own insert" on delivery_notes;
create policy "own insert" on delivery_notes for insert with check (
  user_id = auth.uid() and public.is_account_usable() and public.has_feature('delivery_note'));

drop policy if exists "own update" on delivery_notes;
create policy "own update" on delivery_notes for update using (
  user_id = auth.uid());

drop policy if exists "own delete" on delivery_notes;
create policy "own delete" on delivery_notes for delete using (
  user_id = auth.uid());

alter table delivery_note_items enable row level security;

drop policy if exists "own select" on delivery_note_items;
create policy "own select" on delivery_note_items for select using (
  exists(select 1 from delivery_notes dn where dn.id = delivery_note_id and dn.user_id = auth.uid())
  or public.is_developer());

drop policy if exists "own insert" on delivery_note_items;
create policy "own insert" on delivery_note_items for insert with check (
  exists(select 1 from delivery_notes dn where dn.id = delivery_note_id and dn.user_id = auth.uid()));

drop policy if exists "own update" on delivery_note_items;
create policy "own update" on delivery_note_items for update using (
  exists(select 1 from delivery_notes dn where dn.id = delivery_note_id and dn.user_id = auth.uid()));

drop policy if exists "own delete" on delivery_note_items;
create policy "own delete" on delivery_note_items for delete using (
  exists(select 1 from delivery_notes dn where dn.id = delivery_note_id and dn.user_id = auth.uid()));

-- ---------- FEATURE ----------
-- Belum pernah ada baris 'delivery_note' di tabel features sama sekali --
-- INSERT baru (sama seperti sales_order/shipping_instruction). active=true
-- langsung. TIDAK auto-enable untuk self-signup -- admin enable manual per
-- customer di admin.html.
insert into features (feature_key, feature_name, active)
values ('delivery_note', 'Delivery Note', true)
on conflict (feature_key) do update set active = true;
