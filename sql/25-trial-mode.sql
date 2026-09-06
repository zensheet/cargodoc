-- =============================================
-- GANTI MODEL "PENDING -> ADMIN ACTIVATE" JADI "14-HARI FREE TRIAL"
-- Jalankan SETELAH file 24.
--
-- Model LAMA (file 14): self-signup -> status 'pending' (watermark
-- terus sampai admin klik Activate manual).
--
-- Model BARU: self-signup -> LANGSUNG status 'active' + PDF TANPA
-- watermark, tapi cuma untuk 14 hari (trial_ends_at). Begitu lewat 14
-- hari, watermark otomatis kembali muncul (tanpa perlu ubah `status` --
-- dicek murni dari tanggal) sampai admin konfirmasi pembayaran &
-- meng-klik "Mark as Paid" (trial_ends_at dikosongkan = permanen tanpa
-- watermark).
--
-- Admin-created account (dibuat Developer via Admin Panel) TIDAK ikut
-- trial -- trial_ends_at langsung NULL = permanen aktif dari awal,
-- sama seperti perilaku sebelumnya.
-- =============================================

alter table profiles
  add column if not exists trial_ends_at timestamptz;

-- ---------- handle_new_user: self-signup langsung 'active' + trial 14 hari ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  is_admin_created boolean;
begin
  is_admin_created := coalesce(new.raw_app_meta_data ->> 'created_by', '') = 'admin';

  insert into public.profiles (id, email, role, status, trial_ends_at)
  values (
    new.id, new.email, 'customer',
    'active', -- self-signup MAUPUN admin-created sekarang sama-sama 'active' dari awal
    case when is_admin_created then null else now() + interval '14 days' end
  );

  if not is_admin_created then
    insert into public.user_features (user_id, feature_id, enabled)
    select new.id, f.id, true
    from public.features f
    where f.feature_key in (
      'invoice', 'packing_list', 'purchase_order', 'sales_order',
      'delivery_note', 'shipping_instruction'
    );
  end if;

  return new;
end;
$$;

-- ---------- BACKFILL akun 'pending' yang sudah ada sebelum migration ini ----------
-- Diperlakukan sebagai baru mulai trial HARI INI (bukan dihitung mundur
-- dari created_at mereka dulu) -- lebih adil daripada tiba-tiba langsung
-- "trial expired" begitu migration ini jalan, padahal mereka belum
-- pernah benar-benar menikmati versi tanpa watermark sama sekali.
update profiles
set status = 'active', trial_ends_at = now() + interval '14 days'
where status = 'pending';

-- Akun 'active' yang sudah ada SEBELUM migration ini (baik admin-created
-- atau self-signup lama yang sudah di-Activate manual) -- trial_ends_at
-- dibiarkan NULL (default kolom baru), artinya diperlakukan sebagai
-- "sudah lifetime", TIDAK tiba-tiba kena watermark. Ini keputusan
-- retroaktif yang wajar: mereka sudah lolos proses aktivasi manual lama,
-- tidak perlu ikut hitung mundur 14 hari lagi.

-- RLS TIDAK berubah -- is_account_usable() (status <> 'locked') masih
-- sama persis, trial_ends_at murni logika tampilan/watermark di
-- frontend (js/guard.js accountNeedsWatermark()), bukan gate akses DB.
