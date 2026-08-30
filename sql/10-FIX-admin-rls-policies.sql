-- =============================================
-- FIX: RLS policy yang kelupaan di SQL Schema.sql
-- Jalankan sekali di Supabase SQL Editor.
-- =============================================

-- 1. user_features: developer perlu bisa INSERT & UPDATE
--    (dipakai checkbox toggle feature di admin.html -> upsert()).
--    Sebelumnya cuma ada policy SELECT ("read own features"),
--    jadi upsert selalu kena "new row violates row-level security policy".
create policy "developer insert user_features" on user_features
  for insert with check (public.is_developer());

create policy "developer update user_features" on user_features
  for update using (public.is_developer()) with check (public.is_developer());

-- 2. profiles: developer perlu bisa UPDATE row user LAIN
--    (dipakai tombol Lock/Unlock di admin.html -> update status).
--    Policy lama "update own profile" cuma izinkan auth.uid() = id,
--    jadi developer gak bisa lock/unlock akun client.
create policy "developer update any profile" on profiles
  for update using (public.is_developer());
