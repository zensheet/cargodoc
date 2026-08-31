-- =============================================
-- PHASE 11 — GUEST MODE DIPERLUAS KE PURCHASE ORDER & SALES ORDER
-- Jalankan SETELAH file 17 & 18 (butuh tabel purchase_orders/sales_orders
-- + feature_key-nya sudah ada & active=true).
--
-- Sebelumnya (lihat komentar di js/purchase-order.js & sql/17):
-- 'purchase_order' dan 'sales_order' SENGAJA tidak di-auto-enable untuk
-- self-signup, karena dua fitur itu awalnya hanya untuk akun yang
-- di-enable manual oleh admin.
--
-- Sekarang keputusan produk berubah: PO & SO juga ingin ditampilkan di
-- landing page tanpa login (sama seperti Invoice & Packing List), dengan
-- PDF watermark, supaya calon customer bisa coba semua jenis dokumen
-- sebelum daftar -- jadi feature-nya perlu ikut auto-enable untuk
-- self-signup juga.
-- =============================================

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
    where f.feature_key in ('invoice', 'packing_list', 'purchase_order', 'sales_order');
  end if;

  return new;
end;
$$;

-- Catatan: user yang SUDAH terlanjur self-signup SEBELUM migration ini
-- (jadi belum punya baris user_features untuk purchase_order/sales_order)
-- tidak otomatis ke-backfill oleh trigger di atas (trigger hanya jalan
-- saat INSERT baru ke auth.users). Backfill manual untuk akun lama:
insert into public.user_features (user_id, feature_id, enabled)
select p.id, f.id, true
from public.profiles p
cross join public.features f
where f.feature_key in ('purchase_order', 'sales_order')
  and p.role = 'customer'
  and not exists (
    select 1 from public.user_features uf
    where uf.user_id = p.id and uf.feature_id = f.id
  );
