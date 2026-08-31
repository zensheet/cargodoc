// ============================================
// PURCHASE ORDER — form logic, items, kalkulasi, save
// Mengikuti pola persis js/invoice.js (PRD §18-32), disederhanakan:
//   - Tidak guest mode (feature 'purchase_order' tidak auto-enable untuk
//     self-signup — lihat sql/17-purchase-order.sql — jadi requireFeature()
//     biasa, bukan requireFeatureOrGuest())
//   - PRD §74 tetap berlaku: akun 'pending' -> PDF watermark
//   - Nomor otomatis PO-{YEAR}-{SEQ}, editable
//   - Edit existing PO via ?id=<uuid> di URL
// ============================================

let EDIT_ID = null; // null = create baru; berisi id = mode edit

(async function initPurchaseOrder() {
  const { allowed, session } = await requireFeature('purchase_order');
  if (!session) return; // requireFeature() sudah redirect ke /login.html
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  // PRD §74: customer sudah login tapi akunnya masih 'pending'
  if (session.profile.status === 'pending') {
    document.getElementById('pending-warning').hidden = false;
  }

  EDIT_ID = new URLSearchParams(location.search).get('id');

  if (EDIT_ID) {
    await loadPoForEdit(EDIT_ID);
  } else {
    document.getElementById('f-po_date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-po_number').value = await nextPoNumber();
    addItemRow();
  }
})();

// ---------- LOAD UNTUK EDIT ----------
async function loadPoForEdit(id) {
  const { data: po, error } = await supabase
    .from('purchase_orders').select('*').eq('id', id).single();
  if (error || !po) {
    alert('Purchase order not found or you do not have access to it.');
    location.href = '/purchase-order-list.html';
    return;
  }

  const { data: items } = await supabase
    .from('purchase_order_items').select('*').eq('purchase_order_id', id).order('created_at');

  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;">📦 ISG</a> / Edit Purchase Order ${po.po_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-po_number', po.po_number);
  set('f-po_date', po.po_date);
  set('f-currency', po.currency || 'USD');
  set('f-payment_terms', po.payment_terms);
  set('f-delivery_terms', po.delivery_terms);
  set('f-expected_delivery_date', po.expected_delivery_date);
  set('f-reference_number', po.reference_number);
  set('f-other_charges', po.other_charges);
  set('f-discount', po.discount);
  set('f-notes', po.notes);

  set('f-supplier_name', po.supplier_name);
  set('f-supplier_pic', po.supplier_pic);
  set('f-supplier_address', po.supplier_address);
  set('f-supplier_city', po.supplier_city);
  set('f-supplier_country', po.supplier_country);
  set('f-supplier_phone', po.supplier_phone);
  set('f-supplier_email', po.supplier_email);
  set('f-deliver_to_name', po.deliver_to_name);
  set('f-deliver_to_pic', po.deliver_to_pic);
  set('f-deliver_to_address', po.deliver_to_address);
  set('f-deliver_to_city', po.deliver_to_city);
  set('f-deliver_to_country', po.deliver_to_country);
  set('f-deliver_to_phone', po.deliver_to_phone);
  set('f-deliver_to_email', po.deliver_to_email);

  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (items?.length) {
    items.forEach(it => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = it.description || '';
      tr.querySelector('.i-sku').value = it.sku || '';
      tr.querySelector('.i-quantity').value = it.quantity ?? '';
      tr.querySelector('.i-unit').value = it.unit || 'PCS';
      tr.querySelector('.i-unit_price').value = it.unit_price ?? '';
      tr.querySelector('.i-amount').value = it.amount ?? '';
    });
  } else {
    addItemRow();
  }

  recalc();
}

// ---------- NOMOR PO ----------
async function nextPoNumber() {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .like('po_number', `PO-${year}-%`);
  if (error) console.warn(error);
  return `PO-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}

function toggleNumberEdit() {
  const el = document.getElementById('f-po_number');
  el.readOnly = !el.readOnly;
  if (!el.readOnly) el.focus();
  else if (!el.value.trim()) el.value = 'AUTO';
}

// ---------- ITEMS TABLE ----------
function addItemRow() {
  const tbody = document.querySelector('#items-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="i-description" placeholder="Item description"></td>
    <td><input class="i-sku" placeholder="SKU"></td>
    <td><input class="i-quantity" type="number" step="0.01" oninput="calcRow(this)"></td>
    <td><input class="i-unit" value="PCS"></td>
    <td><input class="i-unit_price" type="number" step="0.01" oninput="calcRow(this)"></td>
    <td><input class="i-amount" type="number" step="0.01" readonly tabindex="-1"></td>
    <td><button class="btn btn-danger btn-sm" type="button"
        onclick="this.closest('tr').remove(); recalc();">×</button></td>`;
  tbody.appendChild(tr);
}

function calcRow(input) {
  const tr = input.closest('tr');
  const qty = parseFloat(tr.querySelector('.i-quantity').value) || 0;
  const price = parseFloat(tr.querySelector('.i-unit_price').value) || 0;
  tr.querySelector('.i-amount').value = (qty * price).toFixed(2);
  recalc();
}

function recalc() {
  let subtotal = 0;
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    subtotal += parseFloat(tr.querySelector('.i-amount').value) || 0;
  });
  const other    = parseFloat(document.getElementById('f-other_charges').value) || 0;
  const discount = parseFloat(document.getElementById('f-discount').value) || 0;
  const grand = subtotal + other - discount;

  const cur = document.getElementById('f-currency').value;
  document.getElementById('t-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('t-grand').textContent = grand.toFixed(2);
  ['t-currency', 't-currency3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = cur;
  });
}

