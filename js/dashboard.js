// ============================================
// DASHBOARD — render feature cards sesuai akses user
// PRD §9-13: locked feature tampil tapi non-klik,
// dengan pesan "Contact administrator to enable."
// ============================================

const FEATURE_CATALOG = [
  { key: 'invoice',               name: 'Commercial Invoice',     desc: 'Create professional export/import invoices with items, charges & totals.', href: '/invoice.html', historyHref: '/invoice-list.html' },
  { key: 'packing_list',          name: 'Packing List',           desc: 'Detail packages, weights & dimensions. Can be created from an invoice.',    href: '/packinglist.html', historyHref: '/packinglist-list.html' },
  { key: 'purchase_order',        name: 'Purchase Order',         desc: 'Issue POs to suppliers. (Coming soon)',                                     href: null },
  { key: 'shipping_rate',         name: 'Shipping Rate Checker',  desc: 'Look up shipping rates. (Coming soon)',                                     href: null },
  { key: 'duty_tax',              name: 'Duty & Tax Calculator',  desc: 'Estimate duties & taxes. (Coming soon)',                                    href: null },
  { key: 'proforma_invoice',      name: 'Proforma Invoice',       desc: 'Pre-shipment proforma documents. (Coming soon)',                            href: null },
  { key: 'quotation',             name: 'Quotation',              desc: 'Send price quotations to customers. (Coming soon)',                         href: null },
  { key: 'certificate_of_origin', name: 'Certificate of Origin',  desc: 'COO documents. (Coming soon)',                                              href: null },
  { key: 'landed_cost',           name: 'Landed Cost Calculator', desc: 'Total landed cost estimates. (Coming soon)',                                href: null },
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

  const grid = document.getElementById('feature-grid');
  grid.innerHTML = '';

  for (const f of FEATURE_CATALOG) {
    // Developer bypass; customer cek features map
    const enabled = isDev || session.features[f.key] === true;
    const comingSoon = f.href === null;

    const card = document.createElement('div');
    card.className = 'feature-card' + (enabled ? '' : ' locked');

    if (enabled && !comingSoon) {
      card.innerHTML = `
        <span class="badge badge-active">Active</span>
        <h3>${f.name}</h3>
        <p>${f.desc}</p>
        <div style="display:flex; gap:8px;">
          <a class="btn btn-primary" href="${f.href}">Open</a>
          ${f.historyHref ? `<a class="btn btn-secondary" href="${f.historyHref}">History</a>` : ''}
        </div>`;
    } else {
      card.innerHTML = `
        <span class="badge badge-locked">${comingSoon ? 'Coming Soon' : 'Locked'}</span>
        <h3>${f.name}</h3>
        <p>${f.desc}</p>
        <button class="btn btn-secondary" disabled ${
          !enabled && !comingSoon
            ? 'title="Contact administrator to enable this feature."' : ''
        }>
          ${comingSoon ? 'Unavailable' : '🔒 Locked'}
        </button>`;
    }
    grid.appendChild(card);
  }
})();
