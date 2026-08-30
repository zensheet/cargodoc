// ============================================
// INVOICE — form logic, items, kalkulasi, save
// PRD §18-32
//   - Nomor invoice otomatis (INV-{YEAR}-{SEQ}), editable
//   - Items dinamis, amount & totals terhitung live
//   - Soft validation (PRD §32): warning, tidak blocking
//   - Save draft / save final + download PDF
//   - Edit existing invoice via ?id=<uuid> di URL (PRD §47, MVP #16)
// ============================================

let EDIT_ID = null; // null = create baru; berisi id = mode edit
let IS_GUEST = false; // true = belum login (PRD §73 guest mode)

(async function initInvoice() {
  // PRD §9 & §73: feature gate — bisa diakses guest (belum login) untuk
  // invoice/packing_list. UI layer saja; RLS tetap security utama.
  const { allowed, session, guest } = await requireFeatureOrGuest('invoice');
  if (!allowed) { location.href = '/app.html'; return; } // login tapi fitur di-lock

  IS_GUEST = guest;
  if (guest) {
    renderGuestHeader(); // js/guest-auth.js
  } else {
    document.getElementById('user-name').textContent = session.profile.email;
  }

  EDIT_ID = new URLSearchParams(location.search).get('id');

  if (EDIT_ID) {
    await loadInvoiceForEdit(EDIT_ID);
  } else {
    // Default date = hari ini
    document.getElementById('f-invoice_date').value =
      new Date().toISOString().slice(0, 10);

    // Nomor invoice otomatis
    document.getElementById('f-invoice_number').value = await nextInvoiceNumber();

    // Baris item pertama
    addItemRow();
  }
})();

// ---------- LOAD UNTUK EDIT ----------
async function loadInvoiceForEdit(id) {
  const { data: inv, error } = await supabase
    .from('invoices').select('*').eq('id', id).single();
  if (error || !inv) {
    alert('Invoice not found or you do not have access to it.');
    location.href = '/invoice-list.html';
    return;
  }

  const { data: items } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', id).order('created_at');

  // Header halaman & tombol -> jelasin ini mode edit
  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;">📦 ISG</a> / Edit Invoice ${inv.invoice_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-shipment_type', inv.shipment_type || 'export');
  set('f-invoice_number', inv.invoice_number);
  set('f-invoice_date', inv.invoice_date);
  set('f-currency', inv.currency || 'USD');
  set('f-payment_terms', inv.payment_terms);
  set('f-incoterms', inv.incoterms);
  set('f-po_number', inv.po_number);
  set('f-reference_number', inv.reference_number);
  set('f-port_of_loading', inv.port_of_loading);
  set('f-port_of_discharge', inv.port_of_discharge);
  set('f-final_destination', inv.final_destination);
  set('f-country_of_origin', inv.country_of_origin);
  set('f-awb_number', inv.awb_number);
  set('f-bl_number', inv.bl_number);
  set('f-container_number', inv.container_number);
  set('f-vessel_flight', inv.vessel_flight);
  set('f-freight', inv.freight);
  set('f-insurance', inv.insurance);
  set('f-other_charges', inv.other_charges);
  set('f-discount', inv.discount);

  set('f-shipper_name', inv.shipper_name);
  set('f-shipper_pic', inv.shipper_pic);
  set('f-shipper_address', inv.shipper_address);
  set('f-shipper_city', inv.shipper_city);
  set('f-shipper_country', inv.shipper_country);
  set('f-shipper_phone', inv.shipper_phone);
  set('f-shipper_email', inv.shipper_email);
  set('f-receiver_name', inv.receiver_name);
  set('f-receiver_pic', inv.receiver_pic);
  set('f-receiver_address', inv.receiver_address);
  set('f-receiver_city', inv.receiver_city);
  set('f-receiver_country', inv.receiver_country);
  set('f-receiver_phone', inv.receiver_phone);
  set('f-receiver_email', inv.receiver_email);

  set('f-bill_to_name', inv.bill_to_name);
  set('f-bill_to_pic', inv.bill_to_pic);
  set('f-bill_to_address', inv.bill_to_address);
  set('f-bill_to_city', inv.bill_to_city);
  set('f-bill_to_country', inv.bill_to_country);
  set('f-bill_to_phone', inv.bill_to_phone);
  set('f-bill_to_email', inv.bill_to_email);
  set('f-ship_to_name', inv.ship_to_name);
  set('f-ship_to_pic', inv.ship_to_pic);
  set('f-ship_to_address', inv.ship_to_address);
  set('f-ship_to_city', inv.ship_to_city);
  set('f-ship_to_country', inv.ship_to_country);
  set('f-ship_to_phone', inv.ship_to_phone);
  set('f-ship_to_email', inv.ship_to_email);

  // Items
  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (items?.length) {
    items.forEach(it => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = it.description || '';
      tr.querySelector('.i-hs_code').value = it.hs_code || '';
      tr.querySelector('.i-quantity').value = it.quantity ?? '';
      tr.querySelector('.i-unit').value = it.unit || 'PCS';
      tr.querySelector('.i-unit_price').value = it.unit_price ?? '';
      tr.querySelector('.i-amount').value = it.amount ?? '';
    });
  } else {
    addItemRow();
  }

  // Custom fields (diisi custom-fields.js kalau section-nya sudah ke-render)
  window.EDIT_DOC_CUSTOM_FIELDS = inv.custom_fields || null;
  // FIX: custom-fields.js merender section ini secara independen/async
  // (timing sendiri, tidak menunggu invoice.js). Kalau load invoice ini
  // (network call di atas) lebih lambat dari render pertama custom-fields.js,
  // nilai custom field yang sudah tersimpan akan terlewat ke-prefill.
  // Re-trigger render di sini supaya prefill selalu kepakai begitu data
  // dokumennya sudah siap, terlepas dari urutan timing keduanya.
  if (typeof renderCustomFieldsUI === 'function') renderCustomFieldsUI();

  recalc();
}


