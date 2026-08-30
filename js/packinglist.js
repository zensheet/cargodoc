// ============================================
// PACKING LIST — form, packages, from-invoice flow
// PRD §41-44
//   - Bisa dibuat manual ATAU dari invoice (items otomatis terisi)
//   - CBM dihitung otomatis dari L x W x H (cm)
//   - Soft validation, bukan blocking
// ============================================

(async function initPackingList() {
  const { allowed, session } = await requireFeature('packing_list');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;

  document.getElementById('f-pl_date').value =
    new Date().toISOString().slice(0, 10);

  document.getElementById('f-pl_number').value = await nextPlNumber();

  addPkgRow();
  await loadInvoiceOptions();
})();

// ---------- NOMOR PACKING LIST ----------
async function nextPlNumber() {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('packing_lists')
    .select('*', { count: 'exact', head: true })
    .like('packing_list_number', `PL-${year}-%`);
  if (error) console.warn(error);
  return `PL-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}

function togglePlNumberEdit() {
  const el = document.getElementById('f-pl_number');
  el.readOnly = !el.readOnly;
  if (!el.readOnly) el.focus();
  else if (!el.value.trim()) el.value = 'AUTO';
}

// ---------- SOURCE INVOICE OPTIONS ----------
// PRD §41: hanya invoice milik user sendiri (RLS juga menjaga di DB)
async function loadInvoiceOptions() {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, receiver_name')
    .order('created_at', { ascending: false })
    .limit(50);

  const sel = document.getElementById('f-source_invoice');
  (invoices || []).forEach(inv => {
    const opt = document.createElement('option');
    opt.value = inv.id;
    opt.textContent = `${inv.invoice_number}${inv.receiver_name ? ' — ' + inv.receiver_name : ''}`;
    sel.appendChild(opt);
  });
}

// ---------- FROM INVOICE FLOW (PRD §41) ----------
// Mengambil items dari invoice terpilih + shipper/receiver snapshot,
// lalu mengisi form. User masih bisa edit sebelum save.
async function loadFromInvoice() {
  const invoiceId = document.getElementById('f-source_invoice').value;
  if (!invoiceId) return;

  if (!confirm('Load data from this invoice?\nCurrent form contents will be replaced.')) {
    document.getElementById('f-source_invoice').value = '';
    return;
  }

  const { data: inv, error } = await supabase
    .from('invoices').select('*').eq('id', invoiceId).single();
  if (error || !inv) return alert('Failed to load invoice: ' + (error?.message || 'not found'));

  const { data: items } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', invoiceId).order('created_at');

  // Shipper / receiver snapshot dari invoice
  const set = (id, val) => { document.getElementById(id).value = val || ''; };
  set('f-shipper_name',    inv.shipper_name);
  set('f-shipper_pic',     inv.shipper_pic);
  set('f-shipper_address', inv.shipper_address);
  set('f-shipper_city',    inv.shipper_city);
  set('f-shipper_country', inv.shipper_country);
  set('f-shipper_phone',   inv.shipper_phone);
  set('f-shipper_email',   inv.shipper_email);
  set('f-receiver_name',    inv.receiver_name);
  set('f-receiver_pic',     inv.receiver_pic);
  set('f-receiver_address', inv.receiver_address);
  set('f-receiver_city',    inv.receiver_city);
  set('f-receiver_country', inv.receiver_country);
  set('f-receiver_phone',   inv.receiver_phone);
  set('f-receiver_email',   inv.receiver_email);

  // Items invoice -> baris packages (satu item = satu package row, editable)
  const tbody = document.querySelector('#packages-table tbody');
  tbody.innerHTML = '';

  if (items?.length) {
    items.forEach((it, idx) => {
      addPkgRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.p-package_number').value = String(idx + 1);
      tr.querySelector('.p-description').value = it.description || '';
      tr.querySelector('.p-quantity').value = it.quantity ?? '';
      tr.querySelector('.p-unit').value = it.unit || 'PCS';
      // weights/dimensi tidak ada di invoice -> user isi manual
    });
  } else {
    addPkgRow();
  }

  recalcTotals();
}

// ---------- PACKAGES TABLE ----------
function addPkgRow() {
  const tbody = document.querySelector('#packages-table tbody');
  const n = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="p-package_number" value="${n}" style="text-align:center;"></td>
    <td><input class="p-description" placeholder="Goods description"></td>
    <td><input class="p-quantity" type="number" step="0.01" oninput="recalcTotals()"></td>
    <td><input class="p-unit" value="PCS"></td>
    <td><input class="p-net_weight" type="number" step="0.01" oninput="recalcTotals()"></td>
    <td><input class="p-gross_weight" type="number" step="0.01" oninput="recalcTotals()"></td>
    <td><input class="p-length" type="number" step="0.1" oninput="recalcTotals()"></td>
    <td><input class="p-width" type="number" step="0.1" oninput="recalcTotals()"></td>
    <td><input class="p-height" type="number" step="0.1" oninput="recalcTotals()"></td>
    <td><input class="p-cbm" type="number" step="0.0001" readonly tabindex="-1"></td>
    <td><input class="p-package_type" value="CARTON"></td>
    <td><button class="btn btn-danger btn-sm" type="button"
        onclick="this.closest('tr').remove(); renumberPackages(); recalcTotals();">×</button></td>`;
  tbody.appendChild(tr);
}

