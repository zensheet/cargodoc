// ============================================
// ITEM-LEVEL CUSTOM FIELDS — perluasan js/custom-fields.js (PRD §33-38)
//  - custom-fields.js  = field level DOKUMEN (satu nilai / dokumen)
//  - item-custom-fields.js (file ini) = field level BARIS (mis. "Model
//    Name" beda-beda tiap item), lihat sql/24-item-level-custom-fields.sql
//
// Cara kerja (mirror pola custom-fields.js: tidak mengubah invoice.js /
// packinglist.js sama sekali, murni tempel dari luar):
//  1. Tunggu tabel item punya minimal 1 baris (mode create: baris kosong
//     awal dari addItemRow(); mode edit: baris hasil fetch invoice/PL).
//  2. Tambah <th> di header tabel + <td><input> di SETIAP baris yang
//     sudah ada, untuk tiap field level-item yang aktif.
//  3. Bungkus addItemRow()/addPkgRow() supaya baris BARU (tombol "+ Add
//     Item") otomatis ikut dapat kolom yang sama.
//  4. Mode edit: fetch ulang invoice_items/packing_list_items sendiri
//     (order('created_at') -- SAMA persis urutan query yang dipakai
//     invoice.js/packinglist.js) supaya nilai custom_fields per baris
//     bisa di-zip by index ke baris DOM yang sudah dirender duluan.
//  5. Bungkus collectInvoice()/collectPackingList() supaya nilai dari
//     kolom-kolom ini ikut masuk ke item.custom_fields sebelum disimpan
//     -- persistInvoice/persistPackingList sudah otomatis nyimpen field
//     apa pun yang ada di object item (lihat `{ ...i, invoice_id: ... }`
//     di persistInvoice), jadi tidak perlu sentuh file itu juga.
// ============================================

let ICF_DEFS = [];      // definisi field level-item yang aktif utk konteks ini
let ICF_CONTEXT = null; // 'invoice' | 'packing_list'
let ICF_EXISTING = [];  // array custom_fields per baris, urutan sama dgn DOM rows (mode edit)

(async function initItemCustomFields() {
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  if (document.getElementById('invoice-form')) ICF_CONTEXT = 'invoice';
  else if (document.getElementById('packinglist-form')) ICF_CONTEXT = 'packing_list';
  else return;

  const tableSel = ICF_CONTEXT === 'invoice' ? '#items-table' : '#packages-table';

  await loadItemFieldDefs();
  if (!ICF_DEFS.length) return; // tidak ada field level-item aktif -> tidak sentuh apa pun (zero overhead)

  // Tunggu minimal 1 baris ada (create: langsung; edit: nunggu fetch invoice.js/packinglist.js selesai)
  const ok = await waitForRow(`${tableSel} tbody tr`);
  if (!ok) return; // halaman lain / gagal render -- jangan paksa, biar tidak error

  addHeaderColumns(tableSel);
  wrapAddRowFn();

  if ((ICF_CONTEXT === 'invoice' ? window.EDIT_ID : window.EDIT_PL_ID)) {
    await loadExistingItemValues();
  }
  addColumnsToExistingRows(tableSel);
  wrapCollectFn();
})();

function waitForRow(selector, timeoutMs = 6000) {
  return new Promise(resolve => {
    const start = Date.now();
    (function poll() {
      if (document.querySelector(selector)) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(poll, 100);
    })();
  });
}

// ---------- LOAD DEFINISI FIELD LEVEL-ITEM ----------
async function loadItemFieldDefs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .or(`applies_to.eq.both,applies_to.eq.${ICF_CONTEXT}`)
    .eq('is_item_field', true)
    .order('sort_order');
  ICF_DEFS = data || [];
}

// ---------- HEADER KOLOM ----------
function addHeaderColumns(tableSel) {
  const headRow = document.querySelector(`${tableSel} thead tr`);
  if (!headRow) return;
  const deleteCol = headRow.lastElementChild; // <th> kosong paling kanan (tombol hapus baris)
  ICF_DEFS.forEach(d => {
    const th = document.createElement('th');
    th.style.width = '90px';
    th.textContent = d.field_label;
    headRow.insertBefore(th, deleteCol);
  });
}

// ---------- TAMBAH KOLOM KE BARIS YANG SUDAH ADA ----------
function addColumnsToExistingRows(tableSel) {
  document.querySelectorAll(`${tableSel} tbody tr`).forEach((tr, i) => {
    appendCellsToRow(tr, ICF_EXISTING[i] || {});
  });
}

