// ============================================
// NOTIFY — pengganti alert()/confirm() bawaan browser.
//
// Browser native alert()/confirm() SELALU menampilkan nama domain
// ("cargodoc.pages.dev says...") sebelum pesannya -- ini bagian dari
// keamanan browser, TIDAK BISA di-custom teksnya lewat JS apapun.
// Satu-satunya cara mengganti tampilan itu jadi "CargoDoc says..." adalah
// bikin modal sendiri, bukan pakai dialog bawaan browser sama sekali.
//
//  - alert()   -> di-override langsung (window.alert = ...). Aman, karena
//    tidak ada kode yang bergantung ke return value/sifat blocking-nya.
//  - confirm() -> TIDAK bisa di-override jadi non-blocking dengan aman
//    (kode lama `if (!confirm(x)) return;` butuh jawaban SEBELUM lanjut).
//    Browser modern tidak lagi mengizinkan dialog custom yang benar-benar
//    blocking, jadi confirm() diganti jadi customConfirm(x) yang
//    mengembalikan Promise<boolean> -- semua pemanggilnya sudah diubah
//    jadi `await customConfirm(x)` (lihat commit rebrand CargoDoc).
// ============================================

(function () {
  window.alert = function (message) {
    showNotifyModal(String(message));
  };
})();

function showNotifyModal(message) {
  const overlay = getOrCreateNotifyOverlay('notify-modal-overlay');
  overlay.onclick = e => { if (e.target === overlay) closeNotifyModal(); };

  overlay.innerHTML = `
    <div class="feature-card" style="max-width:380px; width:90%; margin:0;">
      ${brandRow()}
      <p style="white-space:pre-line; font-size:14px; margin:0 0 16px;">${escNotify(message)}</p>
      <button class="btn btn-primary btn-block" id="notify-modal-ok">OK</button>
    </div>`;
  overlay.hidden = false;
  const okBtn = document.getElementById('notify-modal-ok');
  okBtn.onclick = closeNotifyModal;
  okBtn.focus();
}

function closeNotifyModal() {
  const el = document.getElementById('notify-modal-overlay');
  if (el) el.hidden = true;
}

/**
 * Pengganti confirm() -- return Promise<boolean>. Pemanggil WAJIB pakai
 * `await`, mis: `if (!(await customConfirm('Delete this?'))) return;`
 */
function customConfirm(message) {
  return new Promise(resolve => {
    const overlay = getOrCreateNotifyOverlay('confirm-modal-overlay');
    const finish = result => { overlay.hidden = true; resolve(result); };
    overlay.onclick = e => { if (e.target === overlay) finish(false); };

    overlay.innerHTML = `
      <div class="feature-card" style="max-width:380px; width:90%; margin:0;">
        ${brandRow()}
        <p style="white-space:pre-line; font-size:14px; margin:0 0 16px;">${escNotify(message)}</p>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary btn-block" id="confirm-modal-cancel">Cancel</button>
          <button class="btn btn-primary btn-block" id="confirm-modal-ok">OK</button>
        </div>
      </div>`;
    overlay.hidden = false;
    document.getElementById('confirm-modal-ok').onclick = () => finish(true);
    document.getElementById('confirm-modal-cancel').onclick = () => finish(false);
  });
}

function brandRow() {
  return `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <img src="assets/logo-cargodoc.webp" alt="CargoDoc" style="height:18px;">
      <strong style="font-size:14px;">CargoDoc says</strong>
    </div>`;
}

function getOrCreateNotifyOverlay(id) {
  let overlay = document.getElementById(id);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = id;
    overlay.hidden = true;
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:400; ' +
      'display:flex; align-items:center; justify-content:center; padding:16px;';
    document.body.appendChild(overlay);
  }
  return overlay;
}

function escNotify(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
