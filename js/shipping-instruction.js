// ============================================
// SHIPPING INSTRUCTION (SI) — form logic, cargo lines, save
// Mengikuti pola persis js/purchase-order.js / js/invoice.js:
//   - Guest mode: bisa diakses tanpa login (PRD §73/§74, lihat
//     sql/23-guest-mode-dn-si.sql)
//   - PRD §74 tetap berlaku: akun 'pending' -> PDF watermark
//   - Nomor otomatis SI-{YEAR}-{SEQ}, editable
//   - Edit existing SI via ?id=<uuid> di URL
// ============================================

let EDIT_ID = null; // null = create baru; berisi id = mode edit
let IS_GUEST = false; // true = belum login (PRD §73 guest mode)

(async function initShippingInstruction() {
  const { allowed, session, guest } = await requireFeatureOrGuest('shipping_instruction');
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

  // PL dropdown harus terisi options-nya DULU sebelum loadSiForEdit coba
  // set value-nya (select butuh <option> yang matching sudah ada dulu).
  // Guest belum login -> RLS packing_lists cuma balikin 0 baris (bukan
  // error), dropdown-nya tetap kosong, aman.
  await loadPlOptions();

  if (EDIT_ID) {
    await loadSiForEdit(EDIT_ID);
  } else {
    document.getElementById('f-si_date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-si_number').value = await nextSiNumber();
    addItemRow();
  }
})();

// ---------- SOURCE PACKING LIST OPTIONS ----------
// Packing List -> SI (document linking): Shipper -> Shipper, Receiver ->
// Consignee, packages -> cargo lines (bentuknya mirip: description/qty/
// unit/weight/package_type -- cocok langsung).
async function loadPlOptions() {
  const { data: pls } = await supabase
    .from('packing_lists')
    .select('id, packing_list_number, receiver_name')
    .order('created_at', { ascending: false })
    .limit(50);

  const sel = document.getElementById('f-source_pl');
  if (!sel) return;
  (pls || []).forEach(pl => {
    const opt = document.createElement('option');
    opt.value = pl.id;
    opt.textContent = `${pl.packing_list_number}${pl.receiver_name ? ' — ' + pl.receiver_name : ''}`;
    sel.appendChild(opt);
  });
}

async function loadFromPl() {
  const plId = document.getElementById('f-source_pl').value;
  if (!plId) return;

  if (!confirm('Load data from this packing list?\nCurrent form contents will be replaced.')) {
    document.getElementById('f-source_pl').value = '';
    return;
  }

  const { data: pl, error } = await supabase
    .from('packing_lists').select('*').eq('id', plId).single();
  if (error || !pl) return alert('Failed to load packing list: ' + (error?.message || 'not found'));

  const { data: packages } = await supabase
    .from('packing_list_items').select('*').eq('packing_list_id', plId).order('created_at');

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  set('f-shipper_name',    pl.shipper_name);
  set('f-shipper_pic',     pl.shipper_pic);
  set('f-shipper_address', pl.shipper_address);
  set('f-shipper_city',    pl.shipper_city);
  set('f-shipper_country', pl.shipper_country);
  set('f-shipper_phone',   pl.shipper_phone);
  set('f-shipper_email',   pl.shipper_email);
  set('f-consignee_name',    pl.receiver_name);
  set('f-consignee_pic',     pl.receiver_pic);
  set('f-consignee_address', pl.receiver_address);
  set('f-consignee_city',    pl.receiver_city);
  set('f-consignee_country', pl.receiver_country);
  set('f-consignee_phone',   pl.receiver_phone);
  set('f-consignee_email',   pl.receiver_email);
  set('f-reference_number', pl.packing_list_number); // jejak: SI ini dari PL mana

  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (packages?.length) {
    packages.forEach(p => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = p.description || '';
      tr.querySelector('.i-package_count').value = 1; // 1 baris PL = 1 package fisik
      tr.querySelector('.i-package_type').value = p.package_type || '';
      tr.querySelector('.i-quantity').value = p.quantity ?? '';
      tr.querySelector('.i-unit').value = p.unit || '';
      tr.querySelector('.i-gross_weight').value = p.gross_weight ?? '';
      tr.querySelector('.i-measurement').value = p.cbm ?? '';
    });
  } else {
    addItemRow();
  }
  recalc();
}