// Renumber package number setelah baris dihapus
function renumberPackages() {
  document.querySelectorAll('#packages-table tbody tr').forEach((tr, i) => {
    tr.querySelector('.p-package_number').value = String(i + 1);
  });
}

function recalcTotals() {
  let totalQty = 0, totalNet = 0, totalGross = 0, totalCbm = 0, pkgCount = 0;

  document.querySelectorAll('#packages-table tbody tr').forEach(tr => {
    const g = cls => parseFloat(tr.querySelector(cls).value) || 0;
    const hasContent = tr.querySelector('.p-description').value.trim()
      || g('.p-quantity') > 0 || g('.p-gross_weight') > 0;
    if (!hasContent) return;

    pkgCount++;
    totalQty   += g('.p-quantity');
    totalNet   += g('.p-net_weight');
    totalGross += g('.p-gross_weight');

    // PRD §43: CBM = L x W x H (cm) / 1.000.000 — kosong = 0, tidak crash
    const cbm = (g('.p-length') * g('.p-width') * g('.p-height')) / 1_000_000;
    tr.querySelector('.p-cbm').value = cbm.toFixed(4);
    totalCbm += cbm;
  });

  document.getElementById('t-packages').textContent = pkgCount;
  document.getElementById('t-qty').textContent = totalQty.toLocaleString('en-US');
  document.getElementById('t-net').textContent = totalNet.toFixed(2);
  document.getElementById('t-gross').textContent = totalGross.toFixed(2);
  document.getElementById('t-cbm').textContent = totalCbm.toFixed(4);
}

