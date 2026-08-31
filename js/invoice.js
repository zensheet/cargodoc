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
let DOC_TYPE = 'commercial'; // 'commercial' | 'proforma' — lihat PRD Proforma Invoice

// Prefix nomor & judul dokumen per doc_type — satu sumber kebenaran,
// dipakai baik oleh nextInvoiceNumber() maupun UI (judul, header).
const DOC_TYPE_META = {
  commercial: { prefix: 'INV', title: 'Commercial Invoice', pdfTitle: 'COMMERCIAL INVOICE' },
  proforma:   { prefix: 'PI',  title: 'Proforma Invoice',   pdfTitle: 'PROFORMA INVOICE' },
};

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
    // PRD §74: customer sudah login tapi akunnya masih 'pending'
    if (session.profile.status === 'pending') {
      document.getElementById('pending-warning').hidden = false;
    }
  }

  EDIT_ID = new URLSearchParams(location.search).get('id');

  // SO dropdown harus terisi options-nya DULU sebelum loadInvoiceForEdit
  // coba set value-nya (select butuh <option> yang matching sudah ada dulu).
  await loadSoOptions();

  if (EDIT_ID) {
    await loadInvoiceForEdit(EDIT_ID);
  } else {
    // Tipe dokumen ditentukan lewat ?type=proforma di URL (link dari
    // dashboard/history). Default tetap Commercial Invoice.
    const typeParam = new URLSearchParams(location.search).get('type');
    DOC_TYPE = typeParam === 'proforma' ? 'proforma' : 'commercial';
    applyDocTypeUI();

    // Default date = hari ini
    document.getElementById('f-invoice_date').value =
      new Date().toISOString().slice(0, 10);

    // Nomor invoice otomatis
    document.getElementById('f-invoice_number').value = await nextInvoiceNumber(DOC_TYPE);

    // Baris item pertama
    addItemRow();
  }
})();

// ---------- DOC TYPE UI (Commercial vs Proforma) ----------
// Ganti judul halaman/header & tampilkan field yang cuma relevan buat
// Proforma (Valid Until), tanpa duplikasi halaman/HTML.
function applyDocTypeUI() {
  const meta = DOC_TYPE_META[DOC_TYPE];
  document.title = `${meta.title} — Invoice Shipping Generator`;
  const brand = document.querySelector('.app-header .brand');
  if (brand && !EDIT_ID) {
    brand.innerHTML = `<a href="/app.html" style="text-decoration:none;color:inherit;"><img src="assets/logo-cargodoc.webp" alt="CargoDoc" style="height:18px;vertical-align:middle;"></a> / ${meta.title}`;
  }
  const numberHint = document.getElementById('invoice-number-hint');
  if (numberHint) numberHint.textContent = `Auto-generated (${meta.prefix}-{YEAR}-{SEQ})`;

  const validUntilRow = document.getElementById('valid-until-row');
  if (validUntilRow) validUntilRow.hidden = DOC_TYPE !== 'proforma';

  const convertBtn = document.getElementById('btn-convert-commercial');
  if (convertBtn) convertBtn.hidden = !(EDIT_ID && DOC_TYPE === 'proforma');
}

// ---------- SOURCE SALES ORDER OPTIONS ----------
// SO -> Invoice (document linking): SO sudah dikonfirmasi customer,
// tinggal diterbitkan invoice-nya. Customer/Ship To DIBAWA (relasi
// masuk akal: SO Customer = pihak yang akan ditagih di invoice).
async function loadSoOptions() {
  const { data: sos } = await supabase
    .from('sales_orders')
    .select('id, so_number, customer_name')
    .order('created_at', { ascending: false })
    .limit(50);

  const sel = document.getElementById('f-source_so');
  if (!sel) return;
  (sos || []).forEach(so => {
    const opt = document.createElement('option');
    opt.value = so.id;
    opt.textContent = `${so.so_number}${so.customer_name ? ' — ' + so.customer_name : ''}`;
    sel.appendChild(opt);
  });
}

