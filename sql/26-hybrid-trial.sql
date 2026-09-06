-- =============================================
-- HYBRID TRIAL: 7 HARI *ATAU* 5 DOKUMEN (mana yang tercapai duluan)
-- Jalankan SETELAH file 25.
--
-- Model LAMA (file 25): trial 14 hari, TANPA batas jumlah dokumen --
-- artinya user bisa generate ratusan dokumen gratis selama 14 hari itu.
--
-- Model BARU: trial dipersingkat jadi 7 hari, DAN dibatasi 5 dokumen
-- final (gabungan SEMUA jenis dokumen -- PO+SO+Invoice/PI+PL+SI+DN
-- dihitung satu kolam yang sama, BUKAN per jenis). Watermark otomatis
-- aktif begitu SALAH SATU dari dua batas ini tercapai duluan.
--
-- "Dokumen final" dihitung SEKALI per dokumen (bukan per klik Save) --
-- trigger di bawah cuma nambah counter saat status sebuah baris
-- BERUBAH JADI 'final' untuk PERTAMA KALINYA (insert langsung final,
-- atau update dari draft -> final). Re-save dokumen yang sudah final
-- (mis. edit lalu save-and-download lagi) TIDAK dihitung dobel.
-- =============================================

alter table profiles
  add column if not exists trial_docs_generated integer not null default 0;

-- ---------- handle_new_user: trial jadi 7 hari (dari 14) ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  is_admin_created boolean;
begin
  is_admin_created := coalesce(new.raw_app_meta_data ->> 'created_by', '') = 'admin';

  insert into public.profiles (id, email, role, status, trial_ends_at)
  values (
    new.id, new.email, 'customer',
    'active',
    case when is_admin_created then null else now() + interval '7 days' end
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

-- ---------- COUNTER: +1 tiap dokumen (apapun jenisnya) pertama kali jadi 'final' ----------
-- security definer supaya trigger dari tabel dokumen manapun bisa update
-- profiles.trial_docs_generated milik user yang sama, terlepas dari RLS
-- (walau di kasus normal auth.uid() = new.user_id juga sudah lolos RLS
-- "update own profile").
-- Guard `trial_ends_at is not null`: akun yang sudah "Mark as Paid"
-- (trial_ends_at NULL) tidak perlu lagi dihitung -- tidak akan pernah
-- kena watermark berapa pun dokumennya.
create or replace function public.increment_trial_doc_count()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'final'
     and (tg_op = 'INSERT' or old.status is distinct from 'final') then
    update public.profiles
    set trial_docs_generated = trial_docs_generated + 1
    where id = new.user_id and trial_ends_at is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trial_doc_count on purchase_orders;
create trigger trg_trial_doc_count
  after insert or update of status on purchase_orders
  for each row execute function public.increment_trial_doc_count();

drop trigger if exists trg_trial_doc_count on sales_orders;
create trigger trg_trial_doc_count
  after insert or update of status on sales_orders
  for each row execute function public.increment_trial_doc_count();

drop trigger if exists trg_trial_doc_count on invoices; -- CI & PI sama-sama di sini (sql/16 doc_type)
create trigger trg_trial_doc_count
  after insert or update of status on invoices
  for each row execute function public.increment_trial_doc_count();

drop trigger if exists trg_trial_doc_count on packing_lists;
create trigger trg_trial_doc_count
  after insert or update of status on packing_lists
  for each row execute function public.increment_trial_doc_count();

drop trigger if exists trg_trial_doc_count on shipping_instructions;
create trigger trg_trial_doc_count
  after insert or update of status on shipping_instructions
  for each row execute function public.increment_trial_doc_count();

drop trigger if exists trg_trial_doc_count on delivery_notes;
create trigger trg_trial_doc_count
  after insert or update of status on delivery_notes
  for each row execute function public.increment_trial_doc_count();

-- ---------- BACKFILL: user yang trial-nya sedang jalan SEKARANG (belum lewat) ----------
-- Diperlakukan sebagai baru mulai trial 7 hari HARI INI + counter 0 --
-- sama seperti kebijakan file 25: tidak adil kalau tiba-tiba dipotong
-- jadi 7 hari dari waktu signup mereka yang dulu dijanjikan 14 hari.
-- User yang trial-nya SUDAH LEWAT (trial_ends_at di masa lalu) DIBIARKAN
-- tetap lewat -- tidak di-refresh -- karena mereka memang sudah watermark
-- di bawah aturan lama juga, tidak ada perubahan pengalaman untuk mereka.
update profiles
set trial_ends_at = now() + interval '7 days', trial_docs_generated = 0
where trial_ends_at is not null and trial_ends_at > now();

-- RLS TIDAK berubah -- kolom baru otomatis ikut ter-cover oleh policy
-- "update own profile" yang sudah ada. accountNeedsWatermark() di
-- js/guard.js yang menambahkan logika cek trial_docs_generated >= 5.
