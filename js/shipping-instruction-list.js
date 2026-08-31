// ============================================
// SHIPPING INSTRUCTION LIST — history, view, duplicate, delete
// Mengikuti pola persis js/purchase-order-list.js
// ============================================

let ALL_SIS = [];

(async function initSiList() {
  const { allowed, session } = await requireFeature('shipping_instruction');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  await loadSis();
})();

// ---------- LOAD ----------
async function loadSis() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';

  const { data: sis, error } = await supabase
    .from('shipping_instructions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    return;
  }
  ALL_SIS = sis || [];
  renderList();
}

// ---------- RENDER ----------
function renderList() {
  const container = document.getElementById('list-container');
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  const filtered = ALL_SIS.filter(si => {
    const matchSearch = !search
      || si.si_number.toLowerCase().includes(search)
      || (si.consignee_name || '').toLowerCase().includes(search);
    const matchStatus = !status || si.status === status;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="feature-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">
          ${ALL_SIS.length ? 'No shipping instructions match your filter.' : 'No shipping instructions yet.'}
        </p>
        <a class="btn btn-primary" style="margin-top:12px;" href="/shipping-instruction.html">+ Create First Shipping Instruction</a>
      </div>`;
    return;
  }

  const rows = filtered.map(si => `
    <tr>
      <td><strong>${esc(si.si_number)}</strong></td>
      <td>${esc(si.si_date || '—')}</td>
      <td>${esc(si.consignee_name || '—')}</td>
      <td>${esc(si.port_of_loading || '—')} → ${esc(si.port_of_discharge || '—')}</td>
      <td><span class="badge ${si.status === 'final' ? 'badge-active' : 'badge-locked'}">${esc(si.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewSi('${si.id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/shipping-instruction.html?id=${si.id}">Edit</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadSi('${si.id}')">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicateSi('${si.id}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSi('${si.id}', '${esc(si.si_number)}')">Delete</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>SI No.</th><th>Date</th><th>Consignee</th>
          <th>Route</th><th>Status</th><th>Actions</th>
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
async function viewSi(id) {
  const si = ALL_SIS.find(s => s.id === id);
  if (!si) return;

  const { data: items } = await supabase
    .from('shipping_instruction_items').select('*').eq('shipping_instruction_id', id)
    .order('created_at');

  const itemRows = (items || []).map(it => `
    <tr>
      <td>${esc(it.description)}</td>
      <td>${esc(it.hs_code || '—')}</td>
      <td style="text-align:right;">${it.package_count || 0} ${esc(it.package_type || '')}</td>
      <td style="text-align:right;">${(it.gross_weight || 0).toFixed(2)} kg</td>
      <td style="text-align:right;">${(it.measurement || 0).toFixed(3)} CBM</td>
    </tr>`).join('');

  document.getElementById('modal-title').textContent = si.si_number;
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Date:</strong> ${esc(si.si_date || '—')} &nbsp;
       <strong>Status:</strong> ${esc(si.status)}</p>
    <p><strong>Shipper:</strong> ${esc(si.shipper_name || '—')}</p>
    <p><strong>Consignee:</strong> ${esc(si.consignee_name || '—')}
       ${si.consignee_pic ? `(${esc(si.consignee_pic)})` : ''}</p>
    <p><strong>Route:</strong> ${esc(si.port_of_loading || '—')} → ${esc(si.port_of_discharge || '—')}
       ${si.final_destination ? `→ ${esc(si.final_destination)}` : ''}</p>
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Description</th><th>HS Code</th><th style="text-align:right;">Pkgs</th>
        <th style="text-align:right;">Gross Wt</th><th style="text-align:right;">CBM</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="5">No cargo lines</td></tr>'}</tbody>
    </table>
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" onclick="downloadSi('${si.id}')">Download PDF</button>
      <a class="btn btn-secondary btn-sm" href="/shipping-instruction.html?id=${si.id}">Edit</a>
      <button class="btn btn-secondary btn-sm" onclick="duplicateSi('${si.id}')">Duplicate</button>
    </div>`;

  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ---------- DOWNLOAD PDF ----------
async function downloadSi(id) {
  const { data: si } = await supabase
    .from('shipping_instructions').select('*').eq('id', id).single();
  const { data: items } = await supabase
    .from('shipping_instruction_items').select('*').eq('shipping_instruction_id', id).order('created_at');
  if (!si) return alert('Shipping instruction not found.');

  const branding = await getBranding(); // js/branding.js
  const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
  await generateShippingInstructionPDF({
    shipping_instruction: si,
    shipper: {
      company_name: si.shipper_name, pic: si.shipper_pic,
      address: si.shipper_address, city: si.shipper_city,
      country: si.shipper_country, phone: si.shipper_phone, email: si.shipper_email,
    },
    consignee: {
      company_name: si.consignee_name, pic: si.consignee_pic,
      address: si.consignee_address, city: si.consignee_city,
      country: si.consignee_country, phone: si.consignee_phone, email: si.consignee_email,
    },
    notifyParty: {
      company_name: si.notify_party_name, pic: si.notify_party_pic,
      address: si.notify_party_address, city: si.notify_party_city,
      country: si.notify_party_country, phone: si.notify_party_phone, email: si.notify_party_email,
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
async function duplicateSi(id) {
  if (!confirm('Duplicate this shipping instruction?\nA new shipping instruction with a new number will be created.')) return;

  const { data: si, error } = await supabase
    .from('shipping_instructions').select('*').eq('id', id).single();
  if (error) return alert('Load failed: ' + error.message);

  const { data: items } = await supabase
    .from('shipping_instruction_items').select('*').eq('shipping_instruction_id', id);

  const newNumber = await nextSiNumber();

  const { id:_, created_at, updated_at, si_number, ...copy } = si;
  copy.si_number = newNumber;
  copy.status = 'draft';
  copy.si_date = new Date().toISOString().slice(0, 10);

  const { data: saved, error: insErr } = await supabase
    .from('shipping_instructions').insert(copy).select().single();
  if (insErr) return alert('Duplicate failed: ' + insErr.message);

  if (items?.length) {
    const { error: itemErr } = await supabase.from('shipping_instruction_items').insert(
      items.map(({ id:_, shipping_instruction_id, created_at, ...it }) =>
        ({ ...it, shipping_instruction_id: saved.id }))
    );
    if (itemErr) return alert('Cargo lines copy failed: ' + itemErr.message);
  }

  alert(`✅ Duplicated as ${newNumber}`);
  await loadSis();
}

// ---------- DELETE ----------
async function deleteSi(id, number) {
  if (!confirm(`Delete shipping instruction ${number}?\n\nThis action is PERMANENT and cannot be undone.`)) return;

  const { error } = await supabase
    .from('shipping_instructions').delete().eq('id', id);

  if (error) return alert('Delete failed: ' + error.message);
  await loadSis();
}

// ---------- Nomor baru utk duplikat ----------
async function nextSiNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('shipping_instructions')
    .select('*', { count: 'exact', head: true })
    .like('si_number', `SI-${year}-%`);
  return `SI-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}
