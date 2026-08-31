-- =============================================
-- GUEST MODE DIPERLUAS KE DELIVERY NOTE & SHIPPING INSTRUCTION
-- Jalankan SETELAH file 20 & 21 (butuh tabel shipping_instructions/
-- delivery_notes + feature_key-nya sudah ada & active=true).
--
-- Sama alasannya seperti file 19 (PO & SO): DN & SI awalnya
-- feature-gated (requireFeature() biasa, bukan requireFeatureOrGuest()),
-- lihat komentar lama di js/delivery-note.js & js/shipping-instruction.js.
-- Keputusan produk: SEMUA 6 jenis dokumen (Invoice, Packing List,
-- Purchase Order, Sales Order, Delivery Note, Shipping Instruction)
-- ditampilkan di landing page tanpa login, watermark tetap jadi
-- pembatasnya -- calon customer melihat FULL scope produk sebelum bikin
-- akun.
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
    where f.feature_key in (
      'invoice', 'packing_list',
      'purchase_order', 'sales_order',
      'delivery_note', 'shipping_instruction'
    );
  end if;

  return new;
end;
$$;

-- Backfill akun self-signup yang SUDAH ada sebelum migration ini (pola
-- sama persis dengan bagian backfill di file 19).
insert into public.user_features (user_id, feature_id, enabled)
select p.id, f.id, true
from public.profiles p
cross join public.features f
where f.feature_key in ('delivery_note', 'shipping_instruction')
  and p.role = 'customer'
  and not exists (
    select 1 from public.user_features uf
    where uf.user_id = p.id and uf.feature_id = f.id
  );
