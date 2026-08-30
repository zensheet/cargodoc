// ============================================
// WATERMARK — dipakai untuk PDF preview guest mode (belum login),
// PRD §73. Ditimpakan ke SEMUA halaman PDF, opacity rendah biar teks asli
// tetap kebaca tapi jelas ini bukan dokumen final.
// ============================================
function drawWatermark(pdf, W, H) {
  const hasGState = typeof pdf.GState === 'function' && typeof pdf.setGState === 'function';
  if (hasGState) pdf.setGState(new pdf.GState({ opacity: 0.18 }));
  pdf.setTextColor(200, 30, 30);
  pdf.setFontSize(42);
  pdf.setFont(undefined, 'bold');
  pdf.text('DRAFT — SIGN UP TO DOWNLOAD', W / 2, H / 2, { angle: 35, align: 'center' });
  if (hasGState) pdf.setGState(new pdf.GState({ opacity: 1 }));
}

function applyWatermarkToAllPages(pdf, W, H) {
  const pages = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    drawWatermark(pdf, W, H);
  }
}

// ============================================
// HEADER (dipakai invoice & packing list) — warna & logo dari branding
// per user (js/branding.js -> getBranding()). branding bisa undefined
// (mis. dipanggil dari kode lama yang belum di-update) — tetap fallback
// ke warna biru default & tanpa logo, PDF tidak pernah gagal gara-gara ini.
// ============================================
async function drawDocHeader(pdf, title, docNumber, docDate, branding, W, M) {
  const barH = 28;
  const [r, g, b] = hexToRgb(branding?.header_color);
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, W, barH, 'F');
  pdf.setTextColor(255);
  pdf.setFontSize(18); pdf.setFont(undefined, 'bold');
  pdf.text(title, M, 13);
  pdf.setFontSize(9); pdf.setFont(undefined, 'normal');
  pdf.text(`No: ${docNumber}    Date: ${docDate || '—'}`, M, 20);

  // Logo (kanan atas bar), kalau user sudah upload
  const logoDataUrl = await fetchLogoDataUrl(branding?.logo_url);
  if (logoDataUrl) {
    try {
      const dims = await loadImageDimensions(logoDataUrl);
      const maxW = 34, maxH = 18;
      let w = maxW, h = (dims.height / dims.width) * w;
      if (h > maxH) { h = maxH; w = (dims.width / dims.height) * h; }
      pdf.addImage(logoDataUrl, W - M - w, (barH - h) / 2, w, h);
    } catch {
      // Gagal render logo (format tidak didukung dsb) — abaikan saja,
      // header tetap tampil dengan warna & teks di atas.
    }
  }

  return barH + 8;
}

// ============================================
// COMMERCIAL INVOICE PDF
// ============================================

