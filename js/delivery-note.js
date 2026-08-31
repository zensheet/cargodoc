// ============================================
// DELIVERY NOTE (DN) — form logic, items, save
// Mengikuti pola persis js/purchase-order.js / js/invoice.js:
//   - Guest mode: bisa diakses tanpa login (PRD §73/§74, lihat
//     sql/23-guest-mode-dn-si.sql)
//   - PRD §74 tetap berlaku: akun 'pending' -> PDF watermark
//   - Nomor otomatis DN-{YEAR}-{SEQ}, editable
//   - Edit existing DN via ?id=<uuid> di URL
//   - TIDAK ada harga/total -- DN cuma bukti serah-terima barang
// ============================================

let EDIT_ID = null; // null = create baru; berisi id = mode edit
let IS_GUEST = false; // true = belum login (PRD §73 guest mode)

(async function initDeliveryNote() {
  const { allowed, session, guest } = await requireFeatureOrGuest('delivery_note');
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

  // SI dropdown harus terisi options-nya DULU sebelum loadDnForEdit coba
  // set value-nya (select butuh <option> yang matching sudah ada dulu).
  // Guest belum tentu punya akses baca shipping_instructions (RLS -- guest
  // belum login), jadi cukup dilewati kalau gagal, dropdown tetap kosong.
  await loadSiOptions();

  if (EDIT_ID) {
    await loadDnForEdit(EDIT_ID);
  } else {
    document.getElementById('f-dn_date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('f-dn_number').value = await nextDnNumber();
    addItemRow();
  }
})();

// ---------- SOURCE SHIPPING INSTRUCTION OPTIONS ----------
// SI -> DN (document linking): Shipper -> From, Consignee -> Deliver To,
// cargo lines -> items (bentuk hampir sama: description/package_count/
// package_type/qty/unit -- SKU & weight/measurement tidak ada di SI, jadi
// dikosongkan, user isi manual kalau perlu).
async function loadSiOptions() {
  const { data: sis } = await supabase
    .from('shipping_instructions')
    .select('id, si_number, consignee_name')
    .order('created_at', { ascending: false })
    .limit(50);

  const sel = document.getElementById('f-source_si');
  if (!sel) return;
  (sis || []).forEach(si => {
    const opt = document.createElement('option');
    opt.value = si.id;
    opt.textContent = `${si.si_number}${si.consignee_name ? ' — ' + si.consignee_name : ''}`;
    sel.appendChild(opt);
  });
}

async function loadFromSi() {
  const siId = document.getElementById('f-source_si').value;
  if (!siId) return;

  if (!confirm('Load data from this shipping instruction?\nCurrent form contents will be replaced.')) {
    document.getElementById('f-source_si').value = '';
    return;
  }

  const { data: si, error } = await supabase
    .from('shipping_instructions').select('*').eq('id', siId).single();
  if (error || !si) return alert('Failed to load shipping instruction: ' + (error?.message || 'not found'));

  const { data: items } = await supabase
    .from('shipping_instruction_items').select('*').eq('shipping_instruction_id', siId).order('created_at');

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

  set('f-from_name',    si.shipper_name);
  set('f-from_pic',     si.shipper_pic);
  set('f-from_address', si.shipper_address);
  set('f-from_city',    si.shipper_city);
  set('f-from_country', si.shipper_country);
  set('f-from_phone',   si.shipper_phone);
  set('f-from_email',   si.shipper_email);
  set('f-deliver_to_name',    si.consignee_name);
  set('f-deliver_to_pic',     si.consignee_pic);
  set('f-deliver_to_address', si.consignee_address);
  set('f-deliver_to_city',    si.consignee_city);
  set('f-deliver_to_country', si.consignee_country);
  set('f-deliver_to_phone',   si.consignee_phone);
  set('f-deliver_to_email',   si.consignee_email);
  set('f-reference_number', si.si_number); // jejak: DN ini dari SI mana

  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (items?.length) {
    items.forEach(it => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = it.description || '';
      tr.querySelector('.i-package_count').value = it.package_count ?? '';
      tr.querySelector('.i-package_type').value = it.package_type || '';
      tr.querySelector('.i-quantity').value = it.quantity ?? '';
      tr.querySelector('.i-unit').value = it.unit || '';
    });
  } else {
    addItemRow();
  }
  recalc();
}

