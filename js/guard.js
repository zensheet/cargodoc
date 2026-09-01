// ============================================
// GUARD — proteksi halaman app.html / admin.html
// Dipanggil di awal setiap protected page:
//   const session = await requireAuth();          // customer/developer
//   const session = await requireDeveloper();     // admin only
//   const session = await requireFeature('invoice');
// ============================================

async function getSession() {
  // 1. Cek cache
  if (window.APP_SESSION) return window.APP_SESSION;

  // 2. Cek Supabase session
  const { data: { session: sbSession } } = await supabase.auth.getSession();
  if (!sbSession) return null;

  // 3. Ambil profile
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', sbSession.user.id).single();
  if (!profile) return null;

  // PRD §8: locked -> kick out
  if (profile.status === 'locked') {
    await supabase.auth.signOut();
    return null;
  }

  // 4. Ambil features
  const { data: uf } = await supabase
    .from('user_features')
    .select('enabled, features(feature_key)')
    .eq('user_id', sbSession.user.id);

  window.APP_SESSION = {
    user: sbSession.user,
    profile,
    features: Object.fromEntries((uf || []).map(x => [x.features.feature_key, x.enabled]))
  };
  return window.APP_SESSION;
}

async function requireAuth() {
  const session = await getSession();
  if (!session) location.href = '/login.html';
  return session;
}

async function requireDeveloper() {
  const session = await requireAuth();
  if (session && session.profile.role !== 'developer') {
    location.href = '/app.html'; // bukan developer -> kembali ke app
  }
  return session;
}

/**
 * Feature gate. Mengembalikan { allowed, session }.
 * UI memakai `allowed` untuk menyembunyikan menu (UX layer),
 * sedangkan security sebenarnya ada di RLS database.
 */
async function requireFeature(featureKey) {
  const session = await requireAuth();
  if (!session) return { allowed: false, session: null };

  // Developer bypass semua feature
  const allowed = session.profile.role === 'developer'
    || session.features[featureKey] === true;

  return { allowed, session };
}

/** Refresh feature cache (misal setelah admin mengubah akses) */
async function refreshSession() {
  window.APP_SESSION = null;
  return getSession();
}

/**
 * Feature gate versi GUEST MODE (PRD §73). Dipakai HANYA di invoice.html
 * & packinglist.html -- dua-duanya boleh diakses TANPA login.
 *
 *  - Belum login sama sekali  -> { allowed:true, session:null, guest:true }
 *    (form tetap bisa dipakai; simpan ke DB ditunda sampai user signup/login
 *    di titik klik Save/Download -- lihat js/guest-auth.js)
 *  - Sudah login tapi fitur ini tidak di-enable untuk akunnya (kasus akun
 *    admin-created yang belum di-enable Developer) -> tetap ditolak & lempar
 *    ke /app.html, SAMA seperti requireFeature() biasa. Guest mode tidak
 *    dimaksudkan untuk membypass proteksi akun yang sudah login.
 *  - Developer selalu allowed (bypass), sama seperti requireFeature().
 */
async function requireFeatureOrGuest(featureKey) {
  const session = await getSession(); // TIDAK redirect kalau belum login
  if (!session) return { allowed: true, session: null, guest: true };

  const allowed = session.profile.role === 'developer'
    || session.features[featureKey] === true;

  return { allowed, session, guest: false };
}

/**
 * PRD §74 (Account Activation / Payment Gate).
 * PDF final TANPA watermark hanya untuk akun yang statusnya persis
 * 'active' (admin-created langsung aktif, atau self-signup yang sudah
 * di-klik "Activate" oleh admin setelah verifikasi pembayaran).
 *
 *  - Guest (belum login sama sekali)        -> selalu watermark.
 *  - Developer                              -> tidak pernah watermark.
 *  - Customer status 'pending' atau 'locked' -> watermark.
 *    (Locked sebenarnya sudah tidak bisa login sama sekali -- lihat
 *    getSession() -- tapi tetap dijaga di sini kalau-kalau dipanggil
 *    dari state APP_SESSION yang stale.)
 *  - Customer status 'active'               -> tidak watermark.
 */
