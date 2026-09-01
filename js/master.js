// ============================================
// MASTER DATA — companies, products & custom field definitions
// PRD §27-29 (master data), §33-35 (custom field definitions)
// ============================================

let COMPANIES = [];
let PRODUCTS = [];
let FIELD_DEFS = [];

(async function initMaster() {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('user-name').textContent = session.profile.email;
  await loadCompanies();
  await loadProducts();
})();

function switchTab(tab) {
  document.getElementById('panel-companies').hidden = tab !== 'companies';
  document.getElementById('panel-products').hidden = tab !== 'products';
  document.getElementById('panel-customfields').hidden = tab !== 'customfields';
  document.getElementById('tab-companies').className = tab === 'companies' ? 'btn btn-primary' : 'btn btn-secondary';
  document.getElementById('tab-products').className = tab === 'products' ? 'btn btn-primary' : 'btn btn-secondary';
  document.getElementById('tab-customfields').className = tab === 'customfields' ? 'btn btn-primary' : 'btn btn-secondary';
  if (tab === 'customfields') loadFieldDefs();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ============ COMPANIES ============
async function loadCompanies() {
  const { data, error } = await supabase
    .from('companies').select('*').order('company_name');
  if (error) return alert('Gagal memuat data perusahaan: ' + error.message);
  COMPANIES = data || [];
  renderCompanies();
}

function renderCompanies() {
  const el = document.getElementById('companies-table');
  if (!COMPANIES.length) {
    el.innerHTML = `<div class="feature-card" style="text-align:center; padding:30px;">
      <p style="color:var(--text-muted);">Belum ada perusahaan. Tambahkan customer atau supplier pertama Anda di atas.</p></div>`;
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Company</th><th>Type</th><th>PIC</th><th>Phone</th><th>Email</th>
        <th>City</th><th>Country</th><th>Actions</th>
      </tr></thead>
      <tbody>${COMPANIES.map(c => `
        <tr>
          <td><strong>${esc(c.company_name)}</strong></td>
          <td><span class="badge badge-active">${esc(c.company_type)}</span></td>
          <td>${esc(c.pic || '—')}</td>
          <td>${esc(c.phone || '—')}</td>
          <td>${esc(c.email || '—')}</td>
          <td>${esc(c.city || '—')}</td>
          <td>${esc(c.country || '—')}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="editCompany('${c.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCompany('${c.id}', '${esc(c.company_name)}')">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function saveCompany(e) {
  e.preventDefault();
  const status = document.getElementById('co-status');
  const name = document.getElementById('co-name').value.trim();
  if (!name) { status.style.color = 'var(--danger)'; status.textContent = 'Company name is required.'; return; }

  const record = {
    company_type: document.getElementById('co-type').value,
    company_name: name,
    pic:     document.getElementById('co-pic').value.trim() || null,
    phone:   document.getElementById('co-phone').value.trim() || null,
    email:   document.getElementById('co-email').value.trim() || null,
    city:    document.getElementById('co-city').value.trim() || null,
    country: document.getElementById('co-country').value.trim() || null,
    address: document.getElementById('co-address').value.trim() || null,
    notes:   document.getElementById('co-notes').value.trim() || null,
  };

  const id = document.getElementById('co-id').value;
  const { error } = id
    ? await supabase.from('companies').update(record).eq('id', id)
    : await supabase.from('companies').insert(record);

  if (error) { status.style.color = 'var(--danger)'; status.textContent = 'Error: ' + error.message; return; }
  status.style.color = '#166534';
  status.textContent = '✅ Saved.';
  resetCompanyForm();
  await loadCompanies();
}

function editCompany(id) {
  const c = COMPANIES.find(x => x.id === id);
  if (!c) return;
  document.getElementById('co-id').value = c.id;
  document.getElementById('co-type').value = c.company_type;
  document.getElementById('co-name').value = c.company_name || '';
  document.getElementById('co-pic').value = c.pic || '';
  document.getElementById('co-phone').value = c.phone || '';
  document.getElementById('co-email').value = c.email || '';
  document.getElementById('co-city').value = c.city || '';
  document.getElementById('co-country').value = c.country || '';
  document.getElementById('co-address').value = c.address || '';
  document.getElementById('co-notes').value = c.notes || '';
  document.getElementById('co-form-title').textContent = 'Edit Company';
  document.getElementById('co-cancel').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCompanyForm() {
  ['co-id','co-name','co-pic','co-phone','co-email','co-city','co-country','co-address','co-notes']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('co-form-title').textContent = 'Add Company';
  document.getElementById('co-cancel').hidden = true;
  document.getElementById('co-status').textContent = '';
}

async function deleteCompany(id, name) {
  if (!(await customConfirm(`Delete company "${name}" from master data?\n\nExisting invoices are NOT affected.`))) return;
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) return alert('Gagal menghapus: ' + error.message);
  await loadCompanies();
}

// ============ PRODUCTS ============
async function loadProducts() {
  const { data, error } = await supabase
    .from('products').select('*').order('product_name');
  if (error) return alert('Gagal memuat data produk: ' + error.message);
  PRODUCTS = data || [];
  renderProducts();
}

function renderProducts() {
  const el = document.getElementById('products-table');
  if (!PRODUCTS.length) {
    el.innerHTML = `<div class="feature-card" style="text-align:center; padding:30px;">
      <p style="color:var(--text-muted);">Belum ada produk. Tambahkan produk yang sering Anda kirim di atas.</p></div>`;
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Product</th><th>HS Code</th><th>Unit</th>
        <th style="text-align:right;">Default Price</th><th>Description</th><th>Actions</th>
      </tr></thead>
      <tbody>${PRODUCTS.map(p => `
        <tr>
          <td><strong>${esc(p.product_name)}</strong></td>
          <td>${esc(p.hs_code || '—')}</td>
          <td>${esc(p.unit || '—')}</td>
          <td style="text-align:right;">${p.default_unit_price != null ? (+p.default_unit_price).toFixed(2) : '—'}</td>
          <td>${esc(p.description || '—')}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}', '${esc(p.product_name)}')">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function saveProduct(e) {
  e.preventDefault();
  const status = document.getElementById('pr-status');
  const name = document.getElementById('pr-name').value.trim();
  if (!name) { status.style.color = 'var(--danger)'; status.textContent = 'Product name is required.'; return; }

  const record = {
    product_name: name,
    hs_code: document.getElementById('pr-hs').value.trim() || null,
    unit: document.getElementById('pr-unit').value.trim() || 'PCS',
    default_unit_price: parseFloat(document.getElementById('pr-price').value) || 0,
    description: document.getElementById('pr-desc').value.trim() || null,
  };

  const id = document.getElementById('pr-id').value;
  const { error } = id
    ? await supabase.from('products').update(record).eq('id', id)
    : await supabase.from('products').insert(record);

  if (error) { status.style.color = 'var(--danger)'; status.textContent = 'Error: ' + error.message; return; }
  status.style.color = '#166534';
  status.textContent = '✅ Saved.';
  resetProductForm();
  await loadProducts();
}

function editProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pr-id').value = p.id;
  document.getElementById('pr-name').value = p.product_name || '';
  document.getElementById('pr-hs').value = p.hs_code || '';
  document.getElementById('pr-unit').value = p.unit || 'PCS';
  document.getElementById('pr-price').value = p.default_unit_price ?? '';
  document.getElementById('pr-desc').value = p.description || '';
  document.getElementById('pr-form-title').textContent = 'Edit Product';
  document.getElementById('pr-cancel').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetProductForm() {
  ['pr-id','pr-name','pr-hs','pr-desc','pr-price'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pr-unit').value = 'PCS';
  document.getElementById('pr-form-title').textContent = 'Add Product';
  document.getElementById('pr-cancel').hidden = true;
  document.getElementById('pr-status').textContent = '';
}

async function deleteProduct(id, name) {
  if (!(await customConfirm(`Delete product "${name}" from master data?\n\nExisting invoices are NOT affected.`))) return;
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return alert('Gagal menghapus: ' + error.message);
  await loadProducts();
}

// ============ CUSTOM FIELD DEFINITIONS (PRD §33-35) ============
async function loadFieldDefs() {
  const { data, error } = await supabase
    .from('custom_field_definitions').select('*').order('sort_order');
  if (error) return alert('Gagal memuat custom fields: ' + error.message);
  FIELD_DEFS = data || [];
  renderFieldDefs();
}

function renderFieldDefs() {
  const el = document.getElementById('cfd-table');
  if (!FIELD_DEFS.length) {
    el.innerHTML = `<div class="feature-card" style="text-align:center; padding:30px;">
      <p style="color:var(--text-muted);">Belum ada custom field. Tambahkan di atas — akan muncul di form Invoice dan/atau Packing List.</p></div>`;
    return;
  }
  const APPLIES_LABEL = { both: 'Invoice & Packing List', invoice: 'Invoice only', packing_list: 'Packing List only' };
  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Label</th><th>Key</th><th>Applies To</th><th>Suggested</th><th>Actions</th>
      </tr></thead>
      <tbody>${FIELD_DEFS.map(d => `
        <tr>
          <td><strong>${esc(d.field_label)}</strong></td>
          <td><code>${esc(d.field_key)}</code></td>
          <td>${esc(APPLIES_LABEL[d.applies_to] || d.applies_to)}</td>
          <td>${d.is_suggested ? '✅' : '—'}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-danger btn-sm" onclick="deleteFieldDef('${d.id}', '${esc(d.field_label)}')">Delete</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function saveFieldDef() {
  const status = document.getElementById('cfd-status');
  const label = document.getElementById('cfd-label').value.trim();
  if (!label) { status.style.color = 'var(--danger)'; status.textContent = 'Label is required.'; return; }

  const field_key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!field_key) { status.style.color = 'var(--danger)'; status.textContent = 'Label must contain letters/numbers.'; return; }

  const applies_to = document.getElementById('cfd-applies').value;
  const is_suggested = document.getElementById('cfd-suggested').checked;

  if (FIELD_DEFS.some(d => d.field_key === field_key && (d.applies_to === applies_to || d.applies_to === 'both' || applies_to === 'both'))) {
    status.style.color = 'var(--danger)'; status.textContent = 'A field with this label already exists for this scope.'; return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('custom_field_definitions').insert({
    user_id: user.id,
    field_key,
    field_label: label,
    applies_to,
    is_suggested,
    sort_order: FIELD_DEFS.length + 1,
  });

  if (error) { status.style.color = 'var(--danger)'; status.textContent = 'Error: ' + error.message; return; }
  status.style.color = '#166534';
  status.textContent = '✅ Field added.';
  document.getElementById('cfd-label').value = '';
  document.getElementById('cfd-suggested').checked = false;
  await loadFieldDefs();
}

async function deleteFieldDef(id, label) {
  if (!(await customConfirm(`Delete custom field "${label}"?\n\nIt will no longer appear on forms. Values already saved on existing documents are NOT affected.`))) return;
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
  if (error) return alert('Gagal menghapus: ' + error.message);
  await loadFieldDefs();
}
