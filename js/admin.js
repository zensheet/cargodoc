// ============================================
// ADMIN — create users, lock/unlock, toggle features
// Developer only (dijaga requireDeveloper + RLS di DB)
// ============================================

(async function initAdmin() {
  const session = await requireDeveloper();
  if (!session || session.profile.role !== 'developer') return;

  document.getElementById('user-name').textContent = session.profile.email;
  await loadUsers();
})();

// ---------- CREATE USER ----------
// Catatan: membuat user butuh service role — dilakukan via
// Supabase Dashboard ATAU Edge Function kecil (lihat catatan di bawah).
async function createUser(e) {
  e.preventDefault();
  const status = document.getElementById('nu-status');
  status.textContent = 'Creating...';

  // Panggil Edge Function (bukan insert langsung dari browser!)
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: document.getElementById('nu-email').value.trim(),
      password: document.getElementById('nu-pass').value,
      full_name: document.getElementById('nu-name').value.trim(),
      role: document.getElementById('nu-role').value,
    }
  });

  if (error) {
    status.style.color = 'var(--danger)';
    status.textContent = 'Error: ' + await extractFunctionError(error);
    return;
  }
  if (data?.warning) {
    status.style.color = 'var(--warning-border)';
    status.textContent = '⚠️ ' + data.warning;
    await loadUsers();
    return;
  }
  status.style.color = '#166534';
  status.textContent = '✅ User created.';
  document.getElementById('nu-email').value = '';
  document.getElementById('nu-pass').value = '';
  document.getElementById('nu-name').value = '';
  await loadUsers();
}

// supabase-js v2: kalau Edge Function balas status non-2xx, `error.message`
// cuma teks generik ("Edge Function returned a non-2xx status code").
// Pesan asli (mis. "Password must be at least 6 characters.") ada di body
// response, diakses lewat `error.context` (objek Response). Fungsi ini
// coba baca body itu; kalau gagal, fallback ke error.message biasa.
async function extractFunctionError(error) {
  try {
    const body = await error.context.json();
    if (body?.error) return body.error;
  } catch (_) { /* context bukan JSON / tidak ada — pakai fallback */ }
  return error.message || 'Unknown error.';
}

// ---------- LOAD USERS ----------
async function loadUsers() {
  const { data: users } = await supabase
    .from('profiles').select('*').order('created_at');
  const { data: features } = await supabase
    .from('features').select('*').order('feature_name');
  const { data: uf } = await supabase
    .from('user_features').select('user_id, feature_id, enabled');

  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '';

  for (const u of users || []) {
    const tr = document.createElement('tr');

    const badges = (features || []).map(f => {
      const row = (uf || []).find(x => x.user_id === u.id && x.feature_id === f.id);
      const on = row?.enabled === true;
      return `<label style="font-size:12px; display:block; cursor:pointer;">
        <input type="checkbox" ${on ? 'checked' : ''} ${f.active ? '' : 'disabled'}
          onchange="toggleFeature('${u.id}','${f.id}', this.checked)">
        ${f.feature_name}</label>`;
    }).join('');

    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.full_name || '—'}</td>
      <td>${u.role}</td>
      <td><span class="badge ${u.status === 'active' ? 'badge-active' : 'badge-locked'}">
        ${u.status}</span></td>
      <td>${badges}</td>
      <td>
        ${u.status === 'active'
          ? `<button class="btn btn-danger btn-sm" onclick="setLock('${u.id}', true)">Lock</button>`
          : `<button class="btn btn-primary btn-sm" onclick="setLock('${u.id}', false)">Unlock</button>`}
      </td>`;
    tbody.appendChild(tr);
  }
}

// ---------- TOGGLE FEATURE ----------
async function toggleFeature(userId, featureId, enabled) {
  const { error } = await supabase.from('user_features').upsert(
    { user_id: userId, feature_id: featureId, enabled },
    { onConflict: 'user_id,feature_id' }
  );
  if (error) { alert('Failed: ' + error.message); await loadUsers(); }
}

// ---------- LOCK / UNLOCK ----------
async function setLock(userId, lock) {
  if (lock && !confirm('Lock this account? User will be denied access on next login/page load.')) return;
  const { error } = await supabase
    .from('profiles').update({ status: lock ? 'locked' : 'active' }).eq('id', userId);
  if (error) { alert('Failed: ' + error.message); return; }
  await loadUsers();
}
