-- =============================================
-- FIX: invoice_number / packing_list_number bentrok antar akun
-- =============================================
-- Bug: kolom invoice_number & packing_list_number di-set `unique`
-- secara GLOBAL (lintas semua user), tapi nomor auto-generate-nya
-- (nextInvoiceNumber() di invoice.js, dan versi serupa di
-- packinglist.js) menghitung urutan HANYA dari invoice/packing list
-- milik user yang login (karena RLS policy "own select" membatasi
-- SELECT ke user_id = auth.uid()).
--
-- Akibatnya: user baru mendaftar → count-nya 0 → sistem generate
-- INV-2026-00001 → tapi akun lain sudah pernah pakai nomor yang
-- sama → INSERT gagal kena unique constraint global.
--
-- Fix: ganti unique constraint jadi per-user (composite unique on
-- user_id + nomor), bukan global. Dengan begitu tiap user punya
-- deret nomornya sendiri dan tidak akan pernah bentrok dengan user
-- lain, sekaligus tetap mencegah 1 user punya nomor duplikat.

-- ---------- INVOICES ----------
alter table invoices
  drop constraint if exists invoices_invoice_number_key;

alter table invoices
  add constraint invoices_user_invoice_number_key
  unique (user_id, invoice_number);

-- ---------- PACKING LISTS ----------
alter table packing_lists
  drop constraint if exists packing_lists_packing_list_number_key;

alter table packing_lists
  add constraint packing_lists_user_number_key
  unique (user_id, packing_list_number);

-- Catatan: constraint composite unique tidak melarang NULL dobel
-- (Postgres menganggap tiap NULL berbeda), jadi kolom `not null`
-- yang sudah ada di kedua tabel tetap jadi penjaga utama supaya
-- invoice_number/packing_list_number wajib diisi.
