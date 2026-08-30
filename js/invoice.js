// ============================================
// INVOICE — form logic, items, kalkulasi, save
// PRD §18-32
//   - Nomor invoice otomatis (INV-{YEAR}-{SEQ}), editable
//   - Items dinamis, amount & totals terhitung live
//   - Soft validation (PRD §32): warning, tidak blocking
//   - Save draft / save final + download PDF
// ============================================

(async function initInvoice() {
  // PRD §9: feature gate — UI layer; RLS tetap security utama
  const { allowed, session } = await requireFeature('invoice');
  if (!session) return;
  if (!allowed) { location.href = '/app.html'; return; }

  document.getElementById('user-name').textContent = session.profile.email;

  // Default date = hari ini
  document.getElementById('f-invoice_date').value =
    new Date().toISOString().slice(0, 10);

  // Nomor invoice otomatis
  const numberInput = document.getElementById('f-invoice_number');
  numberInput.value = await nextInvoiceNumber();

  // Baris item pertama
  addItemRow();
})();

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
    invoice_number: data.invoice.invoice_number
      || await nextInvoiceNumber(), // mode AUTO -> generate saat save
  };

  const { data: saved, error } = await supabase
    .from('invoices').insert(inv).select().single();
  if (error) throw new Error('Save failed: ' + error.message);

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
  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await persistInvoice(data, 'draft');
    alert('✅ Invoice saved as draft.');
    location.href = '/invoice-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false; btn.textContent = 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectInvoice();
  softValidation(data); // warning saja, tetap lanjut (PRD §32)
  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const saved = await persistInvoice(data, 'final');
    generateInvoicePDF({ ...data, invoice: saved }); // js/pdf.js
    alert('✅ Invoice saved & PDF downloaded.');
    location.href = '/invoice-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false; btn.textContent = 'Save & Download PDF';
  }
}
