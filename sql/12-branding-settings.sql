-- =============================================
-- BRANDING SETTINGS (header PDF: warna & logo, per user)
-- Jalankan setelah SQL Schema.sql. Aman dijalankan ulang (idempotent).
-- =============================================

create table if not exists branding_settings (
  user_id uuid primary key references auth.users on delete cascade,
  header_color text default '#1a56db',
  logo_url text,
  updated_at timestamptz default now()
);

alter table branding_settings enable row level security;

drop policy if exists "read own branding" on branding_settings;
drop policy if exists "insert own branding" on branding_settings;
drop policy if exists "update own branding" on branding_settings;

create policy "read own branding" on branding_settings
  for select using (auth.uid() = user_id or public.is_developer());
create policy "insert own branding" on branding_settings
  for insert with check (auth.uid() = user_id);
create policy "update own branding" on branding_settings
  for update using (auth.uid() = user_id);

-- =============================================
-- STORAGE BUCKET untuk logo
-- Kalau baris insert ke storage.buckets ini gagal (butuh privilege lebih
-- tinggi dari SQL Editor biasa di beberapa project), buat bucket-nya manual
-- lewat Dashboard -> Storage -> New Bucket:
--   Name: logos | Public bucket: ON
-- lalu tetap jalankan 4 policy storage.objects di bawah ini.
-- =============================================

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "read logos" on storage.objects;
drop policy if exists "upload own logo" on storage.objects;
drop policy if exists "update own logo" on storage.objects;
drop policy if exists "delete own logo" on storage.objects;

-- Bucket public -> siapa saja boleh baca (dibutuhkan supaya jsPDF bisa
-- fetch file logo via URL publik saat generate PDF).
create policy "read logos" on storage.objects
  for select using (bucket_id = 'logos');

-- Upload/update/delete dibatasi: user hanya boleh menyentuh file di dalam
-- folder bernama uid mereka sendiri, path yang dipakai app: {user_id}/logo.*
create policy "upload own logo" on storage.objects
  for insert with check (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "update own logo" on storage.objects
  for update using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "delete own logo" on storage.objects
  for delete using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );
