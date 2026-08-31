// ============================================
// PACKING LIST LIST — history, view, duplicate, delete
// Konsisten perilaku dengan invoice-list.js (PRD §25-26)
// ============================================

let ALL_PLS = [];

(async function initPlList() {
  const { allowed, session } = await requireFeature('packing_list');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  await loadPls();
})();

// ---------- LOAD ----------
async function loadPls() {
  const container = document.getElementById('list-container');
  container.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';

  const { data, error } = await supabase
    .from('packing_lists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    return;
  }
  ALL_PLS = data || [];
  renderList();
}

// ---------- RENDER ----------
function renderList() {
  const container = document.getElementById('list-container');
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;

  const filtered = ALL_PLS.filter(pl => {
    const matchSearch = !search
      || pl.packing_list_number.toLowerCase().includes(search)
      || (pl.receiver_name || '').toLowerCase().includes(search);
    const matchStatus = !status || pl.status === status;
    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    container.innerHTML = `
      <div class="feature-card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">
          ${ALL_PLS.length ? 'No packing lists match your filter.' : 'No packing lists yet.'}
        </p>
        <a class="btn btn-primary" style="margin-top:12px;" href="/packinglist.html">+ Create First Packing List</a>
      </div>`;
    return;
  }

  const rows = filtered.map(pl => `
    <tr>
      <td><strong>${esc(pl.packing_list_number)}</strong></td>
      <td>${esc(pl.packing_list_date || '—')}</td>
      <td>${esc(pl.receiver_name || '—')}</td>
      <td style="text-align:center;">${pl.total_packages ?? '—'}</td>
      <td style="text-align:right;">${(pl.total_gross_weight ?? 0).toFixed(2)} kg</td>
      <td style="text-align:right;">${(pl.total_cbm ?? 0).toFixed(4)}</td>
      <td><span class="badge ${pl.status === 'final' ? 'badge-active' : 'badge-locked'}">${esc(pl.status)}</span></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-secondary btn-sm" onclick="viewPl('${pl.id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/packinglist.html?id=${pl.id}">Edit</a>
        <button class="btn btn-secondary btn-sm" onclick="downloadPl('${pl.id}')">PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicatePl('${pl.id}')">Duplicate</button>
        <button class="btn btn-danger btn-sm" onclick="deletePl('${pl.id}', '${esc(pl.packing_list_number)}')">Delete</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>PL No.</th><th>Date</th><th>Receiver</th>
          <th style="text-align:center;">Packages</th>
          <th style="text-align:right;">Gross Wt</th>
          <th style="text-align:right;">CBM</th>
          <th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- VIEW ----------
async function viewPl(id) {
  const pl = ALL_PLS.find(p => p.id === id);
  if (!pl) return;

  const { data: packages } = await supabase
    .from('packing_list_items').select('*').eq('packing_list_id', id)
    .order('created_at');

  const rows = (packages || []).map(p => `
    <tr>
      <td>${esc(p.package_number || '—')}</td>
      <td>${esc(p.description || '—')}</td>
      <td style="text-align:right;">${p.quantity ?? 0} ${esc(p.unit || '')}</td>
      <td style="text-align:right;">${(p.net_weight || 0).toFixed(2)}</td>
      <td style="text-align:right;">${(p.gross_weight || 0).toFixed(2)}</td>
      <td style="text-align:right;">${(p.cbm || 0).toFixed(4)}</td>
      <td>${esc(p.package_type || '—')}</td>
    </tr>`).join('');

  document.getElementById('modal-title').textContent = pl.packing_list_number;
  const trailHtml = await renderDocTrail('pl', pl); // js/doc-trail.js
  document.getElementById('modal-body').innerHTML = `
    <p><strong>Date:</strong> ${esc(pl.packing_list_date || '—')} &nbsp;
       <strong>Status:</strong> ${esc(pl.status)}</p>
    <p><strong>Receiver:</strong> ${esc(pl.receiver_name || '—')}
       ${pl.receiver_pic ? `(${esc(pl.receiver_pic)})` : ''}</p>
    ${pl.marks_numbers ? `<p><strong>Marks/Notes:</strong> ${esc(pl.marks_numbers)}</p>` : ''}
    ${trailHtml}
    <table class="data-table" style="margin-top:10px;">
      <thead><tr><th>Pkg</th><th>Description</th><th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Net</th><th style="text-align:right;">Gross</th>
        <th style="text-align:right;">CBM</th><th>Type</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No packages</td></tr>'}</tbody>
    </table>
    <div style="text-align:right; margin-top:12px; font-size:15px;">
      <strong style="font-size:17px;">
        ${pl.total_packages ?? 0} packages ·
        ${(pl.total_gross_weight || 0).toFixed(2)} kg ·
        ${(pl.total_cbm || 0).toFixed(4)} CBM
      </strong>
    </div>
    <div style="margin-top:16px; display:flex; gap:10px;">
      <button class="btn btn-primary btn-sm" onclick="downloadPl('${pl.id}')">Download PDF</button>
      <a class="btn btn-secondary btn-sm" href="/packinglist.html?id=${pl.id}">Edit</a>
      <button class="btn btn-secondary btn-sm" onclick="duplicatePl('${pl.id}')">Duplicate</button>
    </div>`;

  document.getElementById('modal-overlay').hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

// ---------- DOWNLOAD PDF ----------
async function downloadPl(id) {
  const { data: pl } = await supabase
    .from('packing_lists').select('*').eq('id', id).single();
  const { data: packages } = await supabase
    .from('packing_list_items').select('*').eq('packing_list_id', id)
    .order('created_at');
  if (!pl) return alert('Packing list not found.');

  const branding = await getBranding(); // js/branding.js
  const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
  await generatePackingListPDF({
    packing_list: pl,
    shipper: {
      company_name: pl.shipper_name, pic: pl.shipper_pic,
      address: pl.shipper_address, city: pl.shipper_city,
      country: pl.shipper_country, phone: pl.shipper_phone, email: pl.shipper_email,
    },
    receiver: {
      company_name: pl.receiver_name, pic: pl.receiver_pic,
      address: pl.receiver_address, city: pl.receiver_city,
      country: pl.receiver_country, phone: pl.receiver_phone, email: pl.receiver_email,
    },
    packages: packages || [],
    branding,
    watermark,
  });
  if (watermark) {
    alert('⏳ Your account is pending activation — this PDF still has a watermark. It will be removed once the administrator activates your account.');
  }
}

// ---------- DUPLICATE ----------
async function duplicatePl(id) {
  if (!confirm('Duplicate this packing list?\nA new packing list with a new number will be created.')) return;

  const { data: pl, error } = await supabase
    .from('packing_lists').select('*').eq('id', id).single();
  if (error) return alert('Load failed: ' + error.message);

  const { data: packages } = await supabase
    .from('packing_list_items').select('*').eq('packing_list_id', id);

  const newNumber = await nextPlNumber();
  const { id:_, created_at, updated_at, packing_list_number, ...copy } = pl;
  copy.packing_list_number = newNumber;
  copy.status = 'draft';
  copy.packing_list_date = new Date().toISOString().slice(0, 10);

  const { data: saved, error: insErr } = await supabase
    .from('packing_lists').insert(copy).select().single();
  if (insErr) return alert('Duplicate failed: ' + insErr.message);

  if (packages?.length) {
    const { error: pkgErr } = await supabase.from('packing_list_items').insert(
      packages.map(({ id:_, packing_list_id, created_at, ...p }) =>
        ({ ...p, packing_list_id: saved.id }))
    );
    if (pkgErr) return alert('Packages copy failed: ' + pkgErr.message);
  }

  alert(`✅ Duplicated as ${newNumber}`);
  await loadPls();
}

// ---------- DELETE ----------
async function deletePl(id, number) {
  if (!confirm(`Delete packing list ${number}?\n\nThis action is PERMANENT and cannot be undone.`)) return;
  const { error } = await supabase
    .from('packing_lists').delete().eq('id', id);
  if (error) return alert('Delete failed: ' + error.message);
  await loadPls();
}

async function nextPlNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('packing_lists')
    .select('*', { count: 'exact', head: true })
    .like('packing_list_number', `PL-${year}-%`);
  return `PL-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}
