// ============================================
// SALES ORDER LIST — history, view, duplicate, delete
// Mengikuti pola persis js/purchase-order-list.js
// ============================================

let ALL_SOS = [];

(async function initSoList() {
  const { allowed, session } = await requireFeature('sales_order');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  await loadSos();
})();

// ---------- LOAD ----------
async function loadSos() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';

  const { data: sos, error } = await supabase
    .from('sales_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    return;
  }
  ALL_SOS = sos || [];
  renderList();
}

// ---------- RENDER ----------
function renderList() {
  const container = document.getElementById('list-container');
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  const filtered = ALL_SOS.filter(so => {
    const matchSearch = !search
      || so.so_number.toLowerCase().includes(search)
      || (so.customer_name || '').toLowerCase().includes(search);
    const matchStatus = !status || so.status === status;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="feature-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">
          ${ALL_SOS.length ? 'No sales orders match your filter.' : 'No sales orders yet.'}
        </p>
        <a class="btn btn-primary" style="margin-top:12px;" href="/sales-order.html">+ Create First Sales Order</a>
      </div>`;
    return;
  }

  const rows = filtered.map(so => `
    <tr>
      <td><strong>${esc(so.so_number)}</strong></td>
      <td>${esc(so.so_date || '—')}</td>
      <td>${esc(so.customer_name || '—')}</td>
      <td>${esc(so.currency)}</td>
      <td style="text-align:right;">${(so.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td><span class="badge ${so.status === 'final' ? 'badge-active' : 'badge-locked'}">${esc(so.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewSo('${so.id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/sales-order.html?id=${so.id}">Edit</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadSo('${so.id}')">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicateSo('${so.id}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSo('${so.id}', '${esc(so.so_number)}')">Delete</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>SO No.</th><th>Date</th><th>Customer</th>
          <th>Cur</th><th style="text-align:right;">Grand Total</th>
          <th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// XSS guard utk data yang dirender ke HTML
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- VIEW (modal) ----------
async function viewSo(id) {
  const so = ALL_SOS.find(p => p.id === id);
  if (!so) return;

  const { data: items } = await supabase
    .from('sales_order_items').select('*').eq('sales_order_id', id)
    .order('created_at');

  const itemRows = (items || []).map(it => `
    <tr>
      <td>${esc(it.description)}</td>
      <td>${esc(it.sku || '—')}</td>
      <td style="text-align:right;">${it.quantity} ${esc(it.unit || '')}</td>
      <td style="text-align:right;">${(it.unit_price || 0).toFixed(2)}</td>
      <td style="text-align:right;">${(it.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

  document.getElementById('modal-title').textContent = so.so_number;
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Date:</strong> ${esc(so.so_date || '—')} &nbsp;
       <strong>Status:</strong> ${esc(so.status)}</p>
    <p><strong>Customer:</strong> ${esc(so.customer_name || '—')}
       ${so.customer_pic ? `(${esc(so.customer_pic)})` : ''}</p>
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Description</th><th>SKU</th><th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="5">No items</td></tr>'}</tbody>
    </table>
    <div style="text-align:right; margin-top:12px; font-size:15px;">
      Subtotal: ${so.subtotal?.toFixed(2) || '0.00'}<br>
      ${so.other_charges ? `Other Charges: ${so.other_charges.toFixed(2)}<br>` : ''}
      ${so.discount ? `Discount: -${so.discount.toFixed(2)}<br>` : ''}
      <strong style="font-size:18px;">Grand Total: ${esc(so.currency)} ${(so.grand_total || 0).toFixed(2)}</strong>
    </div>
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" onclick="downloadSo('${so.id}')">Download PDF</button>
      <a class="btn btn-secondary btn-sm" href="/sales-order.html?id=${so.id}">Edit</a>
      <button class="btn btn-secondary btn-sm" onclick="duplicateSo('${so.id}')">Duplicate</button>
    </div>`;

  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ---------- DOWNLOAD PDF ----------
async function downloadSo(id) {
  const { data: so } = await supabase
    .from('sales_orders').select('*').eq('id', id).single();
  const { data: items } = await supabase
    .from('sales_order_items').select('*').eq('sales_order_id', id).order('created_at');
  if (!so) return alert('Sales order not found.');

  const branding = await getBranding(); // js/branding.js
  const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
  await generateSalesOrderPDF({
    sales_order: so,
    customer: {
      company_name: so.customer_name, pic: so.customer_pic,
      address: so.customer_address, city: so.customer_city,
      country: so.customer_country, phone: so.customer_phone, email: so.customer_email,
    },
    shipTo: {
      company_name: so.ship_to_name, pic: so.ship_to_pic,
      address: so.ship_to_address, city: so.ship_to_city,
      country: so.ship_to_country, phone: so.ship_to_phone, email: so.ship_to_email,
    },
    items: items || [],
    branding,
    watermark,
  });
  if (watermark) {
    alert('⏳ Your account is pending activation — this PDF still has a watermark. It will be removed once the administrator activates your account.');
  }
}

// ---------- DUPLICATE ----------
async function duplicateSo(id) {
  if (!confirm('Duplicate this sales order?\nA new sales order with a new number will be created.')) return;

  const { data: so, error } = await supabase
    .from('sales_orders').select('*').eq('id', id).single();
  if (error) return alert('Load failed: ' + error.message);

  const { data: items } = await supabase
    .from('sales_order_items').select('*').eq('sales_order_id', id);

  const newNumber = await nextSoNumber();

  const { id:_, created_at, updated_at, so_number, ...copy } = so;
  copy.so_number = newNumber;
  copy.status = 'draft';
  copy.so_date = new Date().toISOString().slice(0, 10);

  const { data: saved, error: insErr } = await supabase
    .from('sales_orders').insert(copy).select().single();
  if (insErr) return alert('Duplicate failed: ' + insErr.message);

  if (items?.length) {
    const { error: itemErr } = await supabase.from('sales_order_items').insert(
      items.map(({ id:_, sales_order_id, created_at, ...it }) =>
        ({ ...it, sales_order_id: saved.id }))
    );
    if (itemErr) return alert('Items copy failed: ' + itemErr.message);
  }

  alert(`✅ Duplicated as ${newNumber}`);
  await loadSos();
}

// ---------- DELETE ----------
async function deleteSo(id, number) {
  if (!confirm(`Delete sales order ${number}?\n\nThis action is PERMANENT and cannot be undone.`)) return;

  const { error } = await supabase
    .from('sales_orders').delete().eq('id', id);

  if (error) return alert('Delete failed: ' + error.message);
  await loadSos();
}

// ---------- Nomor baru utk duplikat ----------
async function nextSoNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .like('so_number', `SO-${year}-%`);
  return `SO-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}
