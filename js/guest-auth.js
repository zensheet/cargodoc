// ============================================
// GUEST MODE — modal signup/login ringan (PRD §73)
// Dipakai bersama oleh invoice.js & packinglist.js. TIDAK menyimpan
// apapun ke DB sendiri -- hanya mengurus UI auth, lalu memanggil balik
// callback yang dikasih pemanggil (invoice.js/packinglist.js) yang tahu
// cara persist dokumennya masing-masing.
//
// Prinsip keamanan (§73): draft dokumen guest cuma hidup di memori JS
// (parameter `data` yang dioper apa adanya, bukan localStorage berisi
// role/permission). Begitu auth sukses, penyimpanan sebenarnya tetap
// lewat persistInvoice()/persistPackingList() -> RLS Supabase yang
// menentukan validitasnya, bukan data dari client.
// ============================================

let GUEST_AUTH_MODE = 'signup'; // 'signup' | 'login'

function ensureGuestAuthModal() {
  if (document.getElementById('guest-auth-overlay')) return;

  const div = document.createElement('div');
  div.id = 'guest-auth-overlay';
  div.hidden = true;
  div.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:200;';
  div.innerHTML = `
    <div class="feature-card" style="max-width:380px; width:92%; margin:10vh auto 0;">
      <h3 id="ga-title">Buat akun gratis</h3>
      <p style="color:var(--text-muted); font-size:13px; margin:6px 0 14px;">
        Dokumen Anda sudah siap. Buat akun gratis untuk menyimpannya.
        PDF tanpa watermark aktif setelah akun Anda diaktivasi admin.
      </p>
      <div id="ga-error" class="alert alert-error" hidden></div>
      <label for="ga-email">Email</label>
      <input id="ga-email" type="email" placeholder="anda@perusahaan.com" autocomplete="email">
      <label for="ga-password">Password</label>
      <input id="ga-password" type="password" placeholder="Minimal 6 karakter" autocomplete="new-password">
      <button class="btn btn-primary btn-block" id="ga-submit" onclick="guestAuthSubmit()">Buat Akun Gratis</button>
      <p style="text-align:center; margin-top:14px; font-size:13px;">
        <a href="#" id="ga-toggle-link" onclick="guestAuthToggleMode(); return false;">Sudah punya akun? Masuk</a>
      </p>
      <button class="btn btn-secondary btn-sm" style="width:100%; margin-top:10px;"
              onclick="closeGuestAuthModal()">Batal</button>
    </div>`;
  document.body.appendChild(div);

  // Enter key di field password langsung submit
  div.querySelector('#ga-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') guestAuthSubmit();
  });
}

/**
 * Buka modal, lalu panggil `onAuthenticated` (async function) SETELAH
 * signup/login sukses & window.APP_SESSION ter-refresh. Pemanggil yang
 * menaruh logic persist (persistInvoice/persistPackingList) + generate
 * PDF asli + redirect di dalam callback ini.
 */
function guestAuthGate(onAuthenticated) {
  ensureGuestAuthModal();
  window.__guestAuthCallback = onAuthenticated;
  GUEST_AUTH_MODE = 'signup';
  applyGuestAuthMode();
  document.getElementById('ga-error').hidden = true;
  document.getElementById('guest-auth-overlay').hidden = false;
  document.getElementById('ga-email').focus();
}

function closeGuestAuthModal() {
  const el = document.getElementById('guest-auth-overlay');
  if (el) el.hidden = true;
}

function guestAuthToggleMode() {
  GUEST_AUTH_MODE = GUEST_AUTH_MODE === 'signup' ? 'login' : 'signup';
  applyGuestAuthMode();
}

function applyGuestAuthMode() {
  const isSignup = GUEST_AUTH_MODE === 'signup';
  document.getElementById('ga-title').textContent =
    isSignup ? 'Buat akun gratis' : 'Masuk ke akun Anda';
  document.getElementById('ga-submit').textContent =
    isSignup ? 'Buat Akun Gratis' : 'Masuk';
  document.getElementById('ga-toggle-link').textContent =
    isSignup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
}

async function guestAuthSubmit() {
  const email = document.getElementById('ga-email').value.trim();
  const password = document.getElementById('ga-password').value;
  const errBox = document.getElementById('ga-error');
  const btn = document.getElementById('ga-submit');
  const isSignup = GUEST_AUTH_MODE === 'signup';

  errBox.hidden = true;
  if (!email || !password) {
    errBox.textContent = 'Email dan password wajib diisi.';
    errBox.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = isSignup ? 'Membuat akun...' : 'Sedang masuk...';

  const result = isSignup
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    errBox.textContent = result.error.message;
    errBox.hidden = false;
    btn.disabled = false;
    btn.textContent = isSignup ? 'Buat Akun Gratis' : 'Masuk';
    return;
  }

  // PRD §73: verifikasi email tidak diwajibkan untuk MVP, jadi signUp()
  // seharusnya langsung mengembalikan session. Kalau ternyata "Confirm
  // email" pernah dinyalakan manual di Supabase Auth settings, session
  // akan kosong -- kasih pesan yang jelas alih-alih diam-diam gagal.
  if (!result.data.session) {
    errBox.textContent = 'Silakan cek email Anda untuk konfirmasi akun, lalu masuk.';
    errBox.hidden = false;
    btn.disabled = false;
    btn.textContent = isSignup ? 'Buat Akun Gratis' : 'Masuk';
    return;
  }

  await refreshSession(); // js/guard.js -> isi ulang window.APP_SESSION

  btn.textContent = 'Menyimpan dokumen Anda...';

  try {
    if (typeof window.__guestAuthCallback === 'function') {
      await window.__guestAuthCallback();
    }
    closeGuestAuthModal();
  } catch (e) {
    // Auth-nya sudah sukses, tapi save dokumen gagal -- jangan tutup modal
    // diam-diam, kasih tau apa yang terjadi supaya user tidak kehilangan
    // draft-nya tanpa penjelasan.
    errBox.textContent = 'Berhasil masuk, tapi gagal menyimpan dokumen: ' + (e.message || e);
    errBox.hidden = false;
    btn.disabled = false;
    btn.textContent = isSignup ? 'Buat Akun Gratis' : 'Masuk';
  }
}

/**
 * Ganti header (History/Dashboard/Logout) jadi versi guest di halaman
 * invoice.html/packinglist.html waktu belum login. Butuh
 * `id="header-user-info"` di div .user-info halaman terkait.
 */
function renderGuestHeader() {
  const info = document.getElementById('header-user-info');
  if (!info) return;
  info.innerHTML = `
    <span style="color:var(--text-muted);">Mode Tamu</span>
    <a href="/login.html" class="btn btn-secondary btn-sm">Masuk</a>`;
}