// ---------- LOAD UNTUK EDIT ----------
async function loadDnForEdit(id) {
  const { data: dn, error } = await supabase
    .from('delivery_notes').select('*').eq('id', id).single();
  if (error || !dn) {
    alert('Delivery note not found or you do not have access to it.');
    location.href = '/delivery-note-list.html';
    return;
  }

  const { data: items } = await supabase
    .from('delivery_note_items').select('*').eq('delivery_note_id', id).order('created_at');

  const heading = document.querySelector('.app-header .brand');
  if (heading) heading.innerHTML =
    `<a href="/app.html" style="text-decoration:none;color:inherit;">📦 ISG</a> / Edit Delivery Note ${dn.dn_number}`;
  document.getElementById('btn-save').textContent = 'Update & Download PDF';
  document.getElementById('btn-save-only').textContent = 'Update Draft';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  set('f-source_si', dn.source_si_id || '');
  set('f-dn_number', dn.dn_number);
  set('f-dn_date', dn.dn_date);
  set('f-reference_number', dn.reference_number);
  set('f-driver_name', dn.driver_name);
  set('f-vehicle_number', dn.vehicle_number);
  set('f-vehicle_type', dn.vehicle_type);
  set('f-received_by_name', dn.received_by_name);
  set('f-received_date', dn.received_date);
  set('f-notes', dn.notes);

  set('f-from_name', dn.from_name);
  set('f-from_pic', dn.from_pic);
  set('f-from_address', dn.from_address);
  set('f-from_city', dn.from_city);
  set('f-from_country', dn.from_country);
  set('f-from_phone', dn.from_phone);
  set('f-from_email', dn.from_email);

  set('f-deliver_to_name', dn.deliver_to_name);
  set('f-deliver_to_pic', dn.deliver_to_pic);
  set('f-deliver_to_address', dn.deliver_to_address);
  set('f-deliver_to_city', dn.deliver_to_city);
  set('f-deliver_to_country', dn.deliver_to_country);
  set('f-deliver_to_phone', dn.deliver_to_phone);
  set('f-deliver_to_email', dn.deliver_to_email);

  const tbody = document.querySelector('#items-table tbody');
  tbody.innerHTML = '';
  if (items?.length) {
    items.forEach(it => {
      addItemRow();
      const tr = tbody.lastElementChild;
      tr.querySelector('.i-description').value = it.description || '';
      tr.querySelector('.i-sku').value = it.sku || '';
      tr.querySelector('.i-package_count').value = it.package_count ?? '';
      tr.querySelector('.i-package_type').value = it.package_type || '';
      tr.querySelector('.i-quantity').value = it.quantity ?? '';
      tr.querySelector('.i-unit').value = it.unit || '';
    });
  } else {
    addItemRow();
  }

  recalc();
}

