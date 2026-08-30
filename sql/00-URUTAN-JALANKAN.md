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

9. **`13-self-signup-guest-mode.sql`**
   Update `handle_new_user()`: self-signup (bukan admin-created) otomatis
   dapat feature `invoice` + `packing_list` ON. Butuh `handle_new_user()`
   sudah ada (dari langkah 2) dan Edge Function `admin-create-user` sudah
   di-deploy (menandai akun admin-created via `app_metadata`).

10. **`14-account-activation-pending-status.sql`**
    PRD §74 (Account Activation / Payment Gate): tambah status akun
    `pending` di `profiles.status`, self-signup sekarang mulai dari
    `pending` (bukan langsung `active`), dan RLS insert `invoices`/
    `packing_lists` dipindah pakai `is_account_usable()` (cuma nolak
    `locked`) supaya akun pending tetap bisa menyimpan dokumen — PDF-nya
    saja yang tetap watermark sampai admin klik "Activate" di
    `admin.html`. Butuh langkah 9 sudah dijalankan (meng-`replace`
    `handle_new_user()` yang sama).

---

Catatan: tabel `customers` dan `suppliers` yang sempat ada di draft awal
`SQL Schema.sql` sudah dihapus dari schema — tidak pernah dipakai kode
manapun. Data shipper/receiver disimpan sebagai snapshot langsung di
`invoices` / `packing_lists` (lihat file #3 dan #4 di atas), bukan lewat
tabel relasi terpisah.
