import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Brand colors
const C = {
  akan:    [175, 68, 8],
  akanDk:  [140, 54, 6],
  cream:   [255, 249, 235],
  ltGray:  [200, 200, 200],
  darkGray:[70, 70, 70],
};

/**
 * Generate a one-page LANDSCAPE A4 PDF for a pre-tasting form.
 * Pre-fills header + menu items. Rating/comments columns are blank for
 * the team to fill by hand (or pre-filled if data is passed).
 *
 * @param {object} opts
 * @param {object} opts.fp             F&P record (used for header + menu items)
 * @param {object} [opts.preTasting]   Optional pre-tasting record to pre-fill ratings
 */
export function generatePreTastingPdf({ fp, preTasting = null }) {
  const doc = new jsPDF('l', 'mm', 'a4'); // landscape
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const M = 8;
  const CW = W - M * 2;
  let y = M;

  // ---- Header band ----
  doc.setFillColor(...C.akan);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('AKAN — PRE-TASTING FORM', M, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Pre-event food review to be compared against post-party feedback', M, 15.5);
  doc.setFontSize(8);
  doc.text(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), W - M, 11, { align: 'right' });
  doc.setTextColor(...C.darkGray);
  y = 22;

  // ---- Party header info block ----
  doc.setFillColor(...C.cream);
  doc.rect(M, y, CW, 18, 'F');
  doc.setDrawColor(...C.ltGray);
  doc.rect(M, y, CW, 18, 'S');

  const fields = [
    { label: 'F&P ID',     val: fp?.fpId || '-' },
    { label: 'Host',       val: fp?.contactPerson || fp?.guestName || '-' },
    { label: 'Phone',      val: fp?.phone || '-' },
    { label: 'Company',    val: fp?.company || '-' },
    { label: 'Event Date', val: fp?.dateOfEvent || '-' },
    { label: 'Package',    val: fp?.packageType || '-' },
    { label: 'Pax',        val: fp?.paxExpected || '-' },
    { label: 'Reviewer',   val: preTasting?.reviewerName || '__________________' },
  ];
  const colW = CW / 4;
  fields.forEach((f, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const fx = M + col * colW + 2;
    const fy = y + 5 + row * 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(f.label.toUpperCase(), fx, fy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(String(f.val).substring(0, 32), fx, fy + 3.5);
  });
  y += 20;

  // ---- Extract menu items from F&P ----
  const parse = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };
  let otherItems = fp?.otherItems || {};
  if (typeof otherItems === 'string') {
    try { otherItems = JSON.parse(otherItems); } catch { otherItems = {}; }
  }
  const getOther = (key) => {
    const raw = otherItems[key] && otherItems[key].trim();
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  };

  const starters = [
    ...parse(fp?.vegStarters),     ...getOther('vegStarters'),
    ...parse(fp?.nonVegStarters),  ...getOther('nonVegStarters'),
  ];
  const main = [
    ...parse(fp?.vegMainCourse),     ...getOther('vegMainCourse'),
    ...parse(fp?.nonVegMainCourse),  ...getOther('nonVegMainCourse'),
  ];
  const sides = [
    ...parse(fp?.rice), ...getOther('rice'),
    ...parse(fp?.dal),  ...getOther('dal'),
    ...parse(fp?.salad), ...getOther('salad'),
    ...parse(fp?.accompaniments), ...getOther('accompaniments'),
  ];
  const desserts = [...parse(fp?.desserts), ...getOther('desserts')];
  const addons = [
    ...parse(fp?.addonMuttonStarters),
    ...parse(fp?.addonMuttonMainCourse),
    ...parse(fp?.addonPrawnsStarters),
    ...parse(fp?.addonPrawnsMainCourse),
    ...parse(fp?.addonExtras),
  ];

  // Helper: merge in ratings from preTasting data if provided
  const ratingsMap = (key) => {
    if (!preTasting) return {};
    const arr = preTasting[key] || [];
    const parsed = Array.isArray(arr) ? arr : (() => { try { return JSON.parse(arr); } catch { return []; } })();
    const m = {};
    parsed.forEach((r) => { m[r.item] = r; });
    return m;
  };
  const starterMap = ratingsMap('startersItemRatings');
  const mainMap = ratingsMap('mainCourseItemRatings');
  const sidesMap = ratingsMap('sidesItemRatings');
  const dessertMap = ratingsMap('dessertItemRatings');
  const addonMap = ratingsMap('addonItemRatings');

  const rowFor = (item, map) => {
    const r = map[item];
    return [item, r ? `${r.rating || ''}/5` : '   / 5', r ? (r.comment || '') : ''];
  };

  // ---- Build two-column menu layout ----
  // Left column: Starters + Main Course
  // Right column: Sides + Desserts + Add-ons
  const leftData = [];
  if (starters.length) {
    leftData.push([{ content: 'STARTERS', colSpan: 3, styles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
    starters.forEach((it) => leftData.push(rowFor(it, starterMap)));
  }
  if (main.length) {
    leftData.push([{ content: 'MAIN COURSE', colSpan: 3, styles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
    main.forEach((it) => leftData.push(rowFor(it, mainMap)));
  }

  const rightData = [];
  if (sides.length) {
    rightData.push([{ content: 'SIDES & ACCOMPANIMENTS', colSpan: 3, styles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
    sides.forEach((it) => rightData.push(rowFor(it, sidesMap)));
  }
  if (desserts.length) {
    rightData.push([{ content: 'DESSERTS', colSpan: 3, styles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
    desserts.forEach((it) => rightData.push(rowFor(it, dessertMap)));
  }
  if (addons.length) {
    rightData.push([{ content: 'ADD-ONS', colSpan: 3, styles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', halign: 'left' } }]);
    addons.forEach((it) => rightData.push(rowFor(it, addonMap)));
  }

  const tableY = y;
  const halfW = (CW - 4) / 2;

  const tableOpts = {
    startY: tableY,
    head: [['Item', 'Rating', 'Comments / Change']],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: [30, 30, 30] },
    headStyles: { fillColor: C.akanDk, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: halfW * 0.45 },
      1: { cellWidth: halfW * 0.15, halign: 'center' },
      2: { cellWidth: halfW * 0.40 },
    },
  };

  autoTable(doc, { ...tableOpts, margin: { left: M }, tableWidth: halfW, body: leftData });
  autoTable(doc, { ...tableOpts, margin: { left: M + halfW + 4 }, tableWidth: halfW, body: rightData });

  // ---- Footer boxes (Overall + Items to Change + Complaint/Suggestion) ----
  const lastY = Math.max(doc.lastAutoTable.finalY, tableY + 50);
  let footerY = Math.min(lastY + 3, H - 40);

  // Overall band
  doc.setFillColor(...C.cream);
  doc.setDrawColor(...C.ltGray);
  doc.rect(M, footerY, CW, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.akanDk);
  const overall = preTasting?.overallRating ? `${preTasting.overallRating}/5` : '   / 5';
  const foodQ = preTasting?.foodQualityRating ? `${preTasting.foodQualityRating}/5` : '   / 5';
  doc.text(`OVERALL RATING:  ${overall}`, M + 3, footerY + 5.5);
  doc.text(`FOOD QUALITY:  ${foodQ}`, M + 90, footerY + 5.5);
  if (fp?.packageType && !fp.packageType.includes('Food Only')) {
    const bev = preTasting?.beveragesRating ? `${preTasting.beveragesRating}/5` : '   / 5';
    doc.text(`BEVERAGES:  ${bev}`, M + 170, footerY + 5.5);
  }
  footerY += 9;

  // Items to Change / Complaint / Suggestion — three boxes
  const boxW = (CW - 4) / 3;
  const boxH = H - footerY - M;
  const boxes = [
    { label: 'ITEMS TO CHANGE / REPLACE', val: preTasting?.itemsToChange || '' },
    { label: 'COMPLAINT',                val: preTasting?.complaint || '' },
    { label: 'SUGGESTION',               val: preTasting?.suggestion || '' },
  ];
  boxes.forEach((b, i) => {
    const bx = M + i * (boxW + 2);
    doc.setDrawColor(...C.ltGray);
    doc.rect(bx, footerY, boxW, boxH, 'S');
    doc.setFillColor(245, 245, 245);
    doc.rect(bx, footerY, boxW, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(b.label, bx + 2, footerY + 3.5);
    if (b.val) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(b.val, boxW - 4);
      doc.text(lines, bx + 2, footerY + 9);
    }
  });

  // Footer credit
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Reviewed by: _________________   |   Signature: _________________   |   AKAN Party Manager`,
    M,
    H - 2,
  );

  // ---- Save ----
  const ptId = preTasting?.preTastingId || 'PT';
  const name = (fp?.contactPerson || fp?.guestName || 'party').replace(/[^a-z0-9]/gi, '_');
  const filename = `Pre-Tasting_${ptId}_${name}.pdf`;
  doc.save(filename);
}