// ---------- NOMOR INVOICE (PRD §30) ----------
async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .like('invoice_number', `INV-${year}-%`);
  if (error) console.warn(error);
  return `INV-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}

// Edit manual (default readonly) — mode auto di-restore kalau dikosongkan
function toggleNumberEdit() {
  const el = document.getElementById('f-invoice_number');
  el.readOnly = !el.readOnly;
  if (!el.readOnly) el.focus();
  else if (!el.value.trim()) el.value = 'AUTO'; // signal utk generate ulang saat save
}

// ---------- ITEMS TABLE ----------
function addItemRow() {
  const tbody = document.querySelector('#items-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="i-description" placeholder="Item description"></td>
    <td><input class="i-hs_code" placeholder="HS Code"></td>
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
  // PRD §31: kosong = 0, tidak pernah crash
  tr.querySelector('.i-amount').value = (qty * price).toFixed(2);
  recalc();
}

function recalc() {
  let subtotal = 0;
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    subtotal += parseFloat(tr.querySelector('.i-amount').value) || 0;
  });
  const freight   = parseFloat(document.getElementById('f-freight').value) || 0;
  const insurance = parseFloat(document.getElementById('f-insurance').value) || 0;
  const other     = parseFloat(document.getElementById('f-other_charges').value) || 0;
  const discount  = parseFloat(document.getElementById('f-discount').value) || 0;
  const grand = subtotal + freight + insurance + other - discount;

  const cur = document.getElementById('f-currency').value;
  document.getElementById('t-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('t-grand').textContent = grand.toFixed(2);
  // Update semua label currency yang ada di form
  ['t-currency', 't-currency2', 't-currency3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = cur;
  });
}

// ---------- COLLECT DATA ----------
function collectInvoice() {
  const v = id => document.getElementById(id).value.trim();

  const items = [];
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    const desc = tr.querySelector('.i-description').value.trim();
    if (!desc) return; // skip baris kosong
    items.push({
      description: desc,
      hs_code: tr.querySelector('.i-hs_code').value.trim(),
      quantity: parseFloat(tr.querySelector('.i-quantity').value) || 0,
      unit: tr.querySelector('.i-unit').value.trim(),
      unit_price: parseFloat(tr.querySelector('.i-unit_price').value) || 0,
      amount: parseFloat(tr.querySelector('.i-amount').value) || 0,
    });
  });

  const charges = {
    freight:       parseFloat(v('f-freight')) || 0,
    insurance:     parseFloat(v('f-insurance')) || 0,
    other_charges: parseFloat(v('f-other_charges')) || 0,
    discount:      parseFloat(v('f-discount')) || 0,
  };
  const subtotal = items.reduce((s, i) => s + i.amount, 0);

  return {
    invoice: {
      shipment_type: v('f-shipment_type'),
      invoice_number: v('f-invoice_number') === 'AUTO' ? null : v('f-invoice_number'),
      invoice_date: v('f-invoice_date') || null,
      currency: v('f-currency'),
      payment_terms: v('f-payment_terms') || null,
      incoterms: v('f-incoterms') || null,
      po_number: v('f-po_number') || null,
      reference_number: v('f-reference_number') || null,
      port_of_loading: v('f-port_of_loading') || null,
      port_of_discharge: v('f-port_of_discharge') || null,
      final_destination: v('f-final_destination') || null,
      country_of_origin: v('f-country_of_origin') || null,
      awb_number: v('f-awb_number') || null,
      bl_number: v('f-bl_number') || null,
      container_number: v('f-container_number') || null,
      vessel_flight: v('f-vessel_flight') || null,
      subtotal: +subtotal.toFixed(2),
      ...charges,
      grand_total: +(subtotal + charges.freight + charges.insurance
        + charges.other_charges - charges.discount).toFixed(2),
      status: 'draft',
    },
    shipper: {
      company_name: v('f-shipper_name'),
      pic: v('f-shipper_pic'),
      address: v('f-shipper_address'),
      city: v('f-shipper_city'),
      country: v('f-shipper_country'),
      phone: v('f-shipper_phone'),
      email: v('f-shipper_email'),
    },
    receiver: {
      company_name: v('f-receiver_name'),
      pic: v('f-receiver_pic'),
      address: v('f-receiver_address'),
      city: v('f-receiver_city'),
      country: v('f-receiver_country'),
      phone: v('f-receiver_phone'),
      email: v('f-receiver_email'),
    },
    billTo: {
      company_name: v('f-bill_to_name'),
      pic: v('f-bill_to_pic'),
      address: v('f-bill_to_address'),
      city: v('f-bill_to_city'),
      country: v('f-bill_to_country'),
      phone: v('f-bill_to_phone'),
      email: v('f-bill_to_email'),
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
  if (!data.shipper.company_name) missing.push('Shipper company name');
  if (!data.receiver.company_name) missing.push('Receiver company name');
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
async function persistInvoice(data, status) {
  const session = await getSession();
  const inv = {
    ...data.invoice,
    user_id: session.user.id,
    status,
    // snapshot shipper/receiver (termasuk PIC) ke row invoice
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
    invoice_number: data.invoice.invoice_number
      || await nextInvoiceNumber(), // mode AUTO -> generate saat save
  };

  let saved;
  if (EDIT_ID) {
    // ---- MODE EDIT: update row yang sudah ada ----
    const { data: updated, error } = await supabase
      .from('invoices').update(inv).eq('id', EDIT_ID).select().single();
    if (error) throw new Error('Update failed: ' + error.message);
    saved = updated;

    // Items: cara paling aman & simpel — hapus semua item lama, insert ulang
    // dari form (item tidak punya id stabil per baris di UI).
    const { error: delErr } = await supabase
      .from('invoice_items').delete().eq('invoice_id', EDIT_ID);
    if (delErr) throw new Error('Failed to update items: ' + delErr.message);
  } else {
    // ---- MODE BARU: insert row baru ----
    const { data: created, error } = await supabase
      .from('invoices').insert(inv).select().single();
    if (error) throw new Error('Save failed: ' + error.message);
    saved = created;
  }

  if (data.items.length) {
    const { error: iErr } = await supabase
      .from('invoice_items')
      .insert(data.items.map(i => ({ ...i, invoice_id: saved.id })));
    if (iErr) throw new Error('Items save failed: ' + iErr.message);
  }
  return saved;
}

async function saveOnly() {
  const data = collectInvoice();
  softValidation(data); // warning saja, tetap lanjut

  if (IS_GUEST) {
    guestAuthGate(async () => {
      await persistInvoice(data, 'draft');
      alert('✅ Account created & invoice saved as draft.');
      location.href = '/invoice-list.html';
    });
    return;
  }

  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    await persistInvoice(data, 'draft');
    alert(EDIT_ID ? '✅ Invoice updated.' : '✅ Invoice saved as draft.');
    location.href = '/invoice-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update Draft' : 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectInvoice();
  softValidation(data); // warning saja, tetap lanjut (PRD §32)

  if (IS_GUEST) {
    // 1) Preview watermark client-side -- TIDAK disimpan ke DB (PRD §73)
    const previewInvoice = { ...data.invoice, invoice_number: data.invoice.invoice_number || 'PREVIEW' };
    generateInvoicePDF({ ...data, invoice: previewInvoice, branding: null, watermark: true });

    // 2) Modal signup/login ringan. Draft (`data`, masih di memori JS)
    //    baru benar-benar disimpan ke DB SETELAH auth sukses.
    guestAuthGate(async () => {
      const saved = await persistInvoice(data, 'final');
      const branding = await getBranding();
      await generateInvoicePDF({ ...data, invoice: saved, branding }); // PDF asli, tanpa watermark
      alert('✅ Account created & invoice saved. PDF downloaded.');
      location.href = '/invoice-list.html';
    });
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistInvoice(data, 'final');
    const branding = await getBranding(); // js/branding.js
    await generateInvoicePDF({ ...data, invoice: saved, branding }); // js/pdf.js
    alert(EDIT_ID ? '✅ Invoice updated & PDF downloaded.' : '✅ Invoice saved & PDF downloaded.');
    location.href = '/invoice-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
