// ============================================
// AUTH — login, logout, session
// PRD §6: Email + password (dibuat oleh Developer, tidak ada public signup)
// ============================================

// Ganti namespace window.supabase (library) dengan instance client.
// Sengaja pakai assignment biasa, BUKAN `const supabase = ...` — karena
// CDN supabase-js@2 sudah bikin global bernama `supabase` duluan, dan
// `const`/`let` tidak boleh mendeklarasikan ulang nama global yang sudah
// ada (-> "Identifier 'supabase' has already been declared").
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Session cache di memori tab ini (tidak simpan password)
window.APP_SESSION = null;

// ---------- LOGIN ----------
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const errBox = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Logging in...';
  errBox.hidden = true;

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic error — jangan bocorkan apakah email terdaftar (PRD §Security)
    showLoginError('Invalid email or password. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Login';
    return;
  }

  // Ambil profile
  const { data: profile, error: pErr } = await supabase
    .from('profiles').select('*').eq('id', data.user.id).single();

  if (pErr || !profile) {
    showLoginError('Account not properly configured. Contact the administrator.');
    await supabase.auth.signOut();
    btn.disabled = false;
    btn.textContent = 'Login';
    return;
  }

  // PRD §8: Account Status check
  if (profile.status === 'locked') {
    await supabase.auth.signOut();
    showLoginError(
      'Access Denied\n\nYour account has been locked by the administrator. ' +
      'Please contact support for assistance.'
    );
    btn.disabled = false;
    btn.textContent = 'Login';
    return;
  }

  // Ambil feature access (PRD §9)
  const { data: uf } = await supabase
    .from('user_features')
    .select('enabled, features(feature_key)')
    .eq('user_id', data.user.id);

  window.APP_SESSION = {
    user: data.user,
    profile,
    features: Object.fromEntries((uf || []).map(x => [x.features.feature_key, x.enabled]))
  };

  // Developer -> admin.html, Customer -> app.html
  location.href = profile.role === 'developer' ? '/admin.html' : '/app.html';
});

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.hidden = false;
}

// ---------- LOGOUT ----------
async function logout() {
  await supabase.auth.signOut();
  window.APP_SESSION = null;
  location.href = '/index.html';
}
