// ============================================
// SALES ORDER — form logic, items, kalkulasi, save
// Mengikuti pola persis js/purchase-order.js (kebalikannya: kita JUAL ke
// Customer, bukan beli dari Supplier), yang mengikuti pola js/invoice.js:
//   - Tidak guest mode (feature 'sales_order' tidak auto-enable untuk
//     self-signup — lihat sql/18-sales-order.sql — jadi requireFeature()
//     biasa, bukan requireFeatureOrGuest())
//   - PRD §74 tetap berlaku: akun 'pending' -> PDF watermark
//   - Nomor otomatis SO-{YEAR}-{SEQ}, editable
//   - Edit existing SO via ?id=<uuid> di URL
// ============================================

let EDIT_ID = null; // null = create baru; berisi id = mode edit

(async function initSalesOrder() {
  const { allowed, session } = await requireFeature('sales_order');
  if (!session) return; // requireFeature() sudah redirect ke /login.html
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;
  // PRD §74: customer sudah login tapi akunnya masih 'pending'
  if (session.profile.status === 'pending') {
    document.getElementById('pending-warning').hidden = false;
  }

  EDIT_ID = new URLSearchParams(location.search).get('id');

  if (EDIT_ID) {
    await loadSoForEdit(EDIT_ID);
  } else {
    document.getElementById('f-so_date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-so_number').value = await nextSoNumber();
    addItemRow();
  }
})();

// ---------- LOAD UNTUK EDIT ----------
async function loadSoForEdit(id) {
  const { data: so, error } = await supabase
    .from('sales_orders').select('*').eq('id', id).single();
  if (error || !so) {
    alert('Sales order not found or you do not have access to it.');
    location.href = '/sales-order-list.html';
    return;
  }

  const { data: items } = await supabase
    .from('sales_order_items').select('*').eq('sales_order_id', id).order('created_at');

  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;">📦 ISG</a> / Edit Sales Order ${so.so_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-so_number', so.so_number);
  set('f-so_date', so.so_date);
  set('f-currency', so.currency || 'USD');
  set('f-payment_terms', so.payment_terms);
  set('f-delivery_terms', so.delivery_terms);
  set('f-expected_delivery_date', so.expected_delivery_date);
  set('f-reference_number', so.reference_number);
  set('f-other_charges', so.other_charges);
  set('f-discount', so.discount);
  set('f-notes', so.notes);

  set('f-customer_name', so.customer_name);
  set('f-customer_pic', so.customer_pic);
  set('f-customer_address', so.customer_address);
  set('f-customer_city', so.customer_city);
  set('f-customer_country', so.customer_country);
  set('f-customer_phone', so.customer_phone);
  set('f-customer_email', so.customer_email);
  set('f-ship_to_name', so.ship_to_name);
  set('f-ship_to_pic', so.ship_to_pic);
  set('f-ship_to_address', so.ship_to_address);
  set('f-ship_to_city', so.ship_to_city);
  set('f-ship_to_country', so.ship_to_country);
  set('f-ship_to_phone', so.ship_to_phone);
  set('f-ship_to_email', so.ship_to_email);

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

// ---------- NOMOR SO ----------
async function nextSoNumber() {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('sales_orders')
    .select('*', { count: 'exact', head: true })
    .like('so_number', `SO-${year}-%`);
  if (error) console.warn(error);
  return `SO-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}

function toggleNumberEdit() {
  const el = document.getElementById('f-so_number');
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
function collectSalesOrder() {
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
    sales_order: {
      so_number: v('f-so_number') === 'AUTO' ? null : v('f-so_number'),
      so_date: v('f-so_date') || null,
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
    customer: {
      company_name: v('f-customer_name'),
      pic: v('f-customer_pic'),
      address: v('f-customer_address'),
      city: v('f-customer_city'),
      country: v('f-customer_country'),
      phone: v('f-customer_phone'),
      email: v('f-customer_email'),
    },
    shipTo: {
      company_name: v('f-ship_to_name'),
      pic: v('f-ship_to_pic'),
      address: v('f-ship_to_address'),
      city: v('f-ship_to_city'),
      country: v('f-ship_to_country'),
      phone: v('f-ship_to_phone'),
      email: v('f-ship_to_email'),
    },
    items,
  };
}

// ---------- SOFT VALIDATION (PRD §32) ----------
function softValidation(data) {
  const missing = [];
  if (!data.customer.company_name) missing.push('Customer company name');
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
async function persistSalesOrder(data, status) {
  const session = await getSession();
  const so = {
    ...data.sales_order,
    user_id: session.user.id,
    status,
    customer_name:    data.customer.company_name,
    customer_pic:     data.customer.pic,
    customer_address: data.customer.address,
    customer_city:    data.customer.city,
    customer_country: data.customer.country,
    customer_phone:   data.customer.phone,
    customer_email:   data.customer.email,
    ship_to_name:     data.shipTo.company_name || null,
    ship_to_pic:      data.shipTo.pic || null,
    ship_to_address:  data.shipTo.address || null,
    ship_to_city:     data.shipTo.city || null,
    ship_to_country:  data.shipTo.country || null,
    ship_to_phone:    data.shipTo.phone || null,
    ship_to_email:    data.shipTo.email || null,
    so_number: data.sales_order.so_number || await nextSoNumber(),
  };

  let saved;
  if (EDIT_ID) {
    const { data: updated, error } = await supabase
      .from('sales_orders').update(so).eq('id', EDIT_ID).select().single();
    if (error) throw new Error('Update failed: ' + error.message);
    saved = updated;

    const { error: delErr } = await supabase
      .from('sales_order_items').delete().eq('sales_order_id', EDIT_ID);
    if (delErr) throw new Error('Failed to update items: ' + delErr.message);
  } else {
    const { data: created, error } = await supabase
      .from('sales_orders').insert(so).select().single();
    if (error) throw new Error('Save failed: ' + error.message);
    saved = created;
  }

  if (data.items.length) {
    const { error: iErr } = await supabase
      .from('sales_order_items')
      .insert(data.items.map(i => ({ ...i, sales_order_id: saved.id })));
    if (iErr) throw new Error('Items save failed: ' + iErr.message);
  }
  return saved;
}

async function saveOnly() {
  const data = collectSalesOrder();
  softValidation(data);

  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    await persistSalesOrder(data, 'draft');
    alert(EDIT_ID ? '✅ Sales order updated.' : '✅ Sales order saved as draft.');
    location.href = '/sales-order-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update Draft' : 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectSalesOrder();
  softValidation(data);

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistSalesOrder(data, 'final');
    const branding = await getBranding(); // js/branding.js
    const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
    await generateSalesOrderPDF({ ...data, sales_order: saved, branding, watermark }); // js/pdf.js
    alert((EDIT_ID ? '✅ Sales order updated & PDF downloaded.' : '✅ Sales order saved & PDF downloaded.')
      + (watermark ? '\n\n⏳ Your account is pending activation — the PDF still has a watermark.' : ''));
    location.href = '/sales-order-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
