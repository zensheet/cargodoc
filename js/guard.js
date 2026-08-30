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
