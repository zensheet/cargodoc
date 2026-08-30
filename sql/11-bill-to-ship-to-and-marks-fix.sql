-- =============================================
-- 11: BILL TO / SHIP TO (optional, PRD-extension atas request client)
--     + FIX: packing_lists.marks_numbers yang belum pernah dibuat
-- Jalankan sekali di Supabase SQL Editor, SETELAH file 01-10.
-- =============================================

-- FIX: js/packinglist.js & js/pdf.js sudah baca/tulis packing_lists.marks_numbers
-- sejak awal, tapi kolomnya tidak pernah dibuat di SQL manapun ("Prasyarat
-- Database.sql" cuma menambah shipper/receiver + totals). Tanpa ini, mengisi
-- "Marks/Notes" di form Packing List akan selalu gagal save
-- ("column marks_numbers does not exist").
alter table packing_lists
  add column if not exists marks_numbers text;

-- Bill To / Ship To — snapshot, sama pola dengan shipper/receiver.
-- Semua kolom OPTIONAL (Empty Field Rule: hanya tampil di PDF kalau diisi).
alter table invoices
  add column if not exists bill_to_name text,
  add column if not exists bill_to_pic text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_city text,
  add column if not exists bill_to_country text,
  add column if not exists bill_to_phone text,
  add column if not exists bill_to_email text,
  add column if not exists ship_to_name text,
  add column if not exists ship_to_pic text,
  add column if not exists ship_to_address text,
  add column if not exists ship_to_city text,
  add column if not exists ship_to_country text,
  add column if not exists ship_to_phone text,
  add column if not exists ship_to_email text;

alter table packing_lists
  add column if not exists bill_to_name text,
  add column if not exists bill_to_pic text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_city text,
  add column if not exists bill_to_country text,
  add column if not exists bill_to_phone text,
  add column if not exists bill_to_email text,
  add column if not exists ship_to_name text,
  add column if not exists ship_to_pic text,
  add column if not exists ship_to_address text,
  add column if not exists ship_to_city text,
  add column if not exists ship_to_country text,
  add column if not exists ship_to_phone text,
  add column if not exists ship_to_email text;
