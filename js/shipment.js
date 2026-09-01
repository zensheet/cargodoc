// ============================================
// SHIPMENT DASHBOARD — Tahap D (lihat BACKUP_STRUKTUR_DATABASE §16)
//
// Dibangun TANPA tabel `shipments` baru dan TANPA konsep Organization --
// murni menyusun ulang rantai `source_*_id` yang sudah ada di 6 tabel
// dokumen (lihat js/doc-trail.js untuk definisi DOC_CHAIN), jadi satu
// tampilan pohon dari titik manapun user datang.
//
// Alur:
//  1. Baca ?type=&id= dari URL (link "🔗 View Full Shipment Trail" dari
//     modal View di semua *-list.js sudah otomatis mengarah ke sini).
//  2. Jalan ke ATAS (upstream) sampai ketemu akar rantai (dokumen yang
//     tidak punya source_*_id, biasanya Purchase Order -- tapi bisa juga
//     Sales Order kalau user mulai dari situ tanpa PO).
//  3. Dari akar itu, jalan ke BAWAH (downstream) secara rekursif,
//     mengumpulkan SEMUA dokumen turunan di tiap level (satu dokumen bisa
//     jadi source untuk lebih dari satu dokumen berikutnya -- misal 1
//     Invoice sourced ke 2 Packing List beda pengiriman parsial).
//  4. Render sebagai pohon bertingkat, tiap simpul bisa diklik ke halaman
//     edit dokumennya, atau "re-center" pohon dari situ.
// ============================================

(async function initShipment() {
  const session = await requireAuth(); // js/guard.js
  if (!session) return;
  document.getElementById('user-name').textContent = session.profile.email;

  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const id = params.get('id');
  const container = document.getElementById('shipment-container');

  if (!type || !id || !docChainNode(type)) {
    container.innerHTML = `
      <div class="alert alert-error">
        No document specified. Open this page from the "🔗 View Full Shipment
        Trail" link inside any document's View screen.
      </div>`;
    return;
  }

  try {
    await renderShipment(type, id);
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">Failed to load shipment trail: ${e.message}</div>`;
  }
})();

// ---------- WALK UP ke akar rantai ----------
async function findChainRoot(type, id) {
  let node = docChainNode(type);
  let currentType = type;
  let currentId = id;

  while (node.sourceCol) {
    const { data: row, error } = await supabase
      .from(node.table).select('*').eq('id', currentId).maybeSingle();
    if (error || !row || !row[node.sourceCol]) break; // gak ada akses / gak ada source lagi -> berhenti di sini
    currentType = node.sourceKey;
    currentId = row[node.sourceCol];
    node = docChainNode(currentType);
  }
  return { type: currentType, id: currentId };
}

// ---------- WALK DOWN dari akar, kumpulin semua turunan (pohon) ----------
async function buildDownstreamTree(type, id) {
  const node = docChainNode(type);
  const { data: row, error } = await supabase
    .from(node.table).select('*').eq('id', id).maybeSingle();
  if (error || !row) return null; // dokumen ini gak keliatan (bukan milik user / sudah dihapus)

  const childNode = DOC_CHAIN.find(n => n.sourceKey === type);
  let children = [];
  if (childNode) {
    const { data: childRows } = await supabase
      .from(childNode.table).select('*').eq(childNode.sourceCol, id);
    if (childRows?.length) {
      children = (await Promise.all(
        childRows.map(c => buildDownstreamTree(childNode.key, c.id))
      )).filter(Boolean);
    }
  }
  return { type, row, children };
}

async function renderShipment(type, id) {
  const root = await findChainRoot(type, id);
  const tree = await buildDownstreamTree(root.type, root.id);
  const container = document.getElementById('shipment-container');

  if (!tree) {
    container.innerHTML = `<div class="alert alert-error">Document not found or you don't have access to it.</div>`;
    return;
  }

  const rootNode = docChainNode(root.type);
  const rootNumber = tree.row[rootNode.numberCol] || '(no number)';
  const startedElsewhere = root.type !== type;

  const explainer = startedElsewhere
    ? `<p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
         Menampilkan seluruh rantai dokumen, dimulai dari yang paling awal:
         <strong>${escShip(rootNode.label)} ${escShip(rootNumber)}</strong>.
       </p>`
    : '';

  container.innerHTML = `${explainer}<div style="display:flex; flex-direction:column; gap:2px;">${renderChainNode(tree, 0)}</div>`;
}

function renderChainNode(node, depth) {
  const n = docChainNode(node.type);
  const row = node.row;
  const number = row[n.numberCol] || '(no number)';
  const isCurrent = new URLSearchParams(location.search).get('id') === row.id;

  const statusBadge = row.status
    ? `<span class="badge ${row.status === 'final' ? 'badge-active' : 'badge-locked'}">${escShip(row.status)}</span>`
    : '';

  let html = `
    <div style="margin-left:${depth * 28}px; position:relative;">
      ${depth > 0 ? `<div style="position:absolute; left:-16px; top:22px; color:var(--text-muted); font-size:16px;">↳</div>` : ''}
      <div class="feature-card" style="padding:12px 16px; margin-bottom:8px; ${isCurrent ? 'border:2px solid var(--primary);' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase;">${escShip(n.label)}</span><br>
            <a href="/${n.page}?id=${row.id}" style="font-weight:600;">${escShip(number)}</a>
            ${statusBadge}
          </div>
          <a class="btn btn-secondary btn-sm" href="/shipment.html?type=${node.type}&id=${row.id}">Re-center Here</a>
        </div>
      </div>
    </div>`;

  if (node.children?.length) {
    node.children.forEach(child => { html += renderChainNode(child, depth + 1); });
  }
  return html;
}

function escShip(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