// ---------- NOMOR DN ----------
// PENTING: dn_number unique PER USER (lihat sql/21-delivery-note.sql),
// jadi hitungannya wajib difilter eksplisit by user_id.
async function nextDnNumber() {
  const year = new Date().getFullYear();
  const userId = window.APP_SESSION?.user?.id;

  if (!userId) return `DN-${year}-00001`; // guest -- nomor sementara utk preview

  const { count, error } = await supabase
    .from('delivery_notes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('dn_number', `DN-${year}-%`);
  if (error) console.warn(error);
  return `DN-${year}-${String((count || 0) + 1).padStart(5, '0')}`;
}

function toggleNumberEdit() {
  const el = document.getElementById('f-dn_number');
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
    <td><input class="i-package_count" type="number" step="1" oninput="recalc()"></td>
    <td><input class="i-package_type" placeholder="e.g. Carton, Pallet"></td>
    <td><input class="i-quantity" type="number" step="0.01"></td>
    <td><input class="i-unit" value="PCS"></td>
    <td><button class="btn btn-danger btn-sm" type="button"
        onclick="this.closest('tr').remove(); recalc();">×</button></td>`;
  tbody.appendChild(tr);
}

function recalc() {
  let packages = 0;
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    packages += parseFloat(tr.querySelector('.i-package_count').value) || 0;
  });
  document.getElementById('t-packages').textContent = packages;
}

// ---------- COLLECT DATA ----------
function collectDeliveryNote() {
  const v = id => document.getElementById(id).value.trim();

  const items = [];
  document.querySelectorAll('#items-table tbody tr').forEach(tr => {
    const desc = tr.querySelector('.i-description').value.trim();
    if (!desc) return;
    items.push({
      description: desc,
      sku: tr.querySelector('.i-sku').value.trim(),
      package_count: parseFloat(tr.querySelector('.i-package_count').value) || 0,
      package_type: tr.querySelector('.i-package_type').value.trim(),
      quantity: parseFloat(tr.querySelector('.i-quantity').value) || 0,
      unit: tr.querySelector('.i-unit').value.trim(),
    });
  });

  return {
    delivery_note: {
      dn_number: v('f-dn_number') === 'AUTO' ? null : v('f-dn_number'),
      dn_date: v('f-dn_date') || null,
      reference_number: v('f-reference_number') || null,
      driver_name: v('f-driver_name') || null,
      vehicle_number: v('f-vehicle_number') || null,
      vehicle_type: v('f-vehicle_type') || null,
      received_by_name: v('f-received_by_name') || null,
      received_date: v('f-received_date') || null,
      notes: v('f-notes') || null,
      status: 'draft',
    },
    from: {
      company_name: v('f-from_name'),
      pic: v('f-from_pic'),
      address: v('f-from_address'),
      city: v('f-from_city'),
      country: v('f-from_country'),
      phone: v('f-from_phone'),
      email: v('f-from_email'),
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
  if (!data.from.company_name) missing.push('From company name');
  if (!data.deliverTo.company_name) missing.push('Deliver To company name');
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
async function persistDeliveryNote(data, status) {
  const session = await getSession();
  const dn = {
    ...data.delivery_note,
    user_id: session.user.id,
    status,
    from_name: data.from.company_name,
    from_pic: data.from.pic,
    from_address: data.from.address,
    from_city: data.from.city,
    from_country: data.from.country,
    from_phone: data.from.phone,
    from_email: data.from.email,
    deliver_to_name: data.deliverTo.company_name,
    deliver_to_pic: data.deliverTo.pic,
    deliver_to_address: data.deliverTo.address,
    deliver_to_city: data.deliverTo.city,
    deliver_to_country: data.deliverTo.country,
    deliver_to_phone: data.deliverTo.phone,
    deliver_to_email: data.deliverTo.email,
    dn_number: data.delivery_note.dn_number || await nextDnNumber(),
  };

  let saved;
  if (EDIT_ID) {
    const { data: updated, error } = await supabase
      .from('delivery_notes').update(dn).eq('id', EDIT_ID).select().single();
    if (error) throw new Error('Update failed: ' + error.message);
    saved = updated;

    const { error: delErr } = await supabase
      .from('delivery_note_items').delete().eq('delivery_note_id', EDIT_ID);
    if (delErr) throw new Error('Failed to update items: ' + delErr.message);
  } else {
    const { data: created, error } = await supabase
      .from('delivery_notes').insert(dn).select().single();
    if (error) throw new Error('Save failed: ' + error.message);
    saved = created;
  }

  if (data.items.length) {
    const { error: iErr } = await supabase
      .from('delivery_note_items')
      .insert(data.items.map(i => ({ ...i, delivery_note_id: saved.id })));
    if (iErr) throw new Error('Items save failed: ' + iErr.message);
  }
  return saved;
}

async function saveOnly() {
  const data = collectDeliveryNote();
  softValidation(data);

  if (IS_GUEST) {
    guestAuthGate(async () => {
      await persistDeliveryNote(data, 'draft');
      showActivationModal({ justSaved: true, onClose: () => location.href = '/delivery-note-list.html' });
    });
    return;
  }

  const btn = document.getElementById('btn-save-only');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    await persistDeliveryNote(data, 'draft');
    alert(EDIT_ID ? '✅ Delivery note updated.' : '✅ Delivery note saved as draft.');
    location.href = '/delivery-note-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update Draft' : 'Save as Draft';
  }
}

async function saveAndDownload() {
  const data = collectDeliveryNote();
  softValidation(data);

  if (IS_GUEST) {
    // 1) Preview watermark client-side -- TIDAK disimpan ke DB (PRD §73)
    const previewDn = { ...data.delivery_note, dn_number: data.delivery_note.dn_number || 'PREVIEW' };
    generateDeliveryNotePDF({ ...data, delivery_note: previewDn, branding: null, watermark: true });

    // 2) Modal signup/login ringan. Draft baru benar-benar disimpan ke
    //    DB SETELAH auth sukses.
    guestAuthGate(async () => {
      const saved = await persistDeliveryNote(data, 'final');
      const branding = await getBranding();
      const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
      await generateDeliveryNotePDF({ ...data, delivery_note: saved, branding, watermark });
      if (watermark) {
        showActivationModal({ justSaved: true, onClose: () => location.href = '/delivery-note-list.html' });
      } else {
        alert('✅ Account created & delivery note saved. PDF downloaded.');
        location.href = '/delivery-note-list.html';
      }
    });
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = EDIT_ID ? 'Updating...' : 'Saving...';
  try {
    const saved = await persistDeliveryNote(data, 'final');
    const branding = await getBranding(); // js/branding.js
    const watermark = accountNeedsWatermark(window.APP_SESSION); // PRD §74
    await generateDeliveryNotePDF({ ...data, delivery_note: saved, branding, watermark }); // js/pdf.js
    alert((EDIT_ID ? '✅ Delivery note updated & PDF downloaded.' : '✅ Delivery note saved & PDF downloaded.')
      + (watermark ? '\n\n⏳ Your account is pending activation — the PDF still has a watermark.' : ''));
    location.href = '/delivery-note-list.html';
  } catch (e) {
    alert(e.message); btn.disabled = false;
    btn.textContent = EDIT_ID ? 'Update & Download PDF' : 'Save & Download PDF';
  }
}