async function generateInvoicePDF(data) {
  const { invoice: inv, shipper, receiver, billTo, shipTo, items, branding } = data;
  const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = await drawDocHeader(pdf, 'COMMERCIAL INVOICE', inv.invoice_number, inv.invoice_date, branding, W, M);

  // Shipper / Receiver (Empty Field Rule)
  const block = (title, obj, x) => {
    let yy = y;
    pdf.setTextColor(60); pdf.setFontSize(8); pdf.setFont(undefined, 'bold');
    pdf.text(title, x, yy); yy += 5;
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(9); pdf.setTextColor(0);
    const LABELS = {
      company_name: 'Company', pic: 'PIC', address: 'Address',
      city: 'City', country: 'Country', phone: 'Phone', email: 'Email',
    };
    Object.entries(obj).forEach(([key, val]) => {
      if (val) { pdf.text(`${LABELS[key] || key}: ${val}`, x, yy, { maxWidth: 80 }); yy += 5; }
    });
    return yy;
  };
  const yL = block('SHIPPER / EXPORTER', shipper, M);
  const yR = block('RECEIVER / IMPORTER', receiver, W / 2 + 4);
  y = Math.max(yL, yR) + 6;

  // Bill To / Ship To (opsional — Empty Field Rule: baris ini sama sekali
  // tidak digambar kalau keduanya kosong, biar tidak makan tempat percuma)
  if (billTo?.company_name || shipTo?.company_name) {
    const bY = billTo?.company_name ? block('BILL TO', billTo, M) : y;
    const sY = shipTo?.company_name ? block('SHIP TO', shipTo, W / 2 + 4) : y;
    y = Math.max(bY, sY) + 6;
  }

  // Shipment details (Empty Field Rule)
  const details = [
    ['Shipment Type', inv.shipment_type], ['Currency', inv.currency],
    ['Payment Terms', inv.payment_terms], ['Incoterms', inv.incoterms],
    ['PO Number', inv.po_number], ['Reference', inv.reference_number],
    ['Port of Loading', inv.port_of_loading], ['Port of Discharge', inv.port_of_discharge],
    ['Final Destination', inv.final_destination], ['Country of Origin', inv.country_of_origin],
    ['AWB Number', inv.awb_number], ['BL Number', inv.bl_number],
    ['Container No.', inv.container_number], ['Vessel/Flight', inv.vessel_flight],
  ].filter(([, v]) => v);
  if (details.length) {
    pdf.setFontSize(8);
    const colW = (W - 2 * M) / 2;
    details.forEach(([label, val], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = M + col * colW;
      const yy = y + row * 5;
      pdf.setFont(undefined, 'bold'); pdf.setTextColor(60);
      pdf.text(`${label}:`, x, yy);
      pdf.setFont(undefined, 'normal'); pdf.setTextColor(0);
      pdf.text(String(val), x + 32, yy, { maxWidth: colW - 34 });
    });
    y += Math.ceil(details.length / 2) * 5 + 6;
  }

  // Items table
  pdf.setFontSize(8); pdf.setFont(undefined, 'bold');
  const cols = [
    { label: 'DESCRIPTION', x: M, w: 60 },
    { label: 'HS CODE', x: M + 62, w: 20 },
    { label: 'QTY', x: 122, w: 14, align: 'right' },
    { label: 'UNIT', x: 138, w: 14 },
    { label: 'UNIT PRICE', x: 156, w: 20, align: 'right' },
    { label: 'AMOUNT', x: W - M - 20, w: 20, align: 'right' },
  ];
  pdf.setFillColor(240, 243, 248);
  pdf.rect(M, y - 4, W - 2 * M, 7, 'F');
  cols.forEach(c => pdf.text(c.label, c.x, y, { align: c.align || 'left' }));
  y += 8;

  pdf.setFont(undefined, 'normal'); pdf.setFontSize(8);
  (items || []).forEach(it => {
    if (y > 255) { pdf.addPage(); y = 20; }
    const vals = [
      it.description || '', it.hs_code || '',
      String(it.quantity ?? ''), it.unit || '',
      it.unit_price != null ? it.unit_price.toFixed(2) : '',
      it.amount != null ? it.amount.toFixed(2) : '',
    ];
    cols.forEach((c, i) => pdf.text(vals[i], c.x, y, { align: c.align || 'left', maxWidth: c.w }));
    y += 5.5;
    pdf.setDrawColor(230); pdf.line(M, y - 3, W - M, y - 3);
  });

  // Totals (Empty Field Rule — only show charges that are non-zero)
  y += 4;
  const totalRow = (label, val, bold = false) => {
    if (y > 280) { pdf.addPage(); y = 20; }
    pdf.setFont(undefined, bold ? 'bold' : 'normal');
    pdf.text(label, W - M - 60, y);
    pdf.text(String(val), W - M, y, { align: 'right' });
    y += 6;
  };
  pdf.setDrawColor(0);
  const cur = inv.currency || '';
  totalRow('Subtotal', `${cur} ${(inv.subtotal ?? 0).toFixed(2)}`);
  if (inv.freight) totalRow('Freight', `${cur} ${inv.freight.toFixed(2)}`);
  if (inv.insurance) totalRow('Insurance', `${cur} ${inv.insurance.toFixed(2)}`);
  if (inv.other_charges) totalRow('Other Charges', `${cur} ${inv.other_charges.toFixed(2)}`);
  if (inv.discount) totalRow('Discount', `-${cur} ${inv.discount.toFixed(2)}`);
  totalRow('Grand Total', `${cur} ${(inv.grand_total ?? 0).toFixed(2)}`, true);

  // Additional Information / custom fields (PRD §33-38)
  // FIX: dulu ini di-inject lewat monkey-patch jsPDF.prototype.save() di
  // custom-fields.js, yang hanya aktif di halaman form (invoice.html) —
  // TIDAK aktif saat generate PDF dari invoice-list.html (halaman History,
  // tempat tombol "Download PDF" paling sering dipakai). Jadi custom field
  // yang sudah tersimpan di DB tidak pernah muncul di PDF yang di-download
  // dari situ. Sekarang dibaca langsung dari inv.custom_fields di sini,
  // jadi otomatis berfungsi di semua jalur download PDF.
  y = renderCustomFieldsBlock(pdf, y, inv.custom_fields, W, M);

  if (data.watermark) {
    applyWatermarkToAllPages(pdf, W, 297);
    pdf.save(`PREVIEW-${inv.invoice_number || 'invoice'}.pdf`);
  } else {
    pdf.save(`${inv.invoice_number}.pdf`);
  }
}

