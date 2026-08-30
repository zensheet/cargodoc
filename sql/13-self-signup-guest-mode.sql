-- =============================================
-- PHASE 9 — FREEMIUM ONBOARDING (GUEST MODE), PRD §73
-- Jalankan sekali di Supabase SQL Editor.
--
-- Tujuan: bedakan account hasil SELF-SIGNUP (guest mode -> signup di
-- titik klik Download) dari account ADMIN-CREATED (dibuat Developer
-- lewat Admin Panel). Default feature access-nya beda:
--   - Self-signup      -> invoice + packing_list otomatis ON (free tier)
--   - Admin-created    -> semua OFF (Developer yang enable manual)
--
-- Caranya: Edge Function admin-create-user (lihat file terpisah yang
-- di-deploy ulang) menandai user yang ia buat dengan
-- app_metadata: { created_by: 'admin' }. Trigger handle_new_user di
-- bawah ini mengecek metadata itu -- kalau TIDAK ada, berarti self-signup
-- asli, maka feature invoice & packing_list di-set enabled=true.
-- =============================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  is_admin_created boolean;
begin
  insert into public.profiles (id, email, role, status)
  values (new.id, new.email, 'customer', 'active');

  -- new.raw_app_meta_data adalah kolom asli auth.users yang menyimpan
  -- app_metadata yang di-set lewat auth.admin.createUser({ app_metadata }).
  is_admin_created := coalesce(new.raw_app_meta_data ->> 'created_by', '') = 'admin';

  if not is_admin_created then
    insert into public.user_features (user_id, feature_id, enabled)
    select new.id, f.id, true
    from public.features f
    where f.feature_key in ('invoice', 'packing_list');
  end if;

  return new;
end;
$$;

-- Catatan: trigger on_auth_user_created yang sudah ada (lihat SQL Schema.sql)
-- TIDAK perlu dibuat ulang -- ia otomatis memakai versi terbaru function
-- di atas begitu di-replace.