// ---------- COLLECT DATA ----------
function collectPackingList() {
  const v = id => document.getElementById(id).value.trim();

  const packages = [];
  document.querySelectorAll('#packages-table tbody tr').forEach(tr => {
    const g = cls => tr.querySelector(cls).value.trim();
    const num = cls => parseFloat(tr.querySelector(cls).value) || 0;
    const desc = g('.p-description');
    if (!desc && !num('.p-quantity') && !num('.p-gross_weight')) return; // skip kosong
    packages.push({
      package_number: g('.p-package_number') || null,
      description: desc || null,
      quantity: num('.p-quantity'),
      unit: g('.p-unit') || null,
      net_weight: num('.p-net_weight'),
      gross_weight: num('.p-gross_weight'),
      length: num('.p-length'),
      width: num('.p-width'),
      height: num('.p-height'),
      cbm: +((num('.p-length') * num('.p-width') * num('.p-height')) / 1_000_000).toFixed(4),
      package_type: g('.p-package_type') || null,
    });
  });

  const totals = packages.reduce((t, p) => ({
    qty: t.qty + p.quantity, net: t.net + p.net_weight,
    gross: t.gross + p.gross_weight, cbm: t.cbm + p.cbm,
  }), { qty: 0, net: 0, gross: 0, cbm: 0 });

  return {
    packing_list: {
      packing_list_number: v('f-pl_number') === 'AUTO' ? null : v('f-pl_number'),
      packing_list_date: v('f-pl_date') || null,
      source_invoice_id: v('f-source_invoice') || null,
      marks_numbers: v('f-marks') || null,
      total_packages: packages.length,
      total_quantity: +totals.qty.toFixed(2),
      total_net_weight: +totals.net.toFixed(2),
      total_gross_weight: +totals.gross.toFixed(2),
      total_cbm: +totals.cbm.toFixed(4),
      status: 'draft',
    },
    shipper: {
      company_name: v('f-shipper_name'), pic: v('f-shipper_pic'),
      address: v('f-shipper_address'), city: v('f-shipper_city'),
      country: v('f-shipper_country'), phone: v('f-shipper_phone'),
      email: v('f-shipper_email'),
    },
    receiver: {
      company_name: v('f-receiver_name'), pic: v('f-receiver_pic'),
      address: v('f-receiver_address'), city: v('f-receiver_city'),
      country: v('f-receiver_country'), phone: v('f-receiver_phone'),
      email: v('f-receiver_email'),
    },
    packages,
  };
}

// ---------- SOFT VALIDATION (PRD §44) ----------
function softValidationPl(data) {
  const missing = [];
  if (!data.shipper.company_name) missing.push('Shipper company name');
  if (!data.receiver.company_name) missing.push('Receiver company name');
  if (!data.packages.length) missing.push('Packages');
  if (missing.length) {
    const box = document.getElementById('soft-warning');
    box.textContent = `⚠ Recommended information is missing: ${missing.join(', ')}. ` +
      'You can still generate this document, but it may look incomplete.';
    box.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return false;
  }
  document.getElementById('soft-warning').hidden = true;
  return true;
}

// ---------- SAVE ----------
async function persistPackingList(data, status) {
  const session = await getSession();
  const pl = {
    ...data.packing_list,
    user_id: session.user.id,
    status,
    packing_list_number: data.packing_list.packing_list_number
      || await nextPlNumber(),
    // snapshot shipper/receiver
    shipper_name:     data.shipper.company_name,
    shipper_pic:      data.shipper.pic,
    shipper_address:  data.shipper.address,
    shipper_city:     data.shipper.city,
    shipper_country:  data.shipper.country,
    shipper_phone:    data.shipper.phone,
    shipper_email:    data.shipper.email,
    receiver_name:     data.receiver.company_name,
    receiver_pic:      data.receiver.pic,
    receiver_address:  data.receiver.address,
    receiver_city:     data.receiver.city,
    receiver_country:  data.receiver.country,
    receiver_phone:    data.receiver.phone,
    receiver_email:    data.receiver.email,
  };

  const { data: saved, error } = await supabase
    .from('packing_lists').insert(pl).select().single();
  if (error) throw new Error('Save failed: ' + error.message);

  if (data.packages.length) {
    const { error: pErr } = await supabase
      .from('packing_list_items')
      .insert(data.packages.map(p => ({ ...p, packing_list_id: saved.id })));
    if (pErr) throw new Error('Packages save failed: ' + pErr.message);
  }
  return saved;
}

async function saveOnly() {
  const data = collectPackingList();
  softValidationPl(data);
  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await persistPackingList(data, 'draft');
    alert('✅ Packing list saved as draft.');
    location.href = '/packinglist-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false; btn.textContent = 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectPackingList();
  softValidationPl(data);
  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const saved = await persistPackingList(data, 'final');
    generatePackingListPDF({ packing_list: saved, ...data });
    alert('✅ Packing list saved & PDF downloaded.');
    location.href = '/packinglist-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false; btn.textContent = 'Save & Download PDF';
  }
}
