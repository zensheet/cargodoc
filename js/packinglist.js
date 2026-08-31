// ============================================
// PACKING LIST — form, packages, from-invoice flow
// PRD §41-44
//   - Bisa dibuat manual ATAU dari invoice (items otomatis terisi)
//   - CBM dihitung otomatis dari L x W x H (cm)
//   - Soft validation, bukan blocking
//   - Edit existing packing list via ?id=<uuid> di URL (PRD §47)
// ============================================

let EDIT_PL_ID = null; // null = create baru; berisi id = mode edit
let IS_GUEST = false; // true = belum login (PRD §73 guest mode)

(async function initPackingList() {
  const { allowed, session, guest } = await requireFeatureOrGuest('packing_list');
  if (!allowed) { location.href = '/app.html'; return; }

  IS_GUEST = guest;
  if (guest) {
    renderGuestHeader(); // js/guest-auth.js
  } else {
    document.getElementById('user-name').textContent = session.profile.email;
    // PRD §74: customer sudah login tapi akunnya masih 'pending'
    if (session.profile.status === 'pending') {
      document.getElementById('pending-warning').hidden = false;
    }
  }

  EDIT_PL_ID = new URLSearchParams(location.search).get('id');

  // Invoice dropdown harus terisi options-nya DULU sebelum kita coba
  // set value-nya di loadPackingListForEdit (select butuh <option> yang
  // matching sudah ada dulu, baru assign .value bisa kepilih).
  await loadInvoiceOptions();

  if (EDIT_PL_ID) {
    await loadPackingListForEdit(EDIT_PL_ID);
  } else {
    document.getElementById('f-pl_date').value =
      new Date().toISOString().slice(0, 10);
    document.getElementById('f-pl_number').value = await nextPlNumber();
    addPkgRow();
  }
})();

