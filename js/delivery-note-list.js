// ============================================
// DELIVERY NOTE LIST — history, view, duplicate, delete
// Mengikuti pola persis js/shipping-instruction-list.js
// ============================================

let ALL_DNS = [];

(async function initDnList() {
  const { allowed, session } = await requireFeature('delivery_note');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  await loadDns();
})();

// ---------- LOAD ----------
async function loadDns() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';

  const { data: dns, error } = await supabase
    .from('delivery_notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    return;
  }
  ALL_DNS = dns || [];
  renderList();
}

// ---------- RENDER ----------
function renderList() {
  const container = document.getElementById('list-container');
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  const filtered = ALL_DNS.filter(dn => {
    const matchSearch = !search
      || dn.dn_number.toLowerCase().includes(search)
      || (dn.deliver_to_name || '').toLowerCase().includes(search);
    const matchStatus = !status || dn.status === status;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="feature-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">
          ${ALL_DNS.length ? 'No delivery notes match your filter.' : 'No delivery notes yet.'}
        </p>
        <a class="btn btn-primary" style="margin-top:12px;" href="/delivery-note.html">+ Create First Delivery Note</a>
      </div>`;
    return;
  }

  const rows = filtered.map(dn => `
    <tr>
      <td><strong>${esc(dn.dn_number)}</strong></td>
      <td>${esc(dn.dn_date || '—')}</td>
      <td>${esc(dn.deliver_to_name || '—')}</td>
      <td>${esc(dn.vehicle_number || '—')}</td>
      <td>${dn.received_by_name ? `✅ ${esc(dn.received_by_name)}` : '—'}</td>
      <td><span class="badge ${dn.status === 'final' ? 'badge-active' : 'badge-locked'}">${esc(dn.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewDn('${dn.id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/delivery-note.html?id=${dn.id}">Edit</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadDn('${dn.id}')">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicateDn('${dn.id}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="deleteDn('${dn.id}', '${esc(dn.dn_number)}')">Delete</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>DN No.</th><th>Date</th><th>Deliver To</th>
          <th>Vehicle</th><th>Received</th><th>Status</th><th>Actions</th>
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
async function viewDn(id) {
  const dn = ALL_DNS.find(d => d.id === id);
  if (!dn) return;

  const { data: items } = await supabase
    .from('delivery_note_items').select('*').eq('delivery_note_id', id)
    .order('created_at');

  const itemRows = (items || []).map(it => `
    <tr>
      <td>${esc(it.description)}</td>
      <td>${esc(it.sku || '—')}</td>
      <td style="text-align:right;">${it.package_count || 0} ${esc(it.package_type || '')}</td>
      <td style="text-align:right;">${it.quantity ?? '—'} ${esc(it.unit || '')}</td>
    </tr>`).join('');

  document.getElementById('modal-title').textContent = dn.dn_number;
  const trailHtml = await renderDocTrail('dn', dn); // js/doc-trail.js
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Date:</strong> ${esc(dn.dn_date || '—')} &nbsp;
       <strong>Status:</strong> ${esc(dn.status)}</p>
    <p><strong>From:</strong> ${esc(dn.from_name || '—')}</p>
    <p><strong>Deliver To:</strong> ${esc(dn.deliver_to_name || '—')}
       ${dn.deliver_to_pic ? `(${esc(dn.deliver_to_pic)})` : ''}</p>
    ${dn.vehicle_number ? `<p><strong>Vehicle:</strong> ${esc(dn.vehicle_number)} ${dn.driver_name ? `— Driver: ${esc(dn.driver_name)}` : ''}</p>` : ''}
    ${trailHtml}
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Description</th><th>SKU</th><th style="text-align:right;">Pkgs</th>
        <th style="text-align:right;">Qty</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
    </table>
    ${dn.received_by_name ? `<p style="margin-top:10px;"><strong>Received by:</strong> ${esc(dn.received_by_name)} on ${esc(dn.received_date || '—')}</p>` : ''}
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" onclick="downloadDn('${dn.id}')">Download PDF</button>
      <a class="btn btn-secondary btn-sm" href="/delivery-note.html?id=${dn.id}">Edit</a>
      <button class="btn btn-secondary btn-sm" onclick="duplicateDn('${dn.id}')">Duplicate</button>
    </div>`;

  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ---------- DOWNLOAD PDF ----------
async function downloadDn(id) {
  const { data: dn } = await supabase
    .from('delivery_notes').select('*').eq('id', id).single();
  const { data: items } = await supabase
    .from('delivery_note_items').select('*').eq('delivery_note_id', id).order('created_at');
  if (!dn) return alert('Delivery note not found.');

  const branding = await getBranding(); // js/branding.js
  const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
  await generateDeliveryNotePDF({
    delivery_note: dn,
    from: {
      company_name: dn.from_name, pic: dn.from_pic,
      address: dn.from_address, city: dn.from_city,
      country: dn.from_country, phone: dn.from_phone, email: dn.from_email,
    },
    deliverTo: {
      company_name: dn.deliver_to_name, pic: dn.deliver_to_pic,
      address: dn.deliver_to_address, city: dn.deliver_to_city,
      country: dn.deliver_to_country, phone: dn.deliver_to_phone, email: dn.deliver_to_email,
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
async function duplicateDn(id) {
  if (!confirm('Duplicate this delivery note?\nA new delivery note with a new number will be created.')) return;

  const { data: dn, error } = await supabase
    .from('delivery_notes').select('*').eq('id', id).single();
  if (error) return alert('Load failed: ' + error.message);

  const { data: items } = await supabase
    .from('delivery_note_items').select('*').eq('delivery_note_id', id);

  const newNumber = await nextDnNumber();

  const { id:_, created_at, updated_at, dn_number, received_by_name, received_date, ...copy } = dn;
  copy.dn_number = newNumber;
  copy.status = 'draft';
  copy.dn_date = new Date().toISOString().slice(0, 10);
  // Proof of delivery TIDAK ikut di-copy -- dokumen baru belum diterima siapa pun.

  const { data: saved, error: insErr } = await supabase
    .from('delivery_notes').insert(copy).select().single();
  if (insErr) return alert('Duplicate failed: ' + insErr.message);

  if (items?.length) {
    const { error: itemErr } = await supabase.from('delivery_note_items').insert(
      items.map(({ id:_, delivery_note_id, created_at, ...it }) =>
        ({ ...it, delivery_note_id: saved.id }))
    );
    if (itemErr) return alert('Items copy failed: ' + itemErr.message);
  }

  alert(`✅ Duplicated as ${newNumber}`);
  await loadDns();
}

// ---------- DELETE ----------
async function deleteDn(id, number) {
  if (!confirm(`Delete delivery note ${number}?\n\nThis action is PERMANENT and cannot be undone.`)) return;

  const { error } = await supabase
    .from('delivery_notes').delete().eq('id', id);

  if (error) return alert('Delete failed: ' + error.message);
  await loadDns();
}

// ---------- Nomor baru utk duplikat ----------
async function nextDnNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('delivery_notes')
    .select('*', { count: 'exact', head: true })
    .like('dn_number', `DN-${year}-%`);
  return `DN-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}
