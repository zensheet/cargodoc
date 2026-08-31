// ============================================
// PURCHASE ORDER LIST — history, view, duplicate, delete
// Mengikuti pola persis js/invoice-list.js (PRD §25-26)
// ============================================

let ALL_POS = [];

(async function initPoList() {
  const { allowed, session } = await requireFeature('purchase_order');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  await loadPos();
})();

// ---------- LOAD ----------
async function loadPos() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';

  const { data: pos, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    return;
  }
  ALL_POS = pos || [];
  renderList();
}

// ---------- RENDER ----------
function renderList() {
  const container = document.getElementById('list-container');
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  const filtered = ALL_POS.filter(po => {
    const matchSearch = !search
      || po.po_number.toLowerCase().includes(search)
      || (po.supplier_name || '').toLowerCase().includes(search);
    const matchStatus = !status || po.status === status;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="feature-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">
          ${ALL_POS.length ? 'No purchase orders match your filter.' : 'No purchase orders yet.'}
        </p>
        <a class="btn btn-primary" style="margin-top:12px;" href="/purchase-order.html">+ Create First Purchase Order</a>
      </div>`;
    return;
  }

  const rows = filtered.map(po => `
    <tr>
      <td><strong>${esc(po.po_number)}</strong></td>
      <td>${esc(po.po_date || '—')}</td>
      <td>${esc(po.supplier_name || '—')}</td>
      <td>${esc(po.currency)}</td>
      <td style="text-align:right;">${(po.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td><span class="badge ${po.status === 'final' ? 'badge-active' : 'badge-locked'}">${esc(po.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewPo('${po.id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/purchase-order.html?id=${po.id}">Edit</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadPo('${po.id}')">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicatePo('${po.id}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="deletePo('${po.id}', '${esc(po.po_number)}')">Delete</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>PO No.</th><th>Date</th><th>Supplier</th>
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
async function viewPo(id) {
  const po = ALL_POS.find(p => p.id === id);
  if (!po) return;

  const { data: items } = await supabase
    .from('purchase_order_items').select('*').eq('purchase_order_id', id)
    .order('created_at');

  const itemRows = (items || []).map(it => `
    <tr>
      <td>${esc(it.description)}</td>
      <td>${esc(it.sku || '—')}</td>
      <td style="text-align:right;">${it.quantity} ${esc(it.unit || '')}</td>
      <td style="text-align:right;">${(it.unit_price || 0).toFixed(2)}</td>
      <td style="text-align:right;">${(it.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

  document.getElementById('modal-title').textContent = po.po_number;
  const trailHtml = await renderDocTrail('po', po); // js/doc-trail.js
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Date:</strong> ${esc(po.po_date || '—')} &nbsp;
       <strong>Status:</strong> ${esc(po.status)}</p>
    <p><strong>Supplier:</strong> ${esc(po.supplier_name || '—')}
       ${po.supplier_pic ? `(${esc(po.supplier_pic)})` : ''}</p>
    ${trailHtml}
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Description</th><th>SKU</th><th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="5">No items</td></tr>'}</tbody>
    </table>
    <div style="text-align:right; margin-top:12px; font-size:15px;">
      Subtotal: ${po.subtotal?.toFixed(2) || '0.00'}<br>
      ${po.other_charges ? `Other Charges: ${po.other_charges.toFixed(2)}<br>` : ''}
      ${po.discount ? `Discount: -${po.discount.toFixed(2)}<br>` : ''}
      <strong style="font-size:18px;">Grand Total: ${esc(po.currency)} ${(po.grand_total || 0).toFixed(2)}</strong>
    </div>
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" onclick="downloadPo('${po.id}')">Download PDF</button>
      <a class="btn btn-secondary btn-sm" href="/purchase-order.html?id=${po.id}">Edit</a>
      <button class="btn btn-secondary btn-sm" onclick="duplicatePo('${po.id}')">Duplicate</button>
    </div>`;

  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ---------- DOWNLOAD PDF ----------
async function downloadPo(id) {
  const { data: po } = await supabase
    .from('purchase_orders').select('*').eq('id', id).single();
  const { data: items } = await supabase
    .from('purchase_order_items').select('*').eq('purchase_order_id', id).order('created_at');
  if (!po) return alert('Purchase order not found.');

  const branding = await getBranding(); // js/branding.js
  const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
  await generatePurchaseOrderPDF({
    purchase_order: po,
    supplier: {
      company_name: po.supplier_name, pic: po.supplier_pic,
      address: po.supplier_address, city: po.supplier_city,
      country: po.supplier_country, phone: po.supplier_phone, email: po.supplier_email,
    },
    deliverTo: {
      company_name: po.deliver_to_name, pic: po.deliver_to_pic,
      address: po.deliver_to_address, city: po.deliver_to_city,
      country: po.deliver_to_country, phone: po.deliver_to_phone, email: po.deliver_to_email,
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
async function duplicatePo(id) {
  if (!(await customConfirm('Duplicate this purchase order?\nA new purchase order with a new number will be created.'))) return;

  const { data: po, error } = await supabase
    .from('purchase_orders').select('*').eq('id', id).single();
  if (error) return alert('Load failed: ' + error.message);

  const { data: items } = await supabase
    .from('purchase_order_items').select('*').eq('purchase_order_id', id);

  const newNumber = await nextPoNumber();

  const { id:_, created_at, updated_at, po_number, ...copy } = po;
  copy.po_number = newNumber;
  copy.status = 'draft';
  copy.po_date = new Date().toISOString().slice(0, 10);

  const { data: saved, error: insErr } = await supabase
    .from('purchase_orders').insert(copy).select().single();
  if (insErr) return alert('Duplicate failed: ' + insErr.message);

  if (items?.length) {
    const { error: itemErr } = await supabase.from('purchase_order_items').insert(
      items.map(({ id:_, purchase_order_id, created_at, ...it }) =>
        ({ ...it, purchase_order_id: saved.id }))
    );
    if (itemErr) return alert('Items copy failed: ' + itemErr.message);
  }

  alert(`✅ Duplicated as ${newNumber}`);
  await loadPos();
}

// ---------- DELETE ----------
async function deletePo(id, number) {
  if (!(await customConfirm(`Delete purchase order ${number}?\n\nThis action is PERMANENT and cannot be undone.`))) return;

  const { error } = await supabase
    .from('purchase_orders').delete().eq('id', id);

  if (error) return alert('Delete failed: ' + error.message);
  await loadPos();
}

// ---------- Nomor baru utk duplikat ----------
async function nextPoNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .like('po_number', `PO-${year}-%`);
  return `PO-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}
