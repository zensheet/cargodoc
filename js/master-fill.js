// ============================================
// MASTER FILL — auto-fill dari master data
// Dipakai di invoice.html & packinglist.html.
// Menambah datalist di input company name + products,
// mengisi field terkait otomatis saat nama dipilih.
// TIDAK mengubah logika form yang sudah ada.
// ============================================

let MF_COMPANIES = [];
let MF_PRODUCTS = [];

// esc() dibutuhkan di sini tapi tidak ada di halaman invoice.html/packinglist.html
// (esc() aslinya cuma didefinisikan di master.js/invoice-list.js/packinglist-list.js).
// Didefinisikan lokal agar tidak ReferenceError.
if (typeof esc !== 'function') {
  var esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

(async function initMasterFill() {
  // Tunggu form siap
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: companies } = await supabase.from('companies').select('*').order('company_name');
  const { data: products } = await supabase.from('products').select('*').order('product_name');
  MF_COMPANIES = companies || [];
  MF_PRODUCTS = products || [];

  attachCompanyFill('f-shipper_name', 'supplier'); // shipper biasanya supplier/kita sendiri
  attachCompanyFill('f-receiver_name', 'customer');
  attachProductFill();
})();

// ---------- COMPANY AUTO-FILL ----------
function attachCompanyFill(inputId, preferredType) {
  const input = document.getElementById(inputId);
  if (!input) return;

  // Datalist dengan company sesuai preferensi (customer/supplier/both)
  const listId = `${inputId}-datalist`;
  const dl = document.createElement('datalist');
  dl.id = listId;
  dl.innerHTML = MF_COMPANIES
    .filter(c => c.company_type === preferredType || c.company_type === 'both')
    .map(c => `<option value="${esc(c.company_name)}">`)
    .join('');
  input.setAttribute('list', listId);
  input.after(dl);

  // Saat user memilih/ketik nama yang match -> isi field lain (hanya yang masih kosong)
  input.addEventListener('change', () => {
    const match = MF_COMPANIES.find(
      c => c.company_name.toLowerCase() === input.value.trim().toLowerCase()
    );
    if (!match) return;

    const prefix = inputId.replace('_name', ''); // f-shipper / f-receiver
    const fill = (suffix, val) => {
      const el = document.getElementById(`${prefix}${suffix}`);
      // hanya isi jika kosong — jangan menimpa input manual user
      if (el && !el.value.trim() && val) el.value = val;
    };
    fill('_pic', match.pic);
    fill('_address', match.address);
    fill('_city', match.city);
    fill('_country', match.country);
    fill('_phone', match.phone);
    fill('_email', match.email);
  });
}

// ---------- PRODUCT AUTO-FILL ----------
// Menambah datalist "product name @ price" pada kolom description,
// saat dipilih -> isi HS code, unit, unit price baris tsb.
function attachProductFill() {
  const applyToRow = tr => {
    const descInput = tr.querySelector('.i-description');
    if (!descInput || descInput.dataset.mfDone) return;
    descInput.dataset.mfDone = '1';

    const dl = document.createElement('datalist');
    dl.id = `mf-product-${Math.random().toString(36).slice(2, 8)}`;
    dl.innerHTML = MF_PRODUCTS.map(p =>
      `<option value="${esc(p.product_name)}">${p.hs_code || ''}</option>`).join('');
    descInput.setAttribute('list', dl.id);
    descInput.after(dl);

    descInput.addEventListener('change', () => {
      const match = MF_PRODUCTS.find(
        p => p.product_name.toLowerCase() === descInput.value.trim().toLowerCase()
      );
      if (!match) return;
      const hs = tr.querySelector('.i-hs_code');
      const unit = tr.querySelector('.i-unit');
      const price = tr.querySelector('.i-unit_price');
      if (hs && !hs.value.trim()) hs.value = match.hs_code || '';
      if (unit && unit.value.trim() === 'PCS') unit.value = match.unit || 'PCS';
      if (price && !price.value) {
        price.value = match.default_unit_price || '';
        if (typeof calcRow === 'function') calcRow(price); // re-amount + totals
      }
    });
  };

  // Baris yang sudah ada + baris baru lewatObserver
  document.querySelectorAll('#items-table tbody tr').forEach(applyToRow);
  const tbody = document.querySelector('#items-table tbody');
  if (tbody) {
    new MutationObserver(() =>
      document.querySelectorAll('#items-table tbody tr').forEach(applyToRow)
    ).observe(tbody, { childList: true });
  }
}
