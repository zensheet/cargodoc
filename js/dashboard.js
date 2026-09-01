// ============================================
// DASHBOARD — render feature cards sesuai akses user
// PRD §9-13: locked feature tampil tapi non-klik,
// dengan pesan "Contact administrator to enable."
// ============================================

const FEATURE_CATALOG = [
  { key: 'invoice',               name: 'Commercial Invoice',     desc: 'Buat invoice ekspor/impor profesional lengkap dengan items, charges & totals.', href: '/invoice.html', historyHref: '/invoice-list.html' },
  { key: 'packing_list',          name: 'Packing List',           desc: 'Detail packages, berat & dimensi. Bisa dibuat langsung dari sebuah invoice.',    href: '/packinglist.html', historyHref: '/packinglist-list.html' },
  // Proforma Invoice pakai halaman & tabel yang sama dengan Commercial
  // Invoice (dibedakan via doc_type) — jadi gateKey ikut feature 'invoice',
  // bukan toggle terpisah. Siapapun yang boleh bikin Commercial Invoice
  // otomatis boleh bikin Proforma juga.
  { key: 'proforma_invoice', gateKey: 'invoice', name: 'Proforma Invoice',
    desc: 'Penawaran pra-pengiriman untuk buyer mengurus pembayaran/LC — bisa di-convert jadi Commercial Invoice begitu shipment dikonfirmasi.',
    href: '/invoice.html?type=proforma', historyHref: '/invoice-list.html?type=proforma' },
  { key: 'purchase_order',        name: 'Purchase Order',         desc: 'Terbitkan PO ke supplier lengkap dengan daftar barang, terms & totalnya.',   href: '/purchase-order.html', historyHref: '/purchase-order-list.html' },
  { key: 'sales_order',           name: 'Sales Order',            desc: 'Konfirmasi order dari customer sebelum di-convert jadi invoice.',            href: '/sales-order.html', historyHref: '/sales-order-list.html' },
  { key: 'shipping_instruction',  name: 'Shipping Instruction',   desc: 'Instruksi ke forwarder/carrier soal booking, routing & detail B/L.',         href: '/shipping-instruction.html', historyHref: '/shipping-instruction-list.html' },
  { key: 'delivery_note',         name: 'Delivery Note',          desc: 'Bukti serah-terima barang, lengkap dengan items, kendaraan & tanda tangan.', href: '/delivery-note.html', historyHref: '/delivery-note-list.html' },
  { key: 'shipping_rate',         name: 'Shipping Rate Checker',  desc: 'Cek tarif pengiriman. (Segera hadir)',                                       href: null },
  { key: 'duty_tax',              name: 'Duty & Tax Calculator',  desc: 'Estimasi bea masuk & pajak. (Segera hadir)',                                 href: null },
  { key: 'quotation',             name: 'Quotation',              desc: 'Kirim penawaran harga ke customer. (Segera hadir)',                          href: null },
  { key: 'certificate_of_origin', name: 'Certificate of Origin',  desc: 'Dokumen COO. (Segera hadir)',                                                href: null },
  { key: 'landed_cost',           name: 'Landed Cost Calculator', desc: 'Estimasi total landed cost. (Segera hadir)',                                 href: null },
];

(async function initDashboard() {
  // Developer juga boleh lihat dashboard user-view
  const session = await requireAuth();
  if (!session) return;

  const isDev = session.profile.role === 'developer';
  if (isDev) document.getElementById('nav-admin-link').hidden = false;

  document.getElementById('user-name').textContent = session.profile.email;
  document.getElementById('welcome-name').textContent =
    session.profile.full_name || session.profile.email;

  // PRD §74: kasih tau customer kalau akunnya masih 'pending' (self-signup,
  // belum diaktivasi admin) -- dia tetap bisa pakai app, cuma PDF-nya
  // masih watermark.
  if (!isDev && session.profile.status === 'pending') {
    document.getElementById('pending-banner').hidden = false;
  }

  const grid = document.getElementById('feature-grid');
  grid.innerHTML = '';

  for (const f of FEATURE_CATALOG) {
    // Developer bypass; customer cek features map (gateKey dipakai kalau
    // kartu ini menumpang feature lain, mis. Proforma Invoice -> 'invoice')
    const enabled = isDev || session.features[f.gateKey || f.key] === true;
    const comingSoon = f.href === null;

    const card = document.createElement('div');
    card.className = 'feature-card' + (enabled ? '' : ' locked');

    if (enabled && !comingSoon) {
      card.innerHTML = `
        <span class="badge badge-active">Aktif</span>
        <h3>${f.name}</h3>
        <p>${f.desc}</p>
        <div style="display:flex; gap:8px;">
          <a class="btn btn-primary" href="${f.href}">Buka</a>
          ${f.historyHref ? `<a class="btn btn-secondary" href="${f.historyHref}">Riwayat</a>` : ''}
        </div>`;
    } else {
      card.innerHTML = `
        <span class="badge badge-locked">${comingSoon ? 'Segera Hadir' : 'Terkunci'}</span>
        <h3>${f.name}</h3>
        <p>${f.desc}</p>
        <button class="btn btn-secondary" disabled ${
          !enabled && !comingSoon
            ? 'title="Hubungi administrator untuk mengaktifkan fitur ini."' : ''
        }>
          ${comingSoon ? 'Belum Tersedia' : '🔒 Terkunci'}
        </button>`;
    }
    grid.appendChild(card);
  }
})();
