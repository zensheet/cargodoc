-- =============================================
-- PROFORMA INVOICE (doc_type approach)
-- =============================================
-- Proforma Invoice pakai tabel `invoices` yang sama dengan Commercial
-- Invoice (field-nya ~95% identik) — dibedakan lewat kolom `doc_type`.
-- Beda hanya di: judul PDF, prefix nomor (PI- vs INV-), dan field
-- tambahan `valid_until` (masa berlaku quotation, khusus proforma).

alter table invoices
  add column if not exists doc_type text not null default 'commercial'
  check (doc_type in ('commercial', 'proforma'));

alter table invoices
  add column if not exists valid_until date;

-- Index bantu query listing per tipe dokumen
create index if not exists invoices_doc_type_idx on invoices (user_id, doc_type);
