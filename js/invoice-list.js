// ============================================
// INVOICE LIST — history, view, duplicate, delete
// PRD §25-26
//   Duplicate: dokumen baru, nomor & timestamp baru, data item tersalin
//   Delete  : konfirmasi dulu, lalu permanen
// ============================================

let ALL_INVOICES = [];

(async function initInvoiceList() {
  const { allowed, session } = await requireFeature('invoice');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;

  // Prefill filter tipe dokumen dari ?type= (link dari dashboard, mis.
  // /invoice-list.html?type=proforma)
  const typeParam = new URLSearchParams(location.search).get('type');
  if (typeParam === 'proforma' || typeParam === 'commercial') {
    document.getElementById('filter-doc-type').value = typeParam;
  }

  await loadInvoices();
})();

// ---------- LOAD ----------
async function loadInvoices() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    return;
  }
  ALL_INVOICES = invoices || [];
  renderList();
}

// ---------- RENDER ----------
function renderList() {
  const container = document.getElementById('list-container');
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const docTypeEl = document.getElementById('filter-doc-type');
  const docType = docTypeEl ? docTypeEl.value : '';

  const filtered = ALL_INVOICES.filter(inv => {
    const matchSearch = !search
      || inv.invoice_number.toLowerCase().includes(search)
      || (inv.receiver_name || '').toLowerCase().includes(search);
    const matchStatus = !status || inv.status === status;
    const matchDocType = !docType || (inv.doc_type || 'commercial') === docType;
    return matchSearch && matchStatus && matchDocType;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="feature-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">
          ${ALL_INVOICES.length ? 'No invoices match your filter.' : 'No invoices yet.'}
        </p>
        <a class="btn btn-primary" style="margin-top:12px;" href="/invoice.html">+ Create First Invoice</a>
      </div>`;
    return;
  }

  const rows = filtered.map(inv => `
    <tr>
      <td><strong>${esc(inv.invoice_number)}</strong></td>
      <td><span class="badge ${inv.doc_type === 'proforma' ? 'badge-locked' : 'badge-active'}">${inv.doc_type === 'proforma' ? 'Proforma' : 'Commercial'}</span></td>
      <td>${esc(inv.invoice_date || '—')}</td>
      <td>${esc(inv.receiver_name || '—')}</td>
      <td>${esc(inv.currency)}</td>
      <td style="text-align:right;">${(inv.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td><span class="badge ${inv.status === 'final' ? 'badge-active' : 'badge-locked'}">${esc(inv.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewInvoice('${inv.id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/invoice.html?id=${inv.id}">Edit</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadInvoice('${inv.id}')">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicateInvoice('${inv.id}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}', '${esc(inv.invoice_number)}')">Delete</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Invoice No.</th><th>Type</th><th>Date</th><th>Receiver</th>
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
async function viewInvoice(id) {
  const inv = ALL_INVOICES.find(i => i.id === id);
  if (!inv) return;

  const { data: items } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', id)
    .order('created_at');

  const itemRows = (items || []).map(it => `
    <tr>
      <td>${esc(it.description)}</td>
      <td>${esc(it.hs_code || '—')}</td>
      <td style="text-align:right;">${it.quantity} ${esc(it.unit || '')}</td>
      <td style="text-align:right;">${(it.unit_price || 0).toFixed(2)}</td>
      <td style="text-align:right;">${(it.amount || 0).toFixed(2)}</td>
    </tr>`).join('');

  document.getElementById('modal-title').textContent = inv.invoice_number;
  const trailHtml = await renderDocTrail('invoice', inv); // js/doc-trail.js
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Date:</strong> ${esc(inv.invoice_date || '—')} &nbsp;
       <strong>Status:</strong> ${esc(inv.status)} &nbsp;
       <strong>Type:</strong> ${esc(inv.shipment_type || '—')}</p>
    <p><strong>Receiver:</strong> ${esc(inv.receiver_name || '—')}
       ${inv.receiver_pic ? `(${esc(inv.receiver_pic)})` : ''}</p>
    ${trailHtml}
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Description</th><th>HS Code</th><th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit Price</th><th style="text-align:right;">Amount</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="5">No items</td></tr>'}</tbody>
    </table>
    <div style="text-align:right; margin-top:12px; font-size:15px;">
      Subtotal: ${inv.subtotal?.toFixed(2) || '0.00'}<br>
      ${inv.freight ? `Freight: ${inv.freight.toFixed(2)}<br>` : ''}
      ${inv.insurance ? `Insurance: ${inv.insurance.toFixed(2)}<br>` : ''}
      ${inv.other_charges ? `Other: ${inv.other_charges.toFixed(2)}<br>` : ''}
      ${inv.discount ? `Discount: -${inv.discount.toFixed(2)}<br>` : ''}
      <strong style="font-size:18px;">Grand Total: ${esc(inv.currency)} ${(inv.grand_total || 0).toFixed(2)}</strong>
    </div>
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" onclick="downloadInvoice('${inv.id}')">Download PDF</button>
      <a class="btn btn-secondary btn-sm" href="/invoice.html?id=${inv.id}">Edit</a>
      <button class="btn btn-secondary btn-sm" onclick="duplicateInvoice('${inv.id}')">Duplicate</button>
    </div>`;

  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ---------- DOWNLOAD PDF ----------
// Ambil ulang data lengkap dari DB lalu generate PDF
async function downloadInvoice(id) {
  const { data: inv } = await supabase
    .from('invoices').select('*').eq('id', id).single();
  const { data: items } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', id).order('created_at');
  if (!inv) return alert('Invoice not found.');

  const branding = await getBranding(); // js/branding.js
  const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
  await generateInvoicePDF({
    invoice: inv,
    shipper: {
      company_name: inv.shipper_name, pic: inv.shipper_pic,
      address: inv.shipper_address, city: inv.shipper_city,
      country: inv.shipper_country, phone: inv.shipper_phone, email: inv.shipper_email,
    },
    receiver: {
      company_name: inv.receiver_name, pic: inv.receiver_pic,
      address: inv.receiver_address, city: inv.receiver_city,
      country: inv.receiver_country, phone: inv.receiver_phone, email: inv.receiver_email,
    },
    items: items || [],
    branding,
    watermark,
  });
  if (watermark) {
    alert('⏳ Your account is pending activation — this PDF still has a watermark. It will be removed once the administrator activates your account.');
  }
}

// ---------- DUPLICATE (PRD §26) ----------
// Dokumen BARU: id baru, nomor baru, timestamp baru — data items tersalin
async function duplicateInvoice(id) {
  if (!(await customConfirm('Duplicate this invoice?\nA new invoice with a new number will be created.'))) return;

  const { data: inv, error } = await supabase
    .from('invoices').select('*').eq('id', id).single();
  if (error) return alert('Load failed: ' + error.message);

  const { data: items } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', id);

  const newNumber = await nextInvoiceNumber(inv.doc_type || 'commercial');

  // Copy semua field KECUALI id, timestamps, nomor lama
  const { id:_, created_at, updated_at, invoice_number, ...copy } = inv;
  copy.invoice_number = newNumber;
  copy.status = 'draft';          // duplikat selalu mulai sebagai draft
  copy.invoice_date = new Date().toISOString().slice(0, 10);

  const { data: saved, error: insErr } = await supabase
    .from('invoices').insert(copy).select().single();
  if (insErr) return alert('Duplicate failed: ' + insErr.message);

  if (items?.length) {
    const { error: itemErr } = await supabase.from('invoice_items').insert(
      items.map(({ id:_, invoice_id, created_at, ...it }) =>
        ({ ...it, invoice_id: saved.id }))
    );
    if (itemErr) return alert('Items copy failed: ' + itemErr.message);
  }

  alert(`✅ Duplicated as ${newNumber}`);
  await loadInvoices();
}

// ---------- DELETE (PRD §25) ----------
async function deleteInvoice(id, number) {
  // konfirmasi eksplisit dengan nama nomor invoice
  if (!(await customConfirm(`Delete invoice ${number}?\n\nThis action is PERMANENT and cannot be undone.`))) return;

  // items terhapus otomatis via ON DELETE CASCADE
  const { error } = await supabase
    .from('invoices').delete().eq('id', id);

  if (error) return alert('Delete failed: ' + error.message);
  await loadInvoices();
}

// ---------- Nomor baru utk duplikat ----------
// docType: 'commercial' (INV-) atau 'proforma' (PI-) — dua seri terpisah,
// sinkron dengan DOC_TYPE_META di invoice.js.
async function nextInvoiceNumber(docType = 'commercial') {
  const prefix = docType === 'proforma' ? 'PI' : 'INV';
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('doc_type', docType)
    .like('invoice_number', `${prefix}-${year}-%`);
  return `${prefix}-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}
