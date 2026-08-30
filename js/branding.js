// ============================================
// BRANDING — helper untuk header PDF (warna & logo per user)
// Dipakai di semua halaman yang generate PDF (invoice, invoice-list,
// packinglist, packinglist-list) DAN di branding.html (halaman setting).
// Harus di-include SETELAH js/auth.js & js/guard.js (butuh getSession()).
// ============================================

const BRANDING_DEFAULT = { header_color: '#1a56db', logo_url: null };

/** Ambil setting branding user yang sedang login. Selalu balikin object
 *  yang valid (fallback ke default) — supaya generate PDF tidak pernah
 *  gagal gara-gara branding belum pernah diset. */
async function getBranding() {
  const session = await getSession();
  if (!session) return { ...BRANDING_DEFAULT };

  const { data, error } = await supabase
    .from('branding_settings')
    .select('header_color, logo_url')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !data) return { ...BRANDING_DEFAULT };
  return {
    header_color: data.header_color || BRANDING_DEFAULT.header_color,
    logo_url: data.logo_url || null,
  };
}

/** "#rrggbb" -> [r,g,b] untuk pdf.setFillColor(). Fallback ke biru default
 *  kalau formatnya tidak valid, biar PDF tetap kegenerate. */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return [26, 86, 219];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Fetch logo dari URL publik Supabase Storage lalu convert ke data URL
 *  (jsPDF.addImage butuh data URL/base64, bukan URL biasa). Balikin null
 *  kalau tidak ada logo atau gagal fetch — PDF tetap jalan tanpa logo. */
async function fetchLogoDataUrl(logoUrl) {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Ambil dimensi asli gambar dari data URL, dipakai buat jaga aspect ratio
 *  logo waktu digambar di PDF (supaya tidak gepeng/melar). */
function loadImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
