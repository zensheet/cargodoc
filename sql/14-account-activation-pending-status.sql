-- =============================================
-- PHASE 10 — ACCOUNT ACTIVATION (MANUAL PAYMENT GATE), PRD §74
-- Jalankan sekali di Supabase SQL Editor, SETELAH file 13.
--
-- Tujuan: tambah status akun baru "pending" di antara "active" dan
-- "locked". Flow yang diinginkan:
--
--   Guest -> isi Invoice/Packing List -> preview PDF watermark
--   -> Create Account (self-signup) -> status = PENDING
--   -> user bayar / hubungi admin -> admin cek pembayaran
--   -> admin klik "Activate" di admin.html -> status = ACTIVE
--   -> PDF final TANPA watermark
--
-- Beda dengan sebelumnya (13-self-signup-guest-mode.sql): dulu
-- self-signup langsung dapat status 'active' + feature invoice/
-- packing_list ON, dan PDF download langsung tanpa watermark begitu
-- signup selesai. Sekarang self-signup TETAP dapat feature ON (supaya
-- tetap bisa isi & save dokumen -- "no unnecessary restrictions"), tapi
-- statusnya 'pending' dulu, dan PDF-nya TETAP watermark sampai admin
-- meng-klik Activate.
--
-- Akun admin-created (dibuat Developer lewat Admin Panel) TIDAK
-- terpengaruh -- tetap langsung 'active' seperti sebelumnya, karena
-- Developer yang membuatkannya sudah tahu status pembayarannya.
-- =============================================

-- 1. Izinkan status 'pending' di kolom profiles.status.
--    Nama constraint check inline di "SQL Schema.sql" otomatis dibuat
--    Postgres (biasanya "profiles_status_check") -- dicari by kolom
--    supaya migration ini tetap jalan walau namanya beda.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'profiles' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table profiles drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table profiles
  add constraint profiles_status_check
  check (status in ('active', 'pending', 'locked'));

-- 2. handle_new_user: self-signup sekarang mulai dari status 'pending',
--    bukan langsung 'active'. Admin-created tetap 'active' (unchanged).
--    Feature auto-enable untuk self-signup (invoice + packing_list)
--    TIDAK berubah -- tetap ON supaya user bisa langsung pakai app
--    sambil menunggu aktivasi, cuma PDF-nya yang masih watermark.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  is_admin_created boolean;
begin
  is_admin_created := coalesce(new.raw_app_meta_data ->> 'created_by', '') = 'admin';

  insert into public.profiles (id, email, role, status)
  values (
    new.id, new.email, 'customer',
    case when is_admin_created then 'active' else 'pending' end
  );

  if not is_admin_created then
    insert into public.user_features (user_id, feature_id, enabled)
    select new.id, f.id, true
    from public.features f
    where f.feature_key in ('invoice', 'packing_list');
  end if;

  return new;
end;
$$;

-- 3. RLS: insert ke invoices/packing_lists sebelumnya mensyaratkan
--    is_account_active() (status = 'active'). Itu SEKARANG akan memblok
--    akun 'pending' menyimpan dokumen final sama sekali -- padahal PRD
--    §74 cuma mau blok PDF-nya, bukan penyimpanan datanya. Maka insert
--    policy dipindah pakai function baru is_account_usable(), yang cuma
--    menolak status 'locked' (bukan mensyaratkan 'active' persis).
--
--    is_account_active() TETAP ada apa adanya (tidak dihapus) -- masih
--    berguna kalau nanti ada fitur lain yang memang perlu status
--    'active' persis, bukan sekadar "not locked".
create function public.is_account_usable()
returns boolean language sql security definer stable as $$
  select coalesce((select status <> 'locked' from profiles where id = auth.uid()), false);
$$;

drop policy "own insert" on invoices;
create policy "own insert" on invoices for insert with check (
  user_id = auth.uid() and public.is_account_usable() and public.has_feature('invoice'));

drop policy "own insert" on packing_lists;
create policy "own insert" on packing_lists for insert with check (
  user_id = auth.uid() and public.is_account_usable() and public.has_feature('packing_list'));

-- Catatan: policy UPDATE pada invoices/packing_lists (dibuat di loop
-- generik "GENERIC RLS FOR ALL USER-DATA TABLES" di SQL Schema.sql)
-- cuma cek `user_id = auth.uid()`, tanpa is_account_active() -- jadi
-- TIDAK perlu diubah; pending user tetap bisa edit draft/dokumen
-- miliknya sendiri seperti sebelumnya.