// ---------- LOAD UNTUK EDIT ----------
async function loadPackingListForEdit(id) {
  const { data: pl, error } = await supabase
    .from('packing_lists').select('*').eq('id', id).single();
  if (error || !pl) {
    alert('Packing list not found or you do not have access to it.');
    location.href = '/packinglist-list.html';
    return;
  }

  const { data: packages } = await supabase
    .from('packing_list_items').select('*').eq('packing_list_id', id).order('created_at');

  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;"><img src="assets/logo-cargodoc.webp" alt="CargoDoc" style="height:18px;vertical-align:middle;"></a> / Edit Packing List ${pl.packing_list_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-pl_number', pl.packing_list_number);
  set('f-pl_date', pl.packing_list_date);
  set('f-source_invoice', pl.source_invoice_id || '');
  set('f-marks', pl.marks_numbers);

  set('f-shipper_name', pl.shipper_name);
  set('f-shipper_pic', pl.shipper_pic);
  set('f-shipper_address', pl.shipper_address);
  set('f-shipper_city', pl.shipper_city);
  set('f-shipper_country', pl.shipper_country);
  set('f-shipper_phone', pl.shipper_phone);
  set('f-shipper_email', pl.shipper_email);
  set('f-receiver_name', pl.receiver_name);
  set('f-receiver_pic', pl.receiver_pic);
  set('f-receiver_address', pl.receiver_address);
  set('f-receiver_city', pl.receiver_city);
  set('f-receiver_country', pl.receiver_country);
  set('f-receiver_phone', pl.receiver_phone);
  set('f-receiver_email', pl.receiver_email);

  set('f-bill_to_name', pl.bill_to_name);
  set('f-bill_to_pic', pl.bill_to_pic);
  set('f-bill_to_address', pl.bill_to_address);
  set('f-bill_to_city', pl.bill_to_city);
  set('f-bill_to_country', pl.bill_to_country);
  set('f-bill_to_phone', pl.bill_to_phone);
  set('f-bill_to_email', pl.bill_to_email);
  set('f-ship_to_name', pl.ship_to_name);
  set('f-ship_to_pic', pl.ship_to_pic);
  set('f-ship_to_address', pl.ship_to_address);
  set('f-ship_to_city', pl.ship_to_city);
  set('f-ship_to_country', pl.ship_to_country);
  set('f-ship_to_phone', pl.ship_to_phone);
  set('f-ship_to_email', pl.ship_to_email);

  const tbody = document.querySelector('#packages-table tbody');
  tbody.innerHTML = '';
  if (packages?.length) {
    packages.forEach(p => {
      addPkgRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.p-package_number').value = p.package_number || '';
      tr.querySelector('.p-description').value = p.description || '';
      tr.querySelector('.p-quantity').value = p.quantity ?? '';
      tr.querySelector('.p-unit').value = p.unit || 'PCS';
      tr.querySelector('.p-net_weight').value = p.net_weight ?? '';
      tr.querySelector('.p-gross_weight').value = p.gross_weight ?? '';
      tr.querySelector('.p-length').value = p.length ?? '';
      tr.querySelector('.p-width').value = p.width ?? '';
      tr.querySelector('.p-height').value = p.height ?? '';
      tr.querySelector('.p-cbm').value = p.cbm ?? '';
      tr.querySelector('.p-package_type').value = p.package_type || 'CARTON';
    });
  } else {
    addPkgRow();
  }

  window.EDIT_DOC_CUSTOM_FIELDS = pl.custom_fields || null;
  // FIX: lihat catatan sama di js/invoice.js loadInvoiceForEdit().
  if (typeof renderCustomFieldsUI === 'function') renderCustomFieldsUI();

  recalcTotals();
}


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

  if (!(await customConfirm('Load data from this invoice?\nCurrent form contents will be replaced.'))) {
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
  set('f-bill_to_name',     inv.bill_to_name);
  set('f-bill_to_pic',      inv.bill_to_pic);
  set('f-bill_to_address',  inv.bill_to_address);
  set('f-bill_to_city',     inv.bill_to_city);
  set('f-bill_to_country',  inv.bill_to_country);
  set('f-bill_to_phone',    inv.bill_to_phone);
  set('f-bill_to_email',    inv.bill_to_email);
  set('f-ship_to_name',     inv.ship_to_name);
  set('f-ship_to_pic',      inv.ship_to_pic);
  set('f-ship_to_address',  inv.ship_to_address);
  set('f-ship_to_city',     inv.ship_to_city);
  set('f-ship_to_country',  inv.ship_to_country);
  set('f-ship_to_phone',    inv.ship_to_phone);
  set('f-ship_to_email',    inv.ship_to_email);

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
    billTo: {
      company_name: v('f-bill_to_name'), pic: v('f-bill_to_pic'),
      address: v('f-bill_to_address'), city: v('f-bill_to_city'),
      country: v('f-bill_to_country'), phone: v('f-bill_to_phone'),
      email: v('f-bill_to_email'),
    },
    shipTo: {
      company_name: v('f-ship_to_name'), pic: v('f-ship_to_pic'),
      address: v('f-ship_to_address'), city: v('f-ship_to_city'),
      country: v('f-ship_to_country'), phone: v('f-ship_to_phone'),
      email: v('f-ship_to_email'),
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
    bill_to_name:     data.billTo.company_name || null,
    bill_to_pic:      data.billTo.pic || null,
    bill_to_address:  data.billTo.address || null,
    bill_to_city:     data.billTo.city || null,
    bill_to_country:  data.billTo.country || null,
    bill_to_phone:    data.billTo.phone || null,
    bill_to_email:    data.billTo.email || null,
    ship_to_name:     data.shipTo.company_name || null,
    ship_to_pic:      data.shipTo.pic || null,
    ship_to_address:  data.shipTo.address || null,
    ship_to_city:     data.shipTo.city || null,
    ship_to_country:  data.shipTo.country || null,
    ship_to_phone:    data.shipTo.phone || null,
    ship_to_email:    data.shipTo.email || null,
  };

  let saved;
  if (EDIT_PL_ID) {
    // ---- MODE EDIT: update row yang sudah ada ----
    const { data: updated, error } = await supabase
      .from('packing_lists').update(pl).eq('id', EDIT_PL_ID).select().single();
    if (error) throw new Error('Update failed: ' + error.message);
    saved = updated;

    // Packages: hapus semua yang lama, insert ulang dari form
    const { error: delErr } = await supabase
      .from('packing_list_items').delete().eq('packing_list_id', EDIT_PL_ID);
    if (delErr) throw new Error('Failed to update packages: ' + delErr.message);
  } else {
    // ---- MODE BARU: insert row baru ----
    const { data: created, error } = await supabase
      .from('packing_lists').insert(pl).select().single();
    if (error) throw new Error('Save failed: ' + error.message);
    saved = created;
  }

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

  if (IS_GUEST) {
    guestAuthGate(async () => {
      await persistPackingList(data, 'draft');
      showActivationModal({ justSaved: true, onClose: () => location.href = '/packinglist-list.html' });
    });
    return;
  }

  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = EDIT_PL_ID ? 'Updating...' : 'Saving...';
  try {
    await persistPackingList(data, 'draft');
    alert(EDIT_PL_ID ? '✅ Packing list updated.' : '✅ Packing list saved as draft.');
    location.href = '/packinglist-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_PL_ID ? 'Update Draft' : 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectPackingList();
  softValidationPl(data);

  if (IS_GUEST) {
    // 1) Preview watermark client-side -- TIDAK disimpan ke DB (PRD §73)
    const previewPl = { ...data.packing_list, packing_list_number: data.packing_list.packing_list_number || 'PREVIEW' };
    generatePackingListPDF({ packing_list: previewPl, ...data, branding: null, watermark: true });

    // 2) Modal signup/login ringan. Draft (`data`, masih di memori JS)
    //    baru benar-benar disimpan ke DB SETELAH auth sukses.
    guestAuthGate(async () => {
      const saved = await persistPackingList(data, 'final');
      const branding = await getBranding();
      // PRD §74: baru signup -> status masih 'pending', jadi PDF-nya
      // tetap watermark sampai admin klik "Activate".
      const watermark = accountNeedsWatermark(window.APP_SESSION);
      await generatePackingListPDF({ packing_list: saved, ...data, branding, watermark });
      if (watermark) {
        showActivationModal({ justSaved: true, onClose: () => location.href = '/packinglist-list.html' });
      } else {
        alert('✅ Account created & packing list saved. PDF downloaded.');
        location.href = '/packinglist-list.html';
      }
    });
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_PL_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistPackingList(data, 'final');
    const branding = await getBranding(); // js/branding.js
    const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
    await generatePackingListPDF({ packing_list: saved, ...data, branding, watermark });
    alert((EDIT_PL_ID ? '✅ Packing list updated & PDF downloaded.' : '✅ Packing list saved & PDF downloaded.')
      + (watermark ? '\n\n⏳ Your account is pending activation — the PDF still has a watermark.' : ''));
    location.href = '/packinglist-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_PL_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