// ---------- LOAD UNTUK EDIT ----------
async function loadSiForEdit(id) {
  const { data: si, error } = await supabase
    .from('shipping_instructions').select('*').eq('id', id).single();
  if (error || !si) {
    alert('Shipping instruction not found or you do not have access to it.');
    location.href = '/shipping-instruction-list.html';
    return;
  }

  const { data: items } = await supabase
    .from('shipping_instruction_items').select('*').eq('shipping_instruction_id', id).order('created_at');

  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;">📦 ISG</a> / Edit Shipping Instruction ${si.si_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-source_pl', si.source_packing_list_id || '');
  set('f-si_number', si.si_number);
  set('f-si_date', si.si_date);
  set('f-reference_number', si.reference_number);
  set('f-booking_number', si.booking_number);
  set('f-carrier_name', si.carrier_name);
  set('f-vessel_voyage', si.vessel_voyage);
  set('f-mode_of_transport', si.mode_of_transport);
  set('f-shipment_mode', si.shipment_mode);
  set('f-container_type', si.container_type);
  set('f-container_count', si.container_count);
  set('f-port_of_loading', si.port_of_loading);
  set('f-port_of_discharge', si.port_of_discharge);
  set('f-place_of_delivery', si.place_of_delivery);
  set('f-final_destination', si.final_destination);
  set('f-freight_terms', si.freight_terms);
  set('f-incoterms', si.incoterms);
  set('f-bl_type', si.bl_type);
  set('f-bl_originals_count', si.bl_originals_count);
  set('f-notes', si.notes);

  set('f-shipper_name', si.shipper_name);
  set('f-shipper_pic', si.shipper_pic);
  set('f-shipper_address', si.shipper_address);
  set('f-shipper_city', si.shipper_city);
  set('f-shipper_country', si.shipper_country);
  set('f-shipper_phone', si.shipper_phone);
  set('f-shipper_email', si.shipper_email);

  set('f-consignee_name', si.consignee_name);
  set('f-consignee_pic', si.consignee_pic);
  set('f-consignee_address', si.consignee_address);
  set('f-consignee_city', si.consignee_city);
  set('f-consignee_country', si.consignee_country);
  set('f-consignee_phone', si.consignee_phone);
  set('f-consignee_email', si.consignee_email);

  set('f-notify_party_name', si.notify_party_name);
  set('f-notify_party_pic', si.notify_party_pic);
  set('f-notify_party_address', si.notify_party_address);
  set('f-notify_party_city', si.notify_party_city);
  set('f-notify_party_country', si.notify_party_country);
  set('f-notify_party_phone', si.notify_party_phone);
  set('f-notify_party_email', si.notify_party_email);

  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (items?.length) {
    items.forEach(it => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = it.description || '';
      tr.querySelector('.i-hs_code').value = it.hs_code || '';
      tr.querySelector('.i-package_count').value = it.package_count ?? '';
      tr.querySelector('.i-package_type').value = it.package_type || '';
      tr.querySelector('.i-quantity').value = it.quantity ?? '';
      tr.querySelector('.i-unit').value = it.unit || '';
      tr.querySelector('.i-gross_weight').value = it.gross_weight ?? '';
      tr.querySelector('.i-measurement').value = it.measurement ?? '';
    });
  } else {
    addItemRow();
  }

  recalc();
}

