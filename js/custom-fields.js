// ============================================
// CUSTOM FIELDS (PRD §33-38)
//  - §33: user boleh menambah field sendiri
//  - §34: suggested fields disediakan
//  - §35: fields tersimpan per user (custom_field_definitions)
//  - §36: nilai disimpan ke invoices.custom_fields / packing_lists.custom_fields
//  - Tidak mengubah invoice.js / packinglist.js:
//      nilai di-inject lewat wrapper persistInvoice/persistPackingList,
//      PDF ditambah via patch jsPDF.save (blok kiri-bawah halaman terakhir)
// ============================================

let CF_DEFS = [];       // definisi field aktif
let CF_VALUES = {};     // nilai live dari form: { field_key: value }
let CF_CONTEXT = null;  // 'invoice' | 'packing_list'

(async function initCustomFields() {
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }
  await new Promise(r => setTimeout(r, 300)); // tunggu form init selesai

  // Deteksi halaman
  if (document.getElementById('invoice-form')) CF_CONTEXT = 'invoice';
  else if (document.getElementById('packinglist-form')) CF_CONTEXT = 'packing_list';
  else return;

  await loadFieldDefs();
  renderCustomFieldsUI();
  wrapPersist();
  // FIX: patchPdfSave() dihapus. Sebelumnya custom fields di PDF hanya
  // muncul kalau di-generate dari halaman form ini (karena patch di sini
  // yang menyuntikkan teksnya ke jsPDF.save()) — TIDAK muncul kalau
  // PDF di-download dari halaman History (invoice-list.html/
  // packinglist-list.html), yang tidak me-load custom-fields.js.
  // Sekarang js/pdf.js membaca invoice.custom_fields / packing_list.custom_fields
  // langsung dari data (lihat renderCustomFieldsBlock di pdf.js), jadi
  // bekerja konsisten di semua jalur download PDF tanpa perlu patch ini.
})();

// ---------- LOAD DEFINITIONS (§34-35) ----------
async function loadFieldDefs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .or(`applies_to.eq.both,applies_to.eq.${CF_CONTEXT}`)
    .order('sort_order');
  CF_DEFS = data || [];
}

// ---------- RENDER UI DI FORM ----------
function renderCustomFieldsUI() {
  // FIX: hapus render lama dulu sebelum insert yang baru. Sebelumnya
  // fungsi ini dipanggil ulang setiap kali user klik "+ Add Field" tanpa
  // membuang section lama, sehingga muncul 2 section "Additional
  // Information" duplikat (id sama) di DOM — bikin getElementById()
  // untuk field yang sudah ada sebelumnya mengambil elemen yang salah
  // (nilai yang diketik user bisa tidak terbaca saat save).
  document.getElementById('custom-fields-section')?.remove();

  // Sisipkan section sebelum tombol aksi
  const actions = document.querySelector('#btn-save')?.parentElement;
  if (!actions) return;

  const section = document.createElement('section');
  section.className = 'feature-card';
  section.style.cssText = 'margin-bottom:20px;';
  section.id = 'custom-fields-section';

  let html = `<h3>Additional Information <small style="color:var(--text-muted); font-weight:400;">(optional)</small></h3>`;

  if (CF_DEFS.length) {
    html += `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:0 16px;">`;
    html += CF_DEFS.map(d => `
      <div>
        <label>${escHtml(d.field_label)}</label>
        <input id="cf-${d.field_key}" data-cf-key="${escHtml(d.field_key)}"
               oninput="CF_VALUES['${escHtml(d.field_key)}'] = this.value">
      </div>`).join('');
    html += `</div>`;
  } else {
    html += `<p style="color:var(--text-muted); font-size:14px;">
      No custom fields configured. Add them in Master Data → Custom Fields.</p>`;
  }

  // §33: tambah field baru langsung dari form
  html += `
    <div style="margin-top:14px; display:flex; gap:8px; align-items:center;">
      <input id="cf-new-label" placeholder="New field label (e.g. Color)" style="max-width:260px;">
      <button class="btn btn-secondary btn-sm" type="button" onclick="addCustomFieldFromForm()">+ Add Field</button>
    </div>
    <div id="cf-status" style="margin-top:8px; font-size:14px;"></div>`;

  section.innerHTML = html;
  actions.parentElement.insertBefore(section, actions);

  // Mode edit: prefill nilai dari dokumen yang sedang diedit (lihat
  // window.EDIT_DOC_CUSTOM_FIELDS, di-set oleh invoice.js/packinglist.js
  // setelah load data). Disimpan by label saat save (lihat collectCfValues).
  const existing = window.EDIT_DOC_CUSTOM_FIELDS;
  if (existing) {
    CF_DEFS.forEach(d => {
      const val = existing[d.field_label];
      if (val === undefined) return;
      const el = document.getElementById(`cf-${d.field_key}`);
      if (el) el.value = val;
      CF_VALUES[d.field_key] = val;
    });
  }
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- §33: TAMBAH FIELD BARU ----------
async function addCustomFieldFromForm() {
  const label = document.getElementById('cf-new-label')?.value.trim();
  const status = document.getElementById('cf-status');
  if (!label) { status.style.color = 'var(--danger)'; status.textContent = 'Label is required.'; return; }

  const field_key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!field_key) { status.style.color = 'var(--danger)'; status.textContent = 'Label must contain letters/numbers.'; return; }
  if (CF_DEFS.some(d => d.field_key === field_key)) {
    status.style.color = 'var(--danger)'; status.textContent = 'Field already exists.'; return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: def, error } = await supabase
    .from('custom_field_definitions')
    .insert({
      user_id: user.id,
      field_key,
      field_label: label,
      applies_to: CF_CONTEXT,
      is_suggested: false,
      sort_order: CF_DEFS.length + 1,
    })
    .select().single();

  if (error) { status.style.color = 'var(--danger)'; status.textContent = 'Error: ' + error.message; return; }

  status.style.color = '#166534'; status.textContent = `✅ Field "${label}" added & saved for future documents.`;
  document.getElementById('cf-new-label').value = '';
  CF_DEFS.push(def);
  renderCustomFieldsUI(); // re-render dengan field baru
}

// ---------- §36: INJECT NILAI SAAT SAVE ----------
// Wrapper: tanpa mengubah persistInvoice/persistPackingList
function wrapPersist() {
  if (CF_CONTEXT === 'invoice' && typeof window.persistInvoice === 'function') {
    const orig = window.persistInvoice;
    window.persistInvoice = async function (data, status) {
      data.invoice = { ...data.invoice, custom_fields: collectCfValues() };
      return orig.call(this, data, status);
    };
  }
  if (CF_CONTEXT === 'packing_list' && typeof window.persistPackingList === 'function') {
    const orig = window.persistPackingList;
    window.persistPackingList = async function (data, status) {
      data.packing_list = { ...data.packing_list, custom_fields: collectCfValues() };
      return orig.call(this, data, status);
    };
  }
}

function collectCfValues() {
  const out = {};
  CF_DEFS.forEach(d => {
    const el = document.getElementById(`cf-${d.field_key}`);
    const val = el ? el.value.trim() : (CF_VALUES[d.field_key] || '');
    if (val) out[d.field_label] = val; // simpan by label agar mudah ditampilkan
  });
  return out;
}