function appendCellsToRow(tr, values) {
  const deleteCell = tr.lastElementChild; // <td> tombol hapus, selalu paling kanan
  ICF_DEFS.forEach(d => {
    const td = document.createElement('td');
    td.innerHTML = `<input data-cf-item-key="${escIcf(d.field_key)}" value="${escIcf(values[d.field_label] || '')}">`;
    tr.insertBefore(td, deleteCell);
  });
}

function escIcf(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- BUNGKUS addItemRow()/addPkgRow() UNTUK BARIS BARU ----------
function wrapAddRowFn() {
  const fnName = ICF_CONTEXT === 'invoice' ? 'addItemRow' : 'addPkgRow';
  const tableSel = ICF_CONTEXT === 'invoice' ? '#items-table' : '#packages-table';
  if (typeof window[fnName] !== 'function') return;
  const orig = window[fnName];
  window[fnName] = function (...args) {
    const before = document.querySelectorAll(`${tableSel} tbody tr`).length;
    const ret = orig.apply(this, args);
    const rows = document.querySelectorAll(`${tableSel} tbody tr`);
    if (rows.length > before) appendCellsToRow(rows[rows.length - 1], {});
    return ret;
  };
}

// ---------- MODE EDIT: FETCH ULANG NILAI custom_fields PER BARIS ----------
// Query & urutan (order by created_at) SENGAJA disamakan persis dengan
// yang dipakai invoice.js (loadInvoiceForEdit)/packinglist.js
// (loadPlForEdit) supaya index-nya nyambung 1:1 ke baris DOM yang sudah
// mereka render duluan.
async function loadExistingItemValues() {
  if (ICF_CONTEXT === 'invoice') {
    const { data } = await supabase
      .from('invoice_items').select('custom_fields').eq('invoice_id', window.EDIT_ID).order('created_at');
    ICF_EXISTING = (data || []).map(r => r.custom_fields || {});
  } else {
    const { data } = await supabase
      .from('packing_list_items').select('custom_fields').eq('packing_list_id', window.EDIT_PL_ID).order('created_at');
    ICF_EXISTING = (data || []).map(r => r.custom_fields || {});
  }
}

// ---------- BUNGKUS collectInvoice()/collectPackingList() ----------
// Suntik item.custom_fields SETELAH fungsi asli selesai membangun array
// items/packages -- baris DOM yang di-skip (deskripsi kosong dsb) sudah
// pasti diperlakukan SAMA oleh loop di bawah (filter identik dgn
// collectInvoice/collectPackingList), jadi index tetap nyambung.
function wrapCollectFn() {
  if (ICF_CONTEXT === 'invoice' && typeof window.collectInvoice === 'function') {
    const orig = window.collectInvoice;
    window.collectInvoice = function () {
      const result = orig.call(this);
      injectItemCf(result.items, '#items-table', '.i-description');
      return result;
    };
  }
  if (ICF_CONTEXT === 'packing_list' && typeof window.collectPackingList === 'function') {
    const orig = window.collectPackingList;
    window.collectPackingList = function () {
      const result = orig.call(this);
      injectItemCf(result.packages, '#packages-table', '.p-description');
      return result;
    };
  }
}

function injectItemCf(itemsArr, tableSel, descSelector) {
  if (!itemsArr || !itemsArr.length) return;
  // PENTING: filter di sini harus identik dengan skip-logic di
  // collectInvoice()/collectPackingList() -- keduanya skip baris yang
  // deskripsinya kosong (packing list juga skip kalau qty & gross weight
  // kosong, tapi baris seperti itu juga tidak akan pernah punya deskripsi
  // terisi dalam praktiknya, jadi filter deskripsi-saja di sini aman).
  const rows = [...document.querySelectorAll(`${tableSel} tbody tr`)]
    .filter(tr => tr.querySelector(descSelector)?.value.trim());
  rows.forEach((tr, i) => {
    if (!itemsArr[i]) return;
    const cf = {};
    ICF_DEFS.forEach(d => {
      const el = tr.querySelector(`[data-cf-item-key="${d.field_key}"]`);
      const val = el?.value.trim();
      if (val) cf[d.field_label] = val;
    });
    if (Object.keys(cf).length) itemsArr[i].custom_fields = cf;
  });
}