// ---------- NOMOR SI ----------
// PENTING: si_number unique PER USER (lihat sql/20-shipping-instruction.sql),
// jadi hitungannya wajib difilter eksplisit by user_id.
async function nextSiNumber() {
  const year = new Date().getFullYear();
  const userId = window.APP_SESSION?.user?.id;

  if (!userId) return `SI-${year}-00001`; // guest -- nomor sementara utk preview

  const { count, error } = await supabase
    .from('shipping_instructions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('si_number', `SI-${year}-%`);
  if (error) console.warn(error);
  return `SI-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}

function toggleNumberEdit() {
  const el = document.getElementById('f-si_number');
  el.readOnly = !el.readOnly;
  if (!el.readOnly) el.focus();
  else if (!el.value.trim()) el.value = 'AUTO';
}

// ---------- CARGO ITEMS TABLE ----------
function addItemRow() {
  const tbody = document.querySelector('#items-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="i-description" placeholder="Cargo description"></td>
    <td><input class="i-hs_code" placeholder="HS Code"></td>
    <td><input class="i-package_count" type="number" step="1" oninput="recalc()"></td>
    <td><input class="i-package_type" placeholder="e.g. Carton, Pallet"></td>
    <td><input class="i-quantity" type="number" step="0.01"></td>
    <td><input class="i-unit" placeholder="Unit"></td>
    <td><input class="i-gross_weight" type="number" step="0.01" oninput="recalc()"></td>
    <td><input class="i-measurement" type="number" step="0.001" oninput="recalc()"></td>
    <td><button class="btn btn-danger btn-sm" type="button"
        onclick="this.closest('tr').remove(); recalc();">×</button></td>`;
  tbody.appendChild(tr);
}

function recalc() {
  let packages = 0, grossWeight = 0, measurement = 0;
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    packages += parseFloat(tr.querySelector('.i-package_count').value) || 0;
    grossWeight += parseFloat(tr.querySelector('.i-gross_weight').value) || 0;
    measurement += parseFloat(tr.querySelector('.i-measurement').value) || 0;
  });
  document.getElementById('t-packages').textContent = packages;
  document.getElementById('t-grossweight').textContent = grossWeight.toFixed(2);
  document.getElementById('t-measurement').textContent = measurement.toFixed(3);
}

// ---------- COLLECT DATA ----------
function collectShippingInstruction() {
  const v = id => document.getElementById(id).value.trim();

  const items = [];
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    const desc = tr.querySelector('.i-description').value.trim();
    if (!desc) return;
    items.push({
      description: desc,
      hs_code: tr.querySelector('.i-hs_code').value.trim(),
      package_count: parseFloat(tr.querySelector('.i-package_count').value) || 0,
      package_type: tr.querySelector('.i-package_type').value.trim(),
      quantity: parseFloat(tr.querySelector('.i-quantity').value) || 0,
      unit: tr.querySelector('.i-unit').value.trim(),
      gross_weight: parseFloat(tr.querySelector('.i-gross_weight').value) || 0,
      measurement: parseFloat(tr.querySelector('.i-measurement').value) || 0,
    });
  });

  return {
    shipping_instruction: {
      si_number: v('f-si_number') === 'AUTO' ? null : v('f-si_number'),
      si_date: v('f-si_date') || null,
      reference_number: v('f-reference_number') || null,
      booking_number: v('f-booking_number') || null,
      carrier_name: v('f-carrier_name') || null,
      vessel_voyage: v('f-vessel_voyage') || null,
      mode_of_transport: v('f-mode_of_transport') || null,
      shipment_mode: v('f-shipment_mode') || null,
      container_type: v('f-container_type') || null,
      container_count: v('f-container_count') ? parseInt(v('f-container_count'), 10) : null,
      port_of_loading: v('f-port_of_loading') || null,
      port_of_discharge: v('f-port_of_discharge') || null,
      place_of_delivery: v('f-place_of_delivery') || null,
      final_destination: v('f-final_destination') || null,
      freight_terms: v('f-freight_terms') || null,
      incoterms: v('f-incoterms') || null,
      bl_type: v('f-bl_type') || null,
      bl_originals_count: v('f-bl_originals_count') ? parseInt(v('f-bl_originals_count'), 10) : null,
      notes: v('f-notes') || null,
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
    consignee: {
      company_name: v('f-consignee_name'),
      pic: v('f-consignee_pic'),
      address: v('f-consignee_address'),
      city: v('f-consignee_city'),
      country: v('f-consignee_country'),
      phone: v('f-consignee_phone'),
      email: v('f-consignee_email'),
    },
    notifyParty: {
      company_name: v('f-notify_party_name'),
      pic: v('f-notify_party_pic'),
      address: v('f-notify_party_address'),
      city: v('f-notify_party_city'),
      country: v('f-notify_party_country'),
      phone: v('f-notify_party_phone'),
      email: v('f-notify_party_email'),
    },
    items,
  };
}