// ---------- COLLECT DATA ----------
function collectPurchaseOrder() {
  const v = id => document.getElementById(id).value.trim();

  const items = [];
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    const desc = tr.querySelector('.i-description').value.trim();
    if (!desc) return;
    items.push({
      description: desc,
      sku: tr.querySelector('.i-sku').value.trim(),
      quantity: parseFloat(tr.querySelector('.i-quantity').value) || 0,
      unit: tr.querySelector('.i-unit').value.trim(),
      unit_price: parseFloat(tr.querySelector('.i-unit_price').value) || 0,
      amount: parseFloat(tr.querySelector('.i-amount').value) || 0,
    });
  });

  const charges = {
    other_charges: parseFloat(v('f-other_charges')) || 0,
    discount:      parseFloat(v('f-discount')) || 0,
  };
  const subtotal = items.reduce((s, i) => s + i.amount, 0);

  return {
    purchase_order: {
      po_number: v('f-po_number') === 'AUTO' ? null : v('f-po_number'),
      po_date: v('f-po_date') || null,
      currency: v('f-currency'),
      payment_terms: v('f-payment_terms') || null,
      delivery_terms: v('f-delivery_terms') || null,
      expected_delivery_date: v('f-expected_delivery_date') || null,
      reference_number: v('f-reference_number') || null,
      notes: v('f-notes') || null,
      subtotal: +subtotal.toFixed(2),
      ...charges,
      grand_total: +(subtotal + charges.other_charges - charges.discount).toFixed(2),
      status: 'draft',
    },
    supplier: {
      company_name: v('f-supplier_name'),
      pic: v('f-supplier_pic'),
      address: v('f-supplier_address'),
      city: v('f-supplier_city'),
      country: v('f-supplier_country'),
      phone: v('f-supplier_phone'),
      email: v('f-supplier_email'),
    },
    deliverTo: {
      company_name: v('f-deliver_to_name'),
      pic: v('f-deliver_to_pic'),
      address: v('f-deliver_to_address'),
      city: v('f-deliver_to_city'),
      country: v('f-deliver_to_country'),
      phone: v('f-deliver_to_phone'),
      email: v('f-deliver_to_email'),
    },
    items,
  };
}

// ---------- SOFT VALIDATION (PRD §32) ----------
function softValidation(data) {
  const missing = [];
  if (!data.supplier.company_name) missing.push('Supplier company name');
  if (!data.items.length) missing.push('Items');
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
async function persistPurchaseOrder(data, status) {
  const session = await getSession();
  const po = {
    ...data.purchase_order,
    user_id: session.user.id,
    status,
    supplier_name:    data.supplier.company_name,
    supplier_pic:     data.supplier.pic,
    supplier_address: data.supplier.address,
    supplier_city:    data.supplier.city,
    supplier_country: data.supplier.country,
    supplier_phone:   data.supplier.phone,
    supplier_email:   data.supplier.email,
    deliver_to_name:     data.deliverTo.company_name || null,
    deliver_to_pic:      data.deliverTo.pic || null,
    deliver_to_address:  data.deliverTo.address || null,
    deliver_to_city:     data.deliverTo.city || null,
    deliver_to_country:  data.deliverTo.country || null,
    deliver_to_phone:    data.deliverTo.phone || null,
    deliver_to_email:    data.deliverTo.email || null,
    po_number: data.purchase_order.po_number || await nextPoNumber(),
  };

  let saved;
  if (EDIT_ID) {
    const { data: updated, error } = await supabase
      .from('purchase_orders').update(po).eq('id', EDIT_ID).select().single();
    if (error) throw new Error('Update failed: ' + error.message);
    saved = updated;

    const { error: delErr } = await supabase
      .from('purchase_order_items').delete().eq('purchase_order_id', EDIT_ID);
    if (delErr) throw new Error('Failed to update items: ' + delErr.message);
  } else {
    const { data: created, error } = await supabase
      .from('purchase_orders').insert(po).select().single();
    if (error) throw new Error('Save failed: ' + error.message);
    saved = created;
  }

  if (data.items.length) {
    const { error: iErr } = await supabase
      .from('purchase_order_items')
      .insert(data.items.map(i => ({ ...i, purchase_order_id: saved.id })));
    if (iErr) throw new Error('Items save failed: ' + iErr.message);
  }
  return saved;
}

async function saveOnly() {
  const data = collectPurchaseOrder();
  softValidation(data);

  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    await persistPurchaseOrder(data, 'draft');
    alert(EDIT_ID ? '✅ Purchase order updated.' : '✅ Purchase order saved as draft.');
    location.href = '/purchase-order-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update Draft' : 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectPurchaseOrder();
  softValidation(data);

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistPurchaseOrder(data, 'final');
    const branding = await getBranding(); // js/branding.js
    const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
    await generatePurchaseOrderPDF({ ...data, purchase_order: saved, branding, watermark }); // js/pdf.js
    alert((EDIT_ID ? '✅ Purchase order updated & PDF downloaded.' : '✅ Purchase order saved & PDF downloaded.')
      + (watermark ? '\n\n⏳ Your account is pending activation — the PDF still has a watermark.' : ''));
    location.href = '/purchase-order-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
