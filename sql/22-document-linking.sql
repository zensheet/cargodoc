-- =============================================
-- DOCUMENT LINKING (chain PO -> SO -> Invoice -> Packing List -> SI -> DN)
-- Jalankan SETELAH file 21 (butuh semua tabel: purchase_orders, sales_orders,
-- invoices, packing_lists, shipping_instructions, delivery_notes sudah ada).
--
-- Tujuan: user input data sekali, dokumen berikutnya di rantai bisa
-- "Load from <dokumen sumber>" -- otomatis isi party info & items, alih-alih
-- ketik ulang dari nol. Pola ini SUDAH ADA sebelumnya untuk Invoice ->
-- Packing List (kolom packing_lists.source_invoice_id, lihat "Prasyarat
-- Database.sql") -- file ini menambahkan 4 pasangan lain di rantai yang sama
-- persis polanya: kolom `source_x_id uuid references x on delete set null`,
-- nullable, tanpa constraint tambahan (dokumen tetap bisa dibuat dari nol
-- tanpa sumber). RLS TIDAK perlu berubah -- kolom baru otomatis ikut
-- ter-cover oleh policy row-level yang sudah ada di masing-masing tabel.
--
-- Rantai & arah mapping (party info hanya di-copy kalau relasinya masuk
-- akal secara bisnis -- kalau tidak, cuma items yang dibawa, party info
-- dikosongkan supaya user isi manual, bukan ditebak salah):
--   PO  -> SO   : items only (barang yang dibeli, dijual lagi)
--   SO  -> INV  : Customer -> Receiver+BillTo, Ship To -> Ship To, items
--   INV -> PL   : (sudah ada sebelumnya) Shipper/Receiver, items -> packages
--   PL  -> SI   : Shipper -> Shipper, Receiver -> Consignee, packages -> cargo
--   SI  -> DN   : Shipper -> From, Consignee -> Deliver To, cargo -> items
-- =============================================

alter table sales_orders
  add column if not exists source_po_id uuid references purchase_orders on delete set null;

alter table invoices
  add column if not exists source_so_id uuid references sales_orders on delete set null;

alter table shipping_instructions
  add column if not exists source_packing_list_id uuid references packing_lists on delete set null;

alter table delivery_notes
  add column if not exists source_si_id uuid references shipping_instructions on delete set null;
