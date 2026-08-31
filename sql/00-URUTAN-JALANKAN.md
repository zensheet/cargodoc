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

11. **`15-fix-invoice-number-scope.sql`**
    Fix bug: `invoice_number`/`packing_list_number` sempat `unique` secara
    GLOBAL (lintas semua user), padahal nomor auto-generate cuma
    menghitung urutan milik user yang login (RLS). Akibatnya bisa bentrok
    antar akun berbeda (`duplicate key value violates unique constraint`).
    Diganti jadi `unique(user_id, invoice_number)` / `unique(user_id,
    packing_list_number)` — unik per akun, bukan lintas akun.

12. **`16-proforma-invoice-doc-type.sql`**
    Menambah kolom `invoices.doc_type` (`'commercial'` / `'proforma'`)
    dan `invoices.valid_until`. Proforma Invoice pakai tabel & halaman
    yang sama dengan Commercial Invoice (field-nya ~95% identik),
    dibedakan lewat `doc_type` — bukan tabel terpisah. Nomor otomatisnya
    pakai seri terpisah (`PI-{YEAR}-{SEQ}` vs `INV-{YEAR}-{SEQ}`), dan
    tetap tercover oleh feature `invoice` yang sama (tidak perlu toggle
    admin baru).

13. **`17-purchase-order.sql`**
    Fitur baru Purchase Order (roadmap #4): tabel `purchase_orders` +
    `purchase_order_items` (mandiri, bukan doc_type di tabel invoices —
    field-nya cukup beda: Supplier bukan Shipper/Receiver, tidak ada
    freight/insurance). RLS mengikuti pola persis invoices/invoice_items,
    termasuk gate `is_account_usable()` + `has_feature('purchase_order')`
    di insert (butuh langkah 10 sudah dijalankan). Mengaktifkan feature
    `purchase_order` (sebelumnya `active=false`/"coming soon" di seed
    langkah 2). **Catatan:** beda dari `invoice`/`packing_list`, feature
    ini TIDAK auto-enable untuk self-signup — admin perlu enable manual
    per customer di `admin.html`, sama seperti akun admin-created.

14. **`18-sales-order.sql`**
    Lanjutan Purchase Order — kebalikannya: kita JUAL ke Customer, bukan
    beli dari Supplier. Tabel `sales_orders` + `sales_order_items`, field
    & pola RLS 1:1 sama dengan `purchase_orders`/`purchase_order_items`
    (Customer ganti Supplier, Ship To ganti Deliver To). Butuh langkah 13
    sudah dijalankan. Beda dari `purchase_order` (yang sudah ada baris-nya
    di seed langkah 2 dengan `active=false`), feature `sales_order` BELUM
    PERNAH ada baris-nya sama sekali di tabel `features` — jadi file ini
    `insert`, bukan `update`. Sama seperti `purchase_order`, TIDAK
    auto-enable untuk self-signup — admin enable manual per customer.

15. **`19-guest-mode-po-so.sql`**
    Purchase Order & Sales Order ikut dibuka untuk guest mode (belum
    login) — sama seperti Commercial Invoice & Packing List. Butuh
    langkah 13 & 14 sudah dijalankan.

16. **`20-shipping-instruction.sql`**
    Dokumen shipping baru (roadmap: SI → DN → Shipping Label → DO).
    Tabel `shipping_instructions` + `shipping_instruction_items`.
    Berbeda dari PO/SO (yang membeli/menjual barang dengan harga & total),
    SI adalah instruksi ke Forwarder/Carrier — tiga pihak (Shipper,
    Consignee, Notify Party), detail booking/routing/B-L, dan cargo lines
    TANPA harga (bukan dokumen komersial). RLS mengikuti pola persis
    `purchase_orders`/`sales_orders` (butuh langkah 13 & 14 sudah
    dijalankan). Feature `shipping_instruction` BELUM PERNAH ada baris-nya
    di tabel `features` — jadi `insert`, bukan `update`, `active=true`
    langsung. TIDAK guest mode & TIDAK auto-enable untuk self-signup —
    admin enable manual per customer di `admin.html`.

17. **`21-delivery-note.sql`**
    Dokumen shipping berikutnya (roadmap: SI → **DN** → Shipping Label →
    DO). Tabel `delivery_notes` + `delivery_note_items`. DN adalah bukti
    serah-terima barang secara fisik (dibawa bersama barang, ditandatangani
    penerima) — field-nya: From/Deliver To, info kendaraan (driver, nomor
    kendaraan), items TANPA harga (sama seperti Shipping Instruction —
    bukan dokumen komersial), dan kolom opsional "Proof of Delivery"
    (`received_by_name`, `received_date`) yang biasanya diisi manual
    setelah barang sampai. RLS mengikuti pola persis
    `shipping_instructions` (butuh langkah 16 sudah dijalankan). Feature
    `delivery_note` BELUM PERNAH ada baris-nya di tabel `features` — jadi
    `insert`, bukan `update`, `active=true` langsung. TIDAK guest mode &
    TIDAK auto-enable untuk self-signup — admin enable manual per
    customer di `admin.html`.

18. **`22-document-linking.sql`**
    Rantai dokumen **PO → SO → Invoice → Packing List → SI → DN**: user
    isi data sekali, dokumen berikutnya tinggal "Load from ..." (dropdown
    di halaman create, pola yang sama dengan `packing_lists.source_invoice_id`
    yang sudah ada dari awal — lihat "Prasyarat Database.sql"). Menambah
    4 kolom nullable (`references ... on delete set null`, tanpa constraint
    tambahan): `sales_orders.source_po_id`, `invoices.source_so_id`,
    `shipping_instructions.source_packing_list_id`,
    `delivery_notes.source_si_id`. Hop Invoice → Packing List TIDAK
    disentuh (sudah ada duluan). Party info hanya di-copy kalau relasinya
    masuk akal secara bisnis — PO → SO cuma bawa items (Supplier PO ≠
    Customer SO, beda entitas, jadi party dikosongkan supaya user isi
    manual, bukan ditebak salah). RLS TIDAK berubah — kolom baru otomatis
    ikut ter-cover policy row-level yang sudah ada di masing-masing tabel.
    Butuh langkah 17 sudah dijalankan.

---

Catatan: tabel `customers` dan `suppliers` yang sempat ada di draft awal
`SQL Schema.sql` sudah dihapus dari schema — tidak pernah dipakai kode
manapun. Data shipper/receiver disimpan sebagai snapshot langsung di
`invoices` / `packing_lists` (lihat file #3 dan #4 di atas), bukan lewat
tabel relasi terpisah.
