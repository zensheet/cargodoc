-- =============================================
-- CUSTOM FIELDS LEVEL ITEM (per baris) -- perluasan dari PRD §33-38
-- Jalankan SETELAH file 23.
--
-- Custom fields yang sudah ada ("CUSTOM FIELDS (PRD #U00a733-38).sql")
-- levelnya DOKUMEN (satu nilai untuk seluruh Invoice/Packing List, mis.
-- "Payment Method: Bank Transfer"). Sebagian customer butuh field
-- tambahan yang beda NILAINYA per baris barang (mis. "Model Name",
-- "Batch No") -- itu tidak bisa dipenuhi custom field level dokumen.
--
-- Migration ini menambah:
--   1. custom_field_definitions.is_item_field -- default FALSE, jadi
--      semua field lama otomatis tetap berperilaku sama persis (level
--      dokumen), TIDAK ada breaking change untuk data yang sudah ada.
--   2. invoice_items.custom_fields & packing_list_items.custom_fields
--      (jsonb) -- pola identik dengan invoices.custom_fields /
--      packing_lists.custom_fields yang sudah ada, cuma di level item.
--
-- RLS TIDAK perlu diubah -- invoice_items/packing_list_items sudah
-- ter-cover policy row-level lewat kepemilikan invoice/packing_list
-- induknya (kolom baru otomatis ikut, bukan kolom akses baru).
-- =============================================

alter table custom_field_definitions
  add column if not exists is_item_field boolean default false;

alter table invoice_items
  add column if not exists custom_fields jsonb default '{}'::jsonb;

alter table packing_list_items
  add column if not exists custom_fields jsonb default '{}'::jsonb;