// Blok "ADDITIONAL INFORMATION" dari custom_fields (jsonb: {label: value}).
// Dipakai invoice & packing list PDF.
function renderCustomFieldsBlock(pdf, y, customFields, W, M) {
  const entries = Object.entries(customFields || {}).filter(([, v]) => v);
  if (!entries.length) return y;

  y += 2;
  if (y > 270) { pdf.addPage(); y = 20; }
  pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(90);
  pdf.text('ADDITIONAL INFORMATION', M, y); y += 5;
  pdf.setFont(undefined, 'normal'); pdf.setTextColor(0);
  entries.forEach(([k, v]) => {
    if (y > 290) { pdf.addPage(); y = 20; }
    pdf.text(`${k}: ${v}`, M, y, { maxWidth: W - 2 * M });
    y += 4.5;
  });
  return y;
}

// ============================================
// PACKING LIST PDF
// ============================================

async function generatePackingListPDF(data) {
  const { packing_list: pl, shipper, receiver, billTo, shipTo, packages, branding } = data;
  const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = await drawDocHeader(pdf, 'PACKING LIST', pl.packing_list_number, pl.packing_list_date, branding, W, M);

  // Shipper / Receiver (Empty Field Rule)
  const block = (title, obj, x) => {
    let yy = y;
    pdf.setTextColor(60); pdf.setFontSize(8); pdf.setFont(undefined, 'bold');
    pdf.text(title, x, yy); yy += 5;
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(9); pdf.setTextColor(0);
    const LABELS = {
      company_name: 'Company', pic: 'PIC', address: 'Address',
      city: 'City', country: 'Country', phone: 'Phone', email: 'Email',
    };
    Object.entries(obj).forEach(([key, val]) => {
      if (val) { pdf.text(`${LABELS[key] || key}: ${val}`, x, yy, { maxWidth: 80 }); yy += 5; }
    });
    return yy;
  };
  const yL = block('SHIPPER / EXPORTER', shipper, M);
  const yR = block('RECEIVER / IMPORTER', receiver, W / 2 + 4);
  y = Math.max(yL, yR) + 6;

  // Bill To / Ship To (opsional — Empty Field Rule)
  if (billTo?.company_name || shipTo?.company_name) {
    const bY = billTo?.company_name ? block('BILL TO', billTo, M) : y;
    const sY = shipTo?.company_name ? block('SHIP TO', shipTo, W / 2 + 4) : y;
    y = Math.max(bY, sY) + 6;
  }

  // Packages table
  pdf.setFontSize(8); pdf.setFont(undefined, 'bold');
  const cols = [
    { label: 'PKG', x: M, w: 12 },
    { label: 'DESCRIPTION', x: M + 14, w: 44 },
    { label: 'QTY', x: 76, w: 14, align: 'right' },
    { label: 'UNIT', x: 94, w: 14 },
    { label: 'NET (kg)', x: 116, w: 18, align: 'right' },
    { label: 'GROSS (kg)', x: 138, w: 20, align: 'right' },
    { label: 'CBM', x: 162, w: 16, align: 'right' },
    { label: 'TYPE', x: W - M - 18, w: 18 },
  ];
  pdf.setFillColor(240, 243, 248);
  pdf.rect(M, y - 4, W - 2 * M, 7, 'F');
  cols.forEach(c => pdf.text(c.label, c.x, y, { align: c.align || 'left' }));
  y += 8;

  pdf.setFont(undefined, 'normal'); pdf.setFontSize(8);
  packages.forEach(p => {
    if (y > 255) { pdf.addPage(); y = 20; }
    const vals = [
      p.package_number || '', p.description || '',
      String(p.quantity ?? ''), p.unit || '',
      p.net_weight ? p.net_weight.toFixed(2) : '',
      p.gross_weight ? p.gross_weight.toFixed(2) : '',
      p.cbm ? p.cbm.toFixed(4) : '',
      p.package_type || '',
    ];
    cols.forEach((c, i) => pdf.text(vals[i], c.x, y, { align: c.align || 'left', maxWidth: c.w }));
    y += 5.5;
    pdf.setDrawColor(230); pdf.line(M, y - 3, W - M, y - 3);
  });

  // Totals
  y += 4;
  const totalRow = (label, val, bold = false) => {
    pdf.setFont(undefined, bold ? 'bold' : 'normal');
    pdf.text(label, W - M - 60, y);
    pdf.text(String(val), W - M, y, { align: 'right' });
    y += 6;
  };
  pdf.setDrawColor(0);
  totalRow('Total Packages', pl.total_packages ?? packages.length);
  totalRow('Total Quantity', pl.total_quantity ?? 0);
  if (pl.total_net_weight) totalRow('Total Net Weight', `${pl.total_net_weight.toFixed(2)} kg`);
  if (pl.total_gross_weight) totalRow('Total Gross Weight', `${pl.total_gross_weight.toFixed(2)} kg`, true);
  if (pl.total_cbm) totalRow('Total Volume', `${pl.total_cbm.toFixed(4)} CBM`, true);

  // Marks & numbers
  if (pl.marks_numbers) {
    y += 6;
    if (y > 270) { pdf.addPage(); y = 20; }
    pdf.setFontSize(8); pdf.setFont(undefined, 'bold'); pdf.setTextColor(60);
    pdf.text('MARKS & NUMBERS / NOTES', M, y); y += 5;
    pdf.setFont(undefined, 'normal'); pdf.setTextColor(0);
    pdf.text(pl.marks_numbers, M, y, { maxWidth: W - 2 * M });
    y += 5;
  }

  // Additional Information / custom fields (PRD §33-38) — lihat catatan
  // di generateInvoicePDF() soal kenapa ini dipindah dari monkey-patch.
  y = renderCustomFieldsBlock(pdf, y, pl.custom_fields, W, M);

  if (data.watermark) {
    applyWatermarkToAllPages(pdf, W, 297);
    pdf.save(`PREVIEW-${pl.packing_list_number || 'packing-list'}.pdf`);
  } else {
    pdf.save(`${pl.packing_list_number}.pdf`);
  }
}
