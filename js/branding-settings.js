// ============================================
// BRANDING SETTINGS PAGE (branding.html)
// Load & save header color + logo per user.
// Butuh: js/branding.js (getBranding, BRANDING_DEFAULT) sudah di-load
// duluan, dan storage bucket 'logos' (lihat sql/12-branding-settings.sql).
// ============================================

const MAX_LOGO_BYTES = 1_000_000; // 1 MB
let PENDING_LOGO_FILE = null; // file yang dipilih tapi belum di-Save
let PENDING_REMOVE_LOGO = false;
let CURRENT_LOGO_URL = null;

(async function initBranding() {
  const session = await requireAuth();
  if (!session) return;
  document.getElementById('user-name').textContent = session.profile.email;

  const branding = await getBranding();
  CURRENT_LOGO_URL = branding.logo_url;

  setColor(branding.header_color);
  if (branding.logo_url) showLogoPreview(branding.logo_url);

  document.getElementById('b-color').addEventListener('input', (e) => setColor(e.target.value, true));
  document.getElementById('b-color-hex').addEventListener('input', (e) => setColor(e.target.value, true));
  document.getElementById('b-logo-file').addEventListener('change', onLogoFileChange);
})();

// ---------- COLOR ----------
function setColor(hex, skipSyncCheck) {
  const clean = normalizeHex(hex);
  if (!clean) return; // biarkan user selesai ngetik kalau belum valid
  document.getElementById('b-color').value = clean;
  document.getElementById('b-color-hex').value = clean;
  document.getElementById('header-preview').style.background = clean;
}

function normalizeHex(hex) {
  const m = /^#?([a-f\d]{6})$/i.exec((hex || '').trim());
  return m ? `#${m[1]}` : null;
}

function resetColor() {
  setColor(BRANDING_DEFAULT.header_color);
}

// ---------- LOGO ----------
function onLogoFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_LOGO_BYTES) {
    showStatus('Logo terlalu besar (maks 1 MB). Pilih file lain.', true);
    e.target.value = '';
    return;
  }

  PENDING_LOGO_FILE = file;
  PENDING_REMOVE_LOGO = false;
  const reader = new FileReader();
  reader.onload = () => showLogoPreview(reader.result);
  reader.readAsDataURL(file);
}

function showLogoPreview(url) {
  const img = document.getElementById('logo-preview-img');
  img.src = url;
  img.hidden = false;
  document.getElementById('b-logo-remove').hidden = false;
}

function removeLogo() {
  PENDING_LOGO_FILE = null;
  PENDING_REMOVE_LOGO = true;
  document.getElementById('b-logo-file').value = '';
  document.getElementById('logo-preview-img').hidden = true;
  document.getElementById('b-logo-remove').hidden = true;
}

// ---------- SAVE ----------
async function saveBranding() {
  const btn = document.getElementById('b-save');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const session = await getSession();
    const headerColor = normalizeHex(document.getElementById('b-color-hex').value)
      || BRANDING_DEFAULT.header_color;

    let logoUrl = CURRENT_LOGO_URL;

    if (PENDING_REMOVE_LOGO) {
      logoUrl = null;
    } else if (PENDING_LOGO_FILE) {
      const ext = (PENDING_LOGO_FILE.name.split('.').pop() || 'png').toLowerCase();
      const path = `${session.user.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('logos')
        .upload(path, PENDING_LOGO_FILE, { upsert: true, cacheControl: '3600' });
      if (upErr) throw new Error('Upload logo gagal: ' + upErr.message);

      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path);
      // cache-bust supaya PDF & preview selalu ambil versi terbaru,
      // bukan versi lama yang mungkin sudah ke-cache browser/CDN
      logoUrl = `${pub.publicUrl}?v=${Date.now()}`;
    }

    const { error } = await supabase
      .from('branding_settings')
      .upsert({ user_id: session.user.id, header_color: headerColor, logo_url: logoUrl,
                updated_at: new Date().toISOString() });
    if (error) throw new Error('Simpan gagal: ' + error.message);

    CURRENT_LOGO_URL = logoUrl;
    PENDING_LOGO_FILE = null;
    PENDING_REMOVE_LOGO = false;
    showStatus('✅ Branding tersimpan. PDF berikutnya akan pakai warna & logo ini.', false);
  } catch (e) {
    showStatus(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

function showStatus(msg, isError) {
  const el = document.getElementById('b-status');
  el.textContent = msg;
  el.style.color = isError ? 'var(--danger)' : '#15803d';
}