async function loadFromSo() {
  const soId = document.getElementById('f-source_so').value;
  if (!soId) return;

  if (!(await customConfirm('Load data from this sales order?\nCurrent form contents will be replaced.'))) {
    document.getElementById('f-source_so').value = '';
    return;
  }

  const { data: so, error } = await supabase
    .from('sales_orders').select('*').eq('id', soId).single();
  if (error || !so) return alert('Failed to load sales order: ' + (error?.message || 'not found'));

  const { data: items } = await supabase
    .from('sales_order_items').select('*').eq('sales_order_id', soId).order('created_at');

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  // Customer SO -> Receiver + Bill To invoice (pihak yang sama, ditagih)
  set('f-receiver_name',    so.customer_name);
  set('f-receiver_pic',     so.customer_pic);
  set('f-receiver_address', so.customer_address);
  set('f-receiver_city',    so.customer_city);
  set('f-receiver_country', so.customer_country);
  set('f-receiver_phone',   so.customer_phone);
  set('f-receiver_email',   so.customer_email);
  set('f-bill_to_name',     so.customer_name);
  set('f-bill_to_pic',      so.customer_pic);
  set('f-bill_to_address',  so.customer_address);
  set('f-bill_to_city',     so.customer_city);
  set('f-bill_to_country',  so.customer_country);
  set('f-bill_to_phone',    so.customer_phone);
  set('f-bill_to_email',    so.customer_email);
  set('f-ship_to_name',     so.ship_to_name);
  set('f-ship_to_pic',      so.ship_to_pic);
  set('f-ship_to_address',  so.ship_to_address);
  set('f-ship_to_city',     so.ship_to_city);
  set('f-ship_to_country',  so.ship_to_country);
  set('f-ship_to_phone',    so.ship_to_phone);
  set('f-ship_to_email',    so.ship_to_email);

  set('f-currency', so.currency || 'USD');
  set('f-payment_terms', so.payment_terms);
  set('f-reference_number', so.so_number); // jejak: invoice ini dari SO mana
  set('f-po_number', so.reference_number); // rantai: kalau SO ini asalnya dari PO, ikut turun

  // Items SO -> items invoice (bentuk sama persis: description/sku~hs_code/qty/unit/unit_price/amount)
  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (items?.length) {
    items.forEach(it => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = it.description || '';
      tr.querySelector('.i-quantity').value = it.quantity ?? '';
      tr.querySelector('.i-unit').value = it.unit || '';
      tr.querySelector('.i-unit_price').value = it.unit_price ?? '';
      tr.querySelector('.i-amount').value = it.amount ?? '';
    });
  } else {
    addItemRow();
  }
  recalc();
}

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

  // Tipe dokumen mengikuti data tersimpan (tidak berubah setelah dibuat)
  DOC_TYPE = inv.doc_type === 'proforma' ? 'proforma' : 'commercial';
  const meta = DOC_TYPE_META[DOC_TYPE];

  // Header halaman & tombol -> jelasin ini mode edit
  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;"><img src="assets/logo-cargodoc.webp" alt="CargoDoc" style="height:18px;vertical-align:middle;"></a> / Edit ${meta.title} ${inv.invoice_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';
  applyDocTypeUI();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-source_so', inv.source_so_id || '');
  set('f-shipment_type', inv.shipment_type || 'export');
  set('f-invoice_number', inv.invoice_number);
  set('f-invoice_date', inv.invoice_date);
  set('f-valid_until', inv.valid_until);
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
// docType: 'commercial' (prefix INV-) atau 'proforma' (prefix PI-) —
// dua seri nomor terpisah supaya tidak campur di pembukuan.
async function nextInvoiceNumber(docType = DOC_TYPE) {
  const meta = DOC_TYPE_META[docType] || DOC_TYPE_META.commercial;
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('doc_type', docType)
    .like('invoice_number', `${meta.prefix}-${year}-%`);
  if (error) console.warn(error);
  return `${meta.prefix}-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
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
      doc_type: DOC_TYPE,
      shipment_type: v('f-shipment_type'),
      invoice_number: v('f-invoice_number') === 'AUTO' ? null : v('f-invoice_number'),
      invoice_date: v('f-invoice_date') || null,
      valid_until: DOC_TYPE === 'proforma' ? (v('f-valid_until') || null) : null,
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
    source_so_id: document.getElementById('f-source_so')?.value || null,
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
      showActivationModal({ justSaved: true, onClose: () => location.href = '/invoice-list.html' });
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
    alert(friendlyErrorMessage(e)); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update Draft' : 'Save as Draft';
  }
}

// ---------- CONVERT PROFORMA -> COMMERCIAL INVOICE ----------
// Barang sudah pasti dikirim: buat Commercial Invoice baru dari data
// proforma ini (nomor seri INV- baru, valid_until dihapus). Proforma
// aslinya TIDAK dihapus/diubah — tetap ada sebagai riwayat quotation.
async function convertToCommercial() {
  if (!EDIT_ID || DOC_TYPE !== 'proforma') return;
  if (!(await customConfirm('Convert this Proforma Invoice into a new Commercial Invoice?\n'
    + 'A new Commercial Invoice will be created with a new number. '
    + 'This Proforma Invoice will not be changed.'))) return;

  const data = collectInvoice();
  data.invoice.doc_type = 'commercial';
  data.invoice.invoice_number = null; // paksa generate nomor INV- baru
  data.invoice.valid_until = null;

  const prevEditId = EDIT_ID;
  EDIT_ID = null; // supaya persistInvoice() INSERT baris baru, bukan update proforma-nya
  try {
    DOC_TYPE = 'commercial';
    const saved = await persistInvoice(data, 'draft');
    alert(`✅ Converted to Commercial Invoice ${saved.invoice_number}.`);
    location.href = `/invoice.html?id=${saved.id}`;
  } catch (e) {
    EDIT_ID = prevEditId;
    DOC_TYPE = 'proforma';
    alert(friendlyErrorMessage(e));
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
      // PRD §74: baru signup -> status masih 'pending', jadi PDF-nya
      // tetap watermark sampai admin klik "Activate".
      const watermark = accountNeedsWatermark(window.APP_SESSION);
      await generateInvoicePDF({ ...data, invoice: saved, branding, watermark });
      if (watermark) {
        // Redirect BARU jalan setelah modal ditutup (bukan langsung),
        // supaya modal-nya sempat kebaca -- js/guard.js
        showActivationModal({ justSaved: true, onClose: () => location.href = '/invoice-list.html' });
      } else {
        alert('✅ Account created & invoice saved. PDF downloaded.');
        location.href = '/invoice-list.html';
      }
    });
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistInvoice(data, 'final');
    const branding = await getBranding(); // js/branding.js
    const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
    await generateInvoicePDF({ ...data, invoice: saved, branding, watermark }); // js/pdf.js
    alert((EDIT_ID ? '✅ Invoice updated & PDF downloaded.' : '✅ Invoice saved & PDF downloaded.')
      + (watermark ? '\n\n⏳ Your account is pending activation — the PDF still has a watermark.' : ''));
    location.href = '/invoice-list.html';
  } catch (e) {
    alert(friendlyErrorMessage(e)); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
