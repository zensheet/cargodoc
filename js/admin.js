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

  const now = new Date();

  for (const u of users || []) {
    const tr = document.createElement('tr');

    const badges = `<div class="feature-check-list">` + (features || []).map(f => {
      const row = (uf || []).find(x => x.user_id === u.id && x.feature_id === f.id);
      const on = row?.enabled === true;
      return `<label>
        <input type="checkbox" ${on ? 'checked' : ''} ${f.active ? '' : 'disabled'}
          onchange="toggleFeature('${u.id}','${f.id}', this.checked)">
        ${f.feature_name}</label>`;
    }).join('') + `</div>`;

    // sql/25-trial-mode.sql: status cuma 'active'/'locked' -- trial
    // dihitung murni dari trial_ends_at (bukan dari status). NULL =
    // paid/lifetime (admin-created atau sudah upgrade). Di masa depan =
    // masih trial. Di masa lalu = trial habis, watermark aktif.
    const trialEndsAt = u.trial_ends_at ? new Date(u.trial_ends_at) : null;
    const isLocked = u.status === 'locked';
    const isPaid = !isLocked && !trialEndsAt;
    const isTrialActive = !isLocked && trialEndsAt && trialEndsAt > now;
    const isTrialExpired = !isLocked && trialEndsAt && trialEndsAt <= now;

    let badgeClass, statusLabel;
    if (isLocked) { badgeClass = 'badge-locked'; statusLabel = 'locked'; }
    else if (isPaid) { badgeClass = 'badge-active'; statusLabel = 'active (paid)'; }
    else if (isTrialActive) {
      const daysLeft = Math.ceil((trialEndsAt - now) / 86400000);
      badgeClass = 'badge-pending'; statusLabel = `trial (${daysLeft}d left)`;
    } else { badgeClass = 'badge-pending'; statusLabel = 'trial expired'; }

    // Akun trial (aktif ATAU sudah habis) -> tombol "Mark as Paid"
    // (trial_ends_at dikosongkan = permanen tanpa watermark) + "+14
    // Days" (perpanjang trial, mis. kalau customer minta lebih waktu
    // sebelum mutusin bayar) + tetap bisa "Lock". Akun paid -> cuma
    // "Lock". Akun locked -> "Unlock" (balik ke status 'active', trial
    // sebelumnya TIDAK di-reset).
    let actions;
    if (isLocked) {
      actions = `<button class="btn btn-primary btn-sm" onclick="setStatus('${u.id}', 'active')">Unlock</button>`;
    } else if (trialEndsAt) {
      actions = `<button class="btn btn-primary btn-sm" onclick="markAsPaid('${u.id}')">Mark as Paid</button>
        <button class="btn btn-secondary btn-sm" onclick="extendTrial('${u.id}')">+14 Days</button>
        <button class="btn btn-danger btn-sm" onclick="setStatus('${u.id}', 'locked')">Lock</button>`;
    } else {
      actions = `<button class="btn btn-danger btn-sm" onclick="setStatus('${u.id}', 'locked')">Lock</button>`;
    }

    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.full_name || '—'}</td>
      <td>${u.role}</td>
      <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
      <td>${badges}</td>
      <td style="white-space:nowrap;">${actions}</td>`;
    tbody.appendChild(tr);
  }
}

// ---------- TOGGLE FEATURE ----------
async function toggleFeature(userId, featureId, enabled) {
  const { error } = await supabase.from('user_features').upsert(
    { user_id: userId, feature_id: featureId, enabled },
    { onConflict: 'user_id,feature_id' }
  );
  if (error) { alert('Gagal: ' + error.message); await loadUsers(); }
}

// ---------- LOCK / UNLOCK ----------
// 'locked' -> tidak bisa login sama sekali (lihat js/guard.js getSession()).
// Unlock balik ke 'active', trial_ends_at TIDAK di-reset (kalau trial-nya
// sudah habis sebelum di-lock, tetap habis setelah di-unlock).
async function setStatus(userId, newStatus) {
  if (newStatus === 'locked'
      && !(await customConfirm('Lock this account? User will be denied access on next login/page load.'))) return;
  const { error } = await supabase
    .from('profiles').update({ status: newStatus }).eq('id', userId);
  if (error) { alert('Gagal: ' + error.message); return; }
  await loadUsers();
}

// ---------- MARK AS PAID (upgrade ke Lifetime) ----------
// sql/25-trial-mode.sql: trial_ends_at dikosongkan (NULL) = permanen
// tanpa watermark, tidak pernah dihitung ulang lagi kapan pun.
async function markAsPaid(userId) {
  if (!(await customConfirm('Mark this account as paid (Lifetime Access)? Watermark will be removed permanently.'))) return;
  const { error } = await supabase
    .from('profiles').update({ trial_ends_at: null }).eq('id', userId);
  if (error) { alert('Gagal: ' + error.message); return; }
  await loadUsers();
}

// ---------- EXTEND TRIAL +14 DAYS ----------
// Selalu dihitung dari HARI INI (bukan menambah ke trial_ends_at lama),
// supaya tetap "+14 hari mulai sekarang" walau trial-nya sudah lama habis.
async function extendTrial(userId) {
  if (!(await customConfirm('Extend this account\'s trial by 14 more days, starting today?'))) return;
  const newTrialEnd = new Date(Date.now() + 14 * 86400000).toISOString();
  const { error } = await supabase
    .from('profiles').update({ trial_ends_at: newTrialEnd }).eq('id', userId);
  if (error) { alert('Gagal: ' + error.message); return; }
  await loadUsers();
}
