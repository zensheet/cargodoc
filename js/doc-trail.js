// ============================================
// DOCUMENT TRAIL — nunjukkin rantai PO -> SO -> Invoice -> Packing List
// -> SI -> DN di UI (lanjutan sql/22-document-linking.sql, yang baru
// nyimpen kolom source_*_id tapi belum ada tampilannya sama sekali).
//
// Dipakai di semua halaman *-list.js (view modal): panggil
// `await renderDocTrail('so', so)` lalu masukkan hasil HTML-nya ke modal
// body. Nunjukkin 2 arah:
//   - ⬆ Upstream : dokumen sumbernya (dari source_*_id di baris ini)
//   - ⬇ Downstream: dokumen lain yang dibuat DARI baris ini (query balik
//     ke tabel anak di rantai, cari source_*_id = id baris ini)
//
// Cuma 1 hop tiap arah (bukan full breadcrumb) -- cukup buat user susur
// manual: dari DN klik ⬆ ke SI, dari SI klik ⬆ ke PL, dst.
// ============================================

const DOC_CHAIN = [
  { key: 'po',      table: 'purchase_orders',        numberCol: 'po_number',            label: 'Purchase Order',       page: 'purchase-order.html' },
  { key: 'so',      table: 'sales_orders',            numberCol: 'so_number',            label: 'Sales Order',          page: 'sales-order.html',          sourceCol: 'source_po_id',             sourceKey: 'po' },
  { key: 'invoice', table: 'invoices',                numberCol: 'invoice_number',       label: 'Invoice',              page: 'invoice.html',              sourceCol: 'source_so_id',             sourceKey: 'so' },
  { key: 'pl',      table: 'packing_lists',           numberCol: 'packing_list_number',  label: 'Packing List',         page: 'packinglist.html',          sourceCol: 'source_invoice_id',        sourceKey: 'invoice' },
  { key: 'si',      table: 'shipping_instructions',   numberCol: 'si_number',            label: 'Shipping Instruction', page: 'shipping-instruction.html', sourceCol: 'source_packing_list_id',   sourceKey: 'pl' },
  { key: 'dn',      table: 'delivery_notes',          numberCol: 'dn_number',            label: 'Delivery Note',        page: 'delivery-note.html',        sourceCol: 'source_si_id',             sourceKey: 'si' },
];

function docChainNode(key) {
  return DOC_CHAIN.find(n => n.key === key);
}

function escTrail(s) {
  return String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * `row` minimal butuh `id` + kolom source_*_id-nya sendiri (baris apa
 * adanya dari supabase select('*') sudah cukup).
 * Return HTML string (bisa kosong kalau tidak ada trail sama sekali).
 */
async function renderDocTrail(currentKey, row) {
  const node = docChainNode(currentKey);
  if (!node) return '';

  const lines = [];

  // ⬆ UPSTREAM: dokumen sumber dokumen ini (kalau diisi lewat "Load from ...")
  if (node.sourceCol && row[node.sourceCol]) {
    const srcNode = docChainNode(node.sourceKey);
    const { data: src } = await supabase
      .from(srcNode.table).select(`id, ${srcNode.numberCol}`)
      .eq('id', row[node.sourceCol]).maybeSingle();
    if (src) {
      lines.push(`⬆ Created from <a href="/${srcNode.page}?id=${src.id}">${srcNode.label} ${escTrail(src[srcNode.numberCol])}</a>`);
    }
  }

  // ⬇ DOWNSTREAM: dokumen lain yang di-"Load from"-kan DARI baris ini
  const childNode = DOC_CHAIN.find(n => n.sourceKey === currentKey);
  if (childNode) {
    const { data: children } = await supabase
      .from(childNode.table).select(`id, ${childNode.numberCol}`)
      .eq(childNode.sourceCol, row.id);
    if (children?.length) {
      const links = children
        .map(c => `<a href="/${childNode.page}?id=${c.id}">${escTrail(c[childNode.numberCol])}</a>`)
        .join(', ');
      lines.push(`⬇ Used in ${childNode.label}: ${links}`);
    }
  }

  const shipmentLink =
    `<a href="/shipment.html?type=${currentKey}&id=${row.id}" style="font-size:13px;">🔗 View Full Shipment Trail</a>`;

  if (!lines.length) {
    return `<div style="margin:12px 0;">${shipmentLink}</div>`;
  }
  return `<div style="background:var(--bg); border-radius:var(--radius); padding:10px 14px; margin:12px 0; font-size:13px;">
    ${lines.join('<br>')}
    <br><br>${shipmentLink}
  </div>`;
}
