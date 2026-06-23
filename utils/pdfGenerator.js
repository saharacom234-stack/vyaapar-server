const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoice, business, res) => {
  const PAGE_H = 841.89; // A4 height in points
  const BOTTOM_MARGIN = 60; // reserved for footer
  const doc = new PDFDocument({ margins: { top: 50, left: 50, right: 50, bottom: 20 }, size: 'A4', autoFirstPage: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoiceNo}.pdf`);
  doc.pipe(res);

  const PRIMARY    = '#1a7f5a';
  const PRIMARY_DK = '#145e42';
  const LIGHT_BG   = '#f4f7f6';
  const BORDER     = '#dde5e2';
  const TEXT_DARK  = '#1a2e27';
  const TEXT_MID   = '#4a6358';
  const TEXT_LITE  = '#8aab9e';

  const L  = 50;              // left margin
  const R  = doc.page.width - 50; // right margin
  const W  = R - L;           // usable width
  const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));
  const money   = (v) => `Rs.${safeNum(v).toFixed(2)}`;

  // ─────────────────────────────────────────────────────────
  // HEADER BAND
  // ─────────────────────────────────────────────────────────
  doc.rect(L, 45, W, 100).fill(PRIMARY);

  // Business name
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
     .text(business.businessName || 'Business Name', L + 12, 58, { width: W / 2 - 10 });

  // Business details (left side)
  doc.font('Helvetica').fontSize(8.5).fillColor('rgba(255,255,255,0.8)');
  let bY = 84;
  if (business.GSTIN) {
    doc.text(`GSTIN: ${business.GSTIN}`, L + 12, bY); bY += 13;
  }
  const addrParts = [
    business.address?.street,
    business.address?.city,
    business.address?.state,
    business.address?.pincode,
  ].filter(Boolean).join(', ');
  if (addrParts) { doc.text(addrParts, L + 12, bY, { width: W / 2 - 20 }); bY += 13; }
  if (business.phone) { doc.text(`Ph: ${business.phone}`, L + 12, bY); }

  // Invoice label + number (right side)
  const rightX = L + W / 2 + 10;
  const rightW = W / 2 - 12;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
     .text('TAX INVOICE', rightX, 58, { width: rightW, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.85)');
  doc.text(`Invoice No: ${invoice.invoiceNo}`, rightX, 89, { width: rightW, align: 'right' });
  doc.text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, rightX, 102, { width: rightW, align: 'right' });
  if (invoice.dueDate) {
    doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, rightX, 115, { width: rightW, align: 'right' });
  }

  // ─────────────────────────────────────────────────────────
  // BILL TO / SHIP TO
  // ─────────────────────────────────────────────────────────
  const billY = 158;
  doc.rect(L, billY, W, 72).fill(LIGHT_BG).stroke(BORDER);
  doc.rect(L, billY, W / 2, 72).fill(LIGHT_BG); // left cell

  // "BILL TO" label
  doc.rect(L, billY, W / 2, 18).fill(PRIMARY_DK);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
     .text('BILL TO', L + 10, billY + 5, { width: W / 2 - 10 });

  // Customer info
  const cust = invoice.customer || {};
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
     .text(cust.name || '—', L + 10, billY + 24, { width: W / 2 - 20 });
  doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_MID);
  const custAddr = [cust.address?.street, cust.address?.city, cust.address?.state, cust.address?.pincode]
    .filter(Boolean).join(', ');
  if (custAddr) doc.text(custAddr, L + 10, billY + 39, { width: W / 2 - 20 });
  const custMeta = [
    cust.GSTIN ? `GSTIN: ${cust.GSTIN}` : null,
    cust.phone ? `Ph: ${cust.phone}` : null,
    cust.email ? cust.email : null,
  ].filter(Boolean).join('  |  ');
  if (custMeta) doc.text(custMeta, L + 10, billY + 52, { width: W / 2 - 20 });

  // Right cell: invoice meta summary
  doc.rect(L + W / 2, billY, W / 2, 18).fill(PRIMARY_DK);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
     .text('INVOICE SUMMARY', L + W / 2 + 10, billY + 5);

  doc.fillColor(TEXT_MID).font('Helvetica').fontSize(8.5);
  const statusColor = invoice.paymentStatus === 'paid' ? '#1a7f5a' : invoice.paymentStatus === 'partial' ? '#f0a500' : '#e63946';
  const metaRows = [
    ['Invoice Type:', invoice.type === 'sale' ? 'Sale Invoice' : 'Purchase Invoice'],
    ['GST Type:', invoice.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'],
  ];
  metaRows.forEach(([k, v], i) => {
    doc.fillColor(TEXT_MID).font('Helvetica').text(k, L + W / 2 + 10, billY + 24 + i * 13);
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').text(v, L + W / 2 + 90, billY + 24 + i * 13);
  });
  // Payment status badge
  const statusLabel = (invoice.paymentStatus || 'unpaid').toUpperCase();
  doc.roundedRect(L + W / 2 + 10, billY + 50, 60, 14, 4).fill(statusColor);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
     .text(statusLabel, L + W / 2 + 10, billY + 53, { width: 60, align: 'center' });

  // ─────────────────────────────────────────────────────────
  // ITEMS TABLE
  // ─────────────────────────────────────────────────────────
  let y = billY + 82;

  // Column definitions [label, x, width, align]
  const cols = [
    { h: '#',        x: L,        w: 22,  align: 'left'  },
    { h: 'Item / Description', x: L + 24, w: 155, align: 'left' },
    { h: 'HSN',      x: L + 181,  w: 45,  align: 'center' },
    { h: 'Qty',      x: L + 228,  w: 30,  align: 'center' },
    { h: 'Rate',     x: L + 260,  w: 55,  align: 'right' },
    { h: 'Disc%',    x: L + 317,  w: 35,  align: 'center' },
    { h: 'GST%',     x: L + 354,  w: 35,  align: 'center' },
    { h: 'Amount',   x: L + 391,  w: W - 391, align: 'right' },
  ];

  // Header row
  doc.rect(L, y, W, 20).fill(PRIMARY);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
  cols.forEach(c => {
    doc.text(c.h, c.x + 2, y + 6, { width: c.w - 4, align: c.align });
  });
  y += 20;

  // Item rows
  doc.font('Helvetica').fontSize(8.5);
  invoice.items.forEach((item, i) => {
    // New page if needed
    if (y > doc.page.height - 180) {
      doc.addPage();
      y = 50;
      // Redraw header on new page
      doc.rect(L, y, W, 20).fill(PRIMARY);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
      cols.forEach(c => doc.text(c.h, c.x + 2, y + 6, { width: c.w - 4, align: c.align }));
      y += 20;
      doc.font('Helvetica').fontSize(8.5);
    }

    const rowH = 22;
    doc.rect(L, y, W, rowH).fill(i % 2 === 0 ? '#ffffff' : LIGHT_BG);
    // Row border
    doc.rect(L, y, W, rowH).stroke(BORDER);

    doc.fillColor(TEXT_DARK);
    doc.text(String(i + 1),               cols[0].x + 2, y + 7, { width: cols[0].w - 4, align: 'left' });
    doc.text(item.name || '',              cols[1].x + 2, y + 7, { width: cols[1].w - 4, align: 'left' });
    doc.text(item.HSNCode || '-',          cols[2].x + 2, y + 7, { width: cols[2].w - 4, align: 'center' });
    doc.text(String(item.quantity || 0),   cols[3].x + 2, y + 7, { width: cols[3].w - 4, align: 'center' });
    doc.text(money(item.rate),             cols[4].x + 2, y + 7, { width: cols[4].w - 4, align: 'right' });
    doc.text(`${item.discount || 0}%`,     cols[5].x + 2, y + 7, { width: cols[5].w - 4, align: 'center' });
    doc.text(`${item.gstRate || 0}%`,      cols[6].x + 2, y + 7, { width: cols[6].w - 4, align: 'center' });
    doc.font('Helvetica-Bold')
       .text(money(item.totalAmount),      cols[7].x + 2, y + 7, { width: cols[7].w - 4, align: 'right' });
    doc.font('Helvetica');
    y += rowH;
  });

  // ─────────────────────────────────────────────────────────
  // GST BREAKDOWN (left) + TOTALS (right)
  // ─────────────────────────────────────────────────────────
  y += 12;
  const totY = y;
  const halfW = W / 2 - 10;

  // Left: GST detail table per rate (if items have different rates)
  const gstMap = {};
  invoice.items.forEach(item => {
    const rate = item.gstRate || 0;
    if (!gstMap[rate]) gstMap[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    gstMap[rate].taxable += safeNum(item.taxableAmount);
    gstMap[rate].cgst    += safeNum(item.cgst);
    gstMap[rate].sgst    += safeNum(item.sgst);
    gstMap[rate].igst    += safeNum(item.igst);
  });

  doc.rect(L, totY, halfW, 18).fill(PRIMARY_DK);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
     .text('GST BREAKDOWN', L + 6, totY + 5);

  // GST table header
  let gY = totY + 20;
  doc.rect(L, gY, halfW, 14).fill(LIGHT_BG);
  doc.fillColor(TEXT_MID).font('Helvetica-Bold').fontSize(7.5);
  doc.text('GST Rate', L + 4,         gY + 3, { width: 50 });
  doc.text('Taxable Amt', L + 55,     gY + 3, { width: 65, align: 'right' });
  if (!invoice.isInterState) {
    doc.text('CGST',  L + 122, gY + 3, { width: 45, align: 'right' });
    doc.text('SGST',  L + 169, gY + 3, { width: 45, align: 'right' });
  } else {
    doc.text('IGST',  L + 122, gY + 3, { width: 90, align: 'right' });
  }
  gY += 14;

  doc.font('Helvetica').fontSize(8).fillColor(TEXT_DARK);
  Object.entries(gstMap).forEach(([rate, v], idx) => {
    doc.rect(L, gY, halfW, 14).fill(idx % 2 === 0 ? '#fff' : LIGHT_BG);
    doc.text(`${rate}%`, L + 4, gY + 3, { width: 50 });
    doc.text(money(v.taxable), L + 55, gY + 3, { width: 65, align: 'right' });
    if (!invoice.isInterState) {
      doc.text(money(v.cgst), L + 122, gY + 3, { width: 45, align: 'right' });
      doc.text(money(v.sgst), L + 169, gY + 3, { width: 45, align: 'right' });
    } else {
      doc.text(money(v.igst), L + 122, gY + 3, { width: 90, align: 'right' });
    }
    gY += 14;
  });

  // Right: totals box
  const tX = L + halfW + 20;
  const tW = W - halfW - 20;

  const tRow = (label, value, highlight = false) => {
    if (highlight) {
      doc.rect(tX, y, tW, 22).fill(PRIMARY);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10);
      doc.text(label, tX + 6, y + 6, { width: tW / 2 });
      doc.text(value,  tX + tW / 2, y + 6, { width: tW / 2 - 6, align: 'right' });
      y += 24;
    } else {
      doc.rect(tX, y, tW, 16).fill('#fff').stroke(BORDER);
      doc.fillColor(TEXT_MID).font('Helvetica').fontSize(8.5);
      doc.text(label, tX + 6, y + 4, { width: tW / 2 });
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold');
      doc.text(value,  tX + tW / 2, y + 4, { width: tW / 2 - 6, align: 'right' });
      y += 16;
    }
  };

  y = totY;
  tRow('Subtotal',          money(invoice.subtotal));
  if (safeNum(invoice.totalDiscount) > 0) {
    tRow('(-) Discount',    `-${money(invoice.totalDiscount)}`);
  }
  tRow('Taxable Amount',    money(invoice.totalTaxableAmount));
  if (!invoice.isInterState) {
    tRow('(+) CGST',        money(invoice.totalCGST));
    tRow('(+) SGST',        money(invoice.totalSGST));
  } else {
    tRow('(+) IGST',        money(invoice.totalIGST));
  }
  if (invoice.roundOff && safeNum(invoice.roundOff) !== 0) {
    tRow('Round Off',       money(invoice.roundOff));
  }
  tRow('TOTAL AMOUNT',      money(invoice.finalAmount), true);

  // Paid / Balance rows
  if (safeNum(invoice.amountPaid) > 0) {
    doc.rect(tX, y, tW, 15).fill('#d8f3dc');
    doc.fillColor('#2d6a4f').font('Helvetica').fontSize(8)
       .text('Amount Paid', tX + 6, y + 3, { width: tW / 2 });
    doc.font('Helvetica-Bold')
       .text(money(invoice.amountPaid), tX + tW / 2, y + 3, { width: tW / 2 - 6, align: 'right' });
    y += 15;

    doc.rect(tX, y, tW, 15).fill('#fde8ea');
    doc.fillColor('#e63946').font('Helvetica').fontSize(8)
       .text('Balance Due', tX + 6, y + 3, { width: tW / 2 });
    doc.font('Helvetica-Bold')
       .text(money(invoice.balanceDue), tX + tW / 2, y + 3, { width: tW / 2 - 6, align: 'right' });
    y += 15;
  }

  // ─────────────────────────────────────────────────────────
  // AMOUNT IN WORDS
  // ─────────────────────────────────────────────────────────
  y = Math.max(y, gY) + 16;
  const amtWords = numberToWords(Math.round(safeNum(invoice.finalAmount)));
  doc.rect(L, y, W, 22).fill(LIGHT_BG).stroke(BORDER);
  doc.fillColor(TEXT_MID).font('Helvetica').fontSize(8)
     .text('Amount in Words:', L + 8, y + 7);
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(8)
     .text(`${amtWords} Only`, L + 90, y + 7, { width: W - 100 });
  y += 30;

  // ─────────────────────────────────────────────────────────
  // NOTES & TERMS
  // ─────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────

  // If not enough room for signature + footer on current page, add one
  const NEEDED = 90; // space needed for sig + footer
  if (y + NEEDED > PAGE_H - BOTTOM_MARGIN) {
    doc.addPage();
    if (invoice.paymentStatus === 'paid' || invoice.paymentStatus === 'partial') {
      addWatermark(doc, invoice.paymentStatus);
    }
    y = 50;
  }

  // Signature — placed at y (wherever content ended), NOT anchored to page bottom
  const sigY = y + 16;
  doc.font('Helvetica-Bold').fillColor(TEXT_DARK).fontSize(9)
     .text(business.businessName || '', R - 140, sigY, { width: 140, align: 'center', lineBreak: false });
  doc.moveTo(R - 140, sigY + 16).lineTo(R, sigY + 16).lineWidth(0.5).stroke(TEXT_LITE);
  doc.fillColor(TEXT_MID).font('Helvetica').fontSize(8)
     .text('Authorised Signatory', R - 140, sigY + 19, { width: 140, align: 'center', lineBreak: false });

  // Footer — fixed at very bottom of current page using absolute position
  const footY = PAGE_H - 40;
  doc.rect(L, footY - 8, W, 0.5).fill(BORDER);
  doc.fillColor(TEXT_LITE).font('Helvetica').fontSize(7.5)
     .text('Thank you for your business!', L, footY, { width: W / 2, lineBreak: false })
     .text('Generated by Vyaapar Business App', L + W / 2, footY, { width: W / 2, align: 'right', lineBreak: false });

  if (invoice.paymentStatus === 'paid' || invoice.paymentStatus === 'partial') {
    addWatermark(doc, invoice.paymentStatus);
  }

  doc.end();
};

// Internal helper to add watermark - called before doc.end()
const addWatermark = (doc, status) => {
  if (status === 'paid') {
    doc.save();
    doc.translate(doc.page.width / 2, doc.page.height / 2);
    doc.rotate(-45);
    doc.fontSize(120).fillColor('rgba(26,127,90,0.12)').font('Helvetica-Bold')
       .text('PAID', -150, -60, { width: 300, align: 'center', lineBreak: false });
    doc.restore();
  } else if (status === 'partial') {
    doc.save();
    doc.translate(doc.page.width / 2, doc.page.height / 2);
    doc.rotate(-45);
    doc.fontSize(90).fillColor('rgba(240,165,0,0.12)').font('Helvetica-Bold')
       .text('PARTIAL', -200, -45, { width: 400, align: 'center', lineBreak: false });
    doc.restore();
  }
};

// ─────────────────────────────────────────────────────────
// Helper: Number to Indian Words
// ─────────────────────────────────────────────────────────
function numberToWords(num) {
  if (num === 0) return 'Zero Rupees';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const toWords = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    return '';
  };

  let result = '';
  if (num >= 10000000) { result += toWords(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
  if (num >= 100000)   { result += toWords(Math.floor(num / 100000))   + ' Lakh ';  num %= 100000; }
  if (num >= 1000)     { result += toWords(Math.floor(num / 1000))     + ' Thousand '; num %= 1000; }
  if (num > 0)         { result += toWords(num); }

  return 'Rupees ' + result.trim();
}

const generateReceiptPDF = (invoice, business, res) => {
  const mmToPt = 2.83465;
  const W = 80 * mmToPt; // 80mm width
  const doc = new PDFDocument({ margins: { top: 10, left: 10, right: 10, bottom: 10 }, size: [W, 800], autoFirstPage: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Receipt-${invoice.invoiceNo}.pdf`);
  doc.pipe(res);

  const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));

  // Center alignment helper
  const cText = (text, opts = {}) => doc.text(text, { width: W - 20, align: 'center', ...opts });

  // Header
  doc.font('Helvetica-Bold').fontSize(14);
  cText(business.businessName || 'Store');
  doc.font('Helvetica').fontSize(10);
  if (business.address?.city) cText(`${business.address.city}, ${business.address.state || ''}`);
  if (business.phone) cText(`Ph: ${business.phone}`);
  if (business.GSTIN) cText(`GSTIN: ${business.GSTIN}`);
  
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(12);
  cText('TAX RECEIPT');
  doc.moveDown(0.5);

  doc.font('Helvetica').fontSize(10);
  doc.text(`Inv: ${invoice.invoiceNo}`, { align: 'left' });
  doc.text(`Date: ${new Date(invoice.invoiceDate).toLocaleString('en-IN')}`, { align: 'left' });
  if (invoice.customer?.name) doc.text(`Cust: ${invoice.customer.name}`, { align: 'left' });
  
  doc.moveDown(0.5);
  doc.text('-'.repeat(35), { align: 'center' });
  doc.moveDown(0.5);

  // Items
  doc.font('Helvetica-Bold');
  doc.text('Item', 10, doc.y, { width: (W - 20) * 0.4, continued: true });
  doc.text('Qty', { width: (W - 20) * 0.2, align: 'right', continued: true });
  doc.text('Total', { width: (W - 20) * 0.4, align: 'right' });
  doc.font('Helvetica');

  doc.text('-'.repeat(35), 10, doc.y, { align: 'center' });

  (invoice.items || []).forEach(item => {
    doc.text(item.name.substring(0, 15), 10, doc.y, { width: (W - 20) * 0.4, continued: true });
    doc.text(item.quantity.toString(), { width: (W - 20) * 0.2, align: 'right', continued: true });
    doc.text(safeNum(item.totalAmount).toFixed(2), { width: (W - 20) * 0.4, align: 'right' });
  });

  doc.moveDown(0.5);
  doc.text('-'.repeat(35), { align: 'center' });
  doc.moveDown(0.5);

  // Totals
  const tOpts = { align: 'right', width: W - 20 };
  doc.text(`Subtotal: ${safeNum(invoice.subtotal).toFixed(2)}`, tOpts);
  if (invoice.totalDiscount > 0) doc.text(`Discount: -${safeNum(invoice.totalDiscount).toFixed(2)}`, tOpts);
  if (invoice.totalGST > 0) doc.text(`Tax: ${safeNum(invoice.totalGST).toFixed(2)}`, tOpts);
  
  doc.font('Helvetica-Bold').fontSize(12);
  doc.moveDown(0.5);
  doc.text(`TOTAL: Rs.${safeNum(invoice.finalAmount).toFixed(2)}`, tOpts);
  
  doc.font('Helvetica').fontSize(10);
  doc.moveDown(1);
  cText('Thank you for your business!');
  cText('Please visit again.');

  doc.end();
};

module.exports = { generateInvoicePDF, generateReceiptPDF };