function accountNeedsWatermark(session) {
  if (!session) return true;
  if (session.profile.role === 'developer') return false;
  return session.profile.status !== 'active';
}

/**
 * PRD §74 — Popup "Aktivasi Akun Diperlukan".
 * Dipanggil di 2 titik: (1) begitu guest baru saja signup & dokumennya
 * tersimpan (lihat *.js saveAndDownload/saveOnly, param opts.justSaved),
 * dan (2) lewat tombol "Hubungi Admin" di banner pending yang sudah ada
 * di app.html/invoice.html/dll.
 *
 * Link WA/email dibuat clickable + pesan WA di-prefill otomatis dengan
 * email akun (kalau session tersedia) supaya admin langsung tau akun
 * siapa yang chat, tanpa user perlu ngetik ulang.
 */
function showActivationModal(opts = {}) {
  const email = opts.email || window.APP_SESSION?.profile?.email || '';
  const waMsg = encodeURIComponent(
    `Halo Admin, saya ingin aktivasi akun ${APP_NAME} saya.${email ? `\nEmail: ${email}` : ''}`);
  const waHref = `https://wa.me/${SUPPORT_WHATSAPP_INTL}?text=${waMsg}`;
  const mailHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Aktivasi Akun ${APP_NAME}`)}` +
    `&body=${encodeURIComponent(`Halo Admin, saya ingin aktivasi akun ${APP_NAME} saya.${email ? `\nEmail: ${email}` : ''}`)}`;

  const close = () => {
    document.getElementById('activation-modal-overlay').hidden = true;
    if (typeof opts.onClose === 'function') opts.onClose(); // mis. baru redirect SETELAH modal ditutup
  };

  let overlay = document.getElementById('activation-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'activation-modal-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:300;';
    document.body.appendChild(overlay);
  }
  overlay.onclick = e => { if (e.target === overlay) close(); };

  overlay.innerHTML = `
    <div class="feature-card" style="max-width:420px; width:92%; margin:8vh auto 0; max-height:88vh; overflow-y:auto;">
      <h3>Aktivasi Akun ${APP_NAME}</h3>
      <p style="color:var(--text-muted); font-size:14px; margin:10px 0 14px;">
        ${opts.justSaved ? 'Dokumen Anda sudah tersimpan. ' : ''}Akun Anda ${opts.justSaved ? '' : 'sudah'} berhasil dibuat, namun belum aktif.
      </p>

      <div style="background:var(--warning-bg); border-radius:8px; padding:14px; margin-bottom:14px;">
        <p style="font-weight:600; margin:0 0 4px;">🎉 Early Access — ${ACTIVATION_PRICE_DISPLAY} Lifetime</p>
        <p style="font-size:13px; color:var(--text-muted); margin:0;">
          Sekali bayar, tanpa biaya bulanan dan tanpa biaya per dokumen.
        </p>
      </div>

      <p style="font-size:13px; margin:0 0 14px;">
        Aktivasi memberikan akses ke seluruh fitur ${APP_NAME} yang tersedia saat
        ini, termasuk pembuatan dan download dokumen PDF tanpa watermark.
      </p>

      <p style="font-size:13px; margin:0 0 6px;">Untuk pembayaran dan aktivasi, silakan hubungi Admin:</p>
      <p style="font-size:13px; margin:0 0 4px;">
        WhatsApp: <a href="${waHref}" target="_blank" rel="noopener">${SUPPORT_WHATSAPP_DISPLAY}</a>
      </p>
      <p style="font-size:13px; margin:0 0 14px;">
        Email: <a href="${mailHref}">${SUPPORT_EMAIL}</a>
      </p>

      <p style="font-size:12px; color:var(--text-muted); margin:0 0 16px;">
        Setelah pembayaran dikonfirmasi, Admin akan mengaktifkan akun Anda.
      </p>

      <a href="${waHref}" target="_blank" rel="noopener"
         class="btn btn-primary btn-block" style="text-align:center; text-decoration:none;">
        Hubungi Admin
      </a>
      <button class="btn btn-secondary btn-sm" style="width:100%; margin-top:10px;" id="activation-modal-ok">
        Nanti Saja
      </button>
    </div>`;
  document.getElementById('activation-modal-ok').onclick = close;
  overlay.hidden = false;
}