// ---------- SOFT VALIDATION (PRD §32) ----------
function softValidation(data) {
  const missing = [];
  if (!data.shipper.company_name) missing.push('Shipper company name');
  if (!data.consignee.company_name) missing.push('Consignee company name');
  if (!data.shipping_instruction.port_of_loading) missing.push('Port of Loading');
  if (!data.shipping_instruction.port_of_discharge) missing.push('Port of Discharge');
  if (!data.items.length) missing.push('Cargo details');
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
async function persistShippingInstruction(data, status) {
  const session = await getSession();
  const si = {
    ...data.shipping_instruction,
    user_id: session.user.id,
    status,
    source_packing_list_id: document.getElementById('f-source_pl')?.value || null,
    shipper_name: data.shipper.company_name,
    shipper_pic: data.shipper.pic,
    shipper_address: data.shipper.address,
    shipper_city: data.shipper.city,
    shipper_country: data.shipper.country,
    shipper_phone: data.shipper.phone,
    shipper_email: data.shipper.email,
    consignee_name: data.consignee.company_name,
    consignee_pic: data.consignee.pic,
    consignee_address: data.consignee.address,
    consignee_city: data.consignee.city,
    consignee_country: data.consignee.country,
    consignee_phone: data.consignee.phone,
    consignee_email: data.consignee.email,
    notify_party_name: data.notifyParty.company_name || null,
    notify_party_pic: data.notifyParty.pic || null,
    notify_party_address: data.notifyParty.address || null,
    notify_party_city: data.notifyParty.city || null,
    notify_party_country: data.notifyParty.country || null,
    notify_party_phone: data.notifyParty.phone || null,
    notify_party_email: data.notifyParty.email || null,
    si_number: data.shipping_instruction.si_number || await nextSiNumber(),
  };

  let saved;
  if (EDIT_ID) {
    const { data: updated, error } = await supabase
      .from('shipping_instructions').update(si).eq('id', EDIT_ID).select().single();
    if (error) throw new Error('Update failed: ' + error.message);
    saved = updated;

    const { error: delErr } = await supabase
      .from('shipping_instruction_items').delete().eq('shipping_instruction_id', EDIT_ID);
    if (delErr) throw new Error('Failed to update cargo lines: ' + delErr.message);
  } else {
    const { data: created, error } = await supabase
      .from('shipping_instructions').insert(si).select().single();
    if (error) throw new Error('Save failed: ' + error.message);
    saved = created;
  }

  if (data.items.length) {
    const { error: iErr } = await supabase
      .from('shipping_instruction_items')
      .insert(data.items.map(i => ({ ...i, shipping_instruction_id: saved.id })));
    if (iErr) throw new Error('Cargo lines save failed: ' + iErr.message);
  }
  return saved;
}

async function saveOnly() {
  const data = collectShippingInstruction();
  softValidation(data);

  if (IS_GUEST) {
    guestAuthGate(async () => {
      await persistShippingInstruction(data, 'draft');
      showActivationModal({ justSaved: true, onClose: () => location.href = '/shipping-instruction-list.html' });
    });
    return;
  }

  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    await persistShippingInstruction(data, 'draft');
    alert(EDIT_ID ? '✅ Shipping instruction updated.' : '✅ Shipping instruction saved as draft.');
    location.href = '/shipping-instruction-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update Draft' : 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectShippingInstruction();
  softValidation(data);

  if (IS_GUEST) {
    // 1) Preview watermark client-side -- TIDAK disimpan ke DB (PRD §73)
    const previewSi = { ...data.shipping_instruction, si_number: data.shipping_instruction.si_number || 'PREVIEW' };
    generateShippingInstructionPDF({ ...data, shipping_instruction: previewSi, branding: null, watermark: true });

    // 2) Modal signup/login ringan. Draft baru benar-benar disimpan ke
    //    DB SETELAH auth sukses.
    guestAuthGate(async () => {
      const saved = await persistShippingInstruction(data, 'final');
      const branding = await getBranding();
      const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
      await generateShippingInstructionPDF({ ...data, shipping_instruction: saved, branding, watermark });
      if (watermark) {
        showActivationModal({ justSaved: true, onClose: () => location.href = '/shipping-instruction-list.html' });
      } else {
        alert('✅ Account created & shipping instruction saved. PDF downloaded.');
        location.href = '/shipping-instruction-list.html';
      }
    });
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistShippingInstruction(data, 'final');
    const branding = await getBranding(); // js/branding.js
    const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
    await generateShippingInstructionPDF({ ...data, shipping_instruction: saved, branding, watermark }); // js/pdf.js
    alert((EDIT_ID ? '✅ Shipping instruction updated & PDF downloaded.' : '✅ Shipping instruction saved & PDF downloaded.')
      + (watermark ? '\n\n⏳ Your account is pending activation — the PDF still has a watermark.' : ''));
    location.href = '/shipping-instruction-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
