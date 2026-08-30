# Urutan menjalankan file SQL ini di Supabase SQL Editor

Jalankan berurutan, satu per satu, sesuai nomor di bawah. Urutan ini wajib
diikuti karena tiap file bergantung pada tabel/kolom yang dibuat file
sebelumnya (banyak pakai `references` / `ALTER TABLE ... ADD COLUMN`).

1. **`master data.sql`**
   Membuat tabel `companies` & `products` (skema yang dipakai app —
   kolom `company_type`, `pic`, `notes`, `product_name`,
   `default_unit_price`, dst). Mandiri, cuma butuh `auth.users`.

2. **`SQL Schema.sql`**
   Membuat `profiles`, `features`, `user_features`, `invoices`,
   `invoice_items` (FK ke `products` dari langkah 1), `packing_lists`,
   `packing_list_items`, seluruh RLS inti, function `has_feature()` /
   `is_account_active()`, dan trigger auto-create profile saat signup.

3. **`Prasyarat Kolom ShipperReceiver di Database.sql`**
   `ALTER TABLE invoices ADD COLUMN ...` (kolom snapshot shipper/receiver).
   Butuh `invoices` sudah ada (dari langkah 2).

4. **`Prasyarat Database.sql`**
   `ALTER TABLE packing_lists ADD COLUMN ...` (snapshot shipper/receiver +
   `source_invoice_id` + kolom total qty/weight/CBM).
   Butuh `packing_lists` & `invoices` sudah ada (dari langkah 2).

5. **`CUSTOM FIELDS (PRD #U00a733-38).sql`**
   Membuat `custom_field_definitions` + `ALTER TABLE invoices/packing_lists
   ADD COLUMN custom_fields jsonb`.
   Butuh `invoices`/`packing_lists` sudah ada (dari langkah 2).

6. **`Seed suggested fields (...).sql`** — *opsional*
   Isi data contoh custom fields. Ganti dulu `<USER_ID_UUID>` di file ini
   dengan UUID user asli (lihat tabel `profiles`) sebelum dijalankan.
   Butuh `custom_field_definitions` sudah ada (dari langkah 5).

7. **`10-FIX-admin-rls-policies.sql`**
   Menambah policy INSERT/UPDATE `user_features` (dipakai toggle feature
   admin) dan UPDATE `profiles` untuk role developer (dipakai tombol
   Lock/Unlock user lain di admin.html). Tanpa ini, kedua tombol itu akan
   selalu gagal dengan error "row-level security policy".

8. **`11-bill-to-ship-to-and-marks-fix.sql`**
   Menambah kolom `packing_lists.marks_numbers` yang kepakai di kode
   (`packinglist.js`/`pdf.js`) tapi belum pernah dibuat di SQL manapun, plus
   kolom opsional Bill To / Ship To di `invoices` & `packing_lists`.

---

Catatan: tabel `customers` dan `suppliers` yang sempat ada di draft awal
`SQL Schema.sql` sudah dihapus dari schema — tidak pernah dipakai kode
manapun. Data shipper/receiver disimpan sebagai snapshot langsung di
`invoices` / `packing_lists` (lihat file #3 dan #4 di atas), bukan lewat
tabel relasi terpisah.
