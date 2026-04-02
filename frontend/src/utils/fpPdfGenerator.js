import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PACKAGES, ADDONS, DISCLAIMERS, FULL_MENU, MENU_CATEGORIES } from '../data/menuTemplates';
import { AKAN_LOGO_BASE64 } from '../assets/akanLogoBase64';

// Brand colors
const C = {
  akan:    [175, 68, 8],
  akanDk:  [140, 54, 6],
  gold:    [255, 235, 180],
  cream:   [255, 249, 235],
  orange:  [255, 240, 225],
  white:   [255, 255, 255],
  gray:    [100, 100, 100],
  ltGray:  [180, 180, 180],
};

/**
 * Generate a SINGLE-PAGE A4 PDF for an F&P record.
 * Dynamically sizes content to fit one page.
 * Preset Menu uses write-in text instead of checkbox items.
 * Drinks start/end times shown without underlines.
 */
export function generateFpPdf(data) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();   // 210
  const H = doc.internal.pageSize.getHeight();   // 297
  const isPreset = data.packageType === 'Preset Menu';
  const pkg = isPreset ? null : (data.selectedPkg || PACKAGES[data.packageType] || null);
  const M = 8;
  const CW = W - M * 2;
  let y = 0;

  // ===== Count sections to calculate dynamic spacing =====
  const pmt = data.presetMenuText || {};
  const hasPresetText = isPreset && Object.values(pmt).some((v) => v && v.trim());

  const pairedMenu = [
    { left: 'vegStarters', leftLabel: 'Veg Starters', right: 'nonVegStarters', rightLabel: 'Non-Veg Starters' },
    { left: 'vegMainCourse', leftLabel: 'Veg Main Course', right: 'nonVegMainCourse', rightLabel: 'Non-Veg Main Course' },
  ];
  const singleMenu = [
    { key: 'rice', label: 'Rice' },
    { key: 'dal', label: 'Dal' },
    { key: 'salad', label: 'Salad' },
    { key: 'desserts', label: 'Desserts' },
    { key: 'accompaniments', label: 'Accompaniments' },
  ];

  const hasRegularMenu = !isPreset && [...pairedMenu.flatMap((p) => [p.left, p.right]), ...singleMenu.map((s) => s.key)]
    .some((k) => data[k] && data[k].length > 0);

  const addonParts = buildAddonParts(data);
  const hasDrinks = !!(pkg || isPreset);
  const entItems = buildEntItems(data);
  const tcItems = data.customTc || DISCLAIMERS;

  // Count total menu rows for sizing
  let totalMenuRows = 0;
  if (hasRegularMenu) {
    for (const pair of pairedMenu) {
      const l = (data[pair.left] || []).length;
      const r = (data[pair.right] || []).length;
      if (l + r > 0) totalMenuRows += Math.max(l, r);
    }
    const singleEntries = singleMenu.filter(({ key }) => data[key] && data[key].length > 0);
    for (let i = 0; i < singleEntries.length; i += 2) {
      const l = data[singleEntries[i].key].length;
      const r = singleEntries[i + 1] ? data[singleEntries[i + 1].key].length : 0;
      totalMenuRows += Math.max(l, r);
    }
  }
  if (hasPresetText) {
    const presetPairs = [
      ['vegStarters', 'nonVegStarters'],
      ['vegMainCourse', 'nonVegMainCourse'],
      ['rice', 'dal'],
      ['salad', 'desserts'],
      ['accompaniments', null],
    ];
    for (const [l, r] of presetPairs) {
      const lLines = (pmt[l] || '').split('\n').filter(Boolean).length;
      const rLines = r ? (pmt[r] || '').split('\n').filter(Boolean).length : 0;
      if (lLines + rLines > 0) totalMenuRows += Math.max(lLines, rLines);
    }
  }

  // Dynamic sizing: compact if lots of content
  const contentDensity = totalMenuRows + addonParts.length + (hasDrinks ? 3 : 0) + entItems.length + tcItems.length;
  const isCompact = contentDensity > 25;
  const cp = isCompact ? 1.5 : 2;       // cell padding
  const fs = isCompact ? 6.5 : 7;       // body font size
  const fsH = isCompact ? 7 : 7.5;      // header font size
  const gap = isCompact ? 1.5 : 2.5;    // gap between sections
  const signH = isCompact ? 10 : 14;    // sign-off box height
  const tcFs = isCompact ? 5.5 : 6;     // T&C font size
  const tcLh = isCompact ? 2.5 : 3;     // T&C line height

  // ===== WATERMARK =====
  try {
    const logoW = 130, logoH = 130;
    const gState = new doc.GState({ opacity: 0.06 });
    doc.saveGraphicsState();
    doc.setGState(gState);
    doc.addImage(AKAN_LOGO_BASE64, 'PNG', (W - logoW) / 2, (H - logoH) / 2 - 10, logoW, logoH);
    doc.restoreGraphicsState();
  } catch (e) {
    doc.setTextColor(245, 230, 215);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(90);
    doc.text('AKAN', W / 2, H / 2, { align: 'center', baseline: 'middle', angle: 45 });
  }
  doc.setTextColor(0, 0, 0);

  // ===== HEADER (14mm) =====
  doc.setFillColor(...C.akan);
  doc.rect(0, 0, W, 14, 'F');
  doc.setFillColor(...C.gold);
  doc.rect(0, 14, W, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('AKAN', M + 1, 8);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(isPreset ? 'Preset Menu' : 'Function & Prospectus', M + 1, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  if (data.fpId) doc.text(data.fpId, W - M, 7, { align: 'right' });
  doc.setFontSize(7);
  if (data.status) doc.text(`Status: ${data.status}`, W - M, 12, { align: 'right' });

  y = 17;
  doc.setTextColor(0, 0, 0);

  // ===== BOOKING & GUEST DETAILS =====
  const pkgDisplay = isPreset ? 'Preset Menu' : (pkg ? pkg.label : (data.packageType || '-'));
  // Build food preference string
  const foodPrefs = [];
  if (data.spiceLevel && data.showSpiceLevels) foodPrefs.push(`Spice: ${data.spiceLevel}`);
  if (data.jainFood) foodPrefs.push(`Jain: ${data.jainFoodPax || '?'} pax`);
  if (data.veganFood) foodPrefs.push(`Vegan: ${data.veganFoodPax || '?'} pax`);
  const foodPrefStr = foodPrefs.length > 0 ? foodPrefs.join(' | ') : '';

  // Min Guarantee: use least pax from paxExpected or minimumGuarantee
  const minGuarVal = data.minimumGuarantee || parseLeastPax(data.paxExpected) || '';

  const detailRows = [
    ['Booking', formatDateIN(data.dateOfBooking), 'Event Date', formatDateIN(data.dateOfEvent), 'Day', d(data.dayOfEvent)],
    ['Time', d(data.timeOfEvent), 'Area', d(data.allocatedArea), 'Min Guar.', d(minGuarVal)],
    ['Guest', d(data.contactPerson), 'Phone', d(data.phone), 'Company', d(data.company)],
    ['Package', d(pkgDisplay), 'Reference', d(data.reference), 'Payment', d(data.modeOfPayment)],
    ['Rate/Head', d(data.ratePerHead ? `Rs.${data.ratePerHead}` : ''), 'Advance', d(data.advancePayment ? `Rs.${data.advancePayment}` : ''), 'Est. Bill', d(data.approxBillAmount ? `Rs.${Number(data.approxBillAmount).toLocaleString('en-IN')}` : '')],
    ['Food Pref', d(foodPrefStr), '', '', '', ''],
  ];

  autoTable(doc, {
    startY: y,
    head: [['BOOKING & GUEST DETAILS', '', '', '', '', '']],
    body: detailRows,
    theme: 'grid',
    headStyles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', fontSize: fsH, cellPadding: 1.5, halign: 'center' },
    bodyStyles: { fontSize: fs, cellPadding: cp, textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20, fillColor: C.gold, fontSize: fs - 0.5, valign: 'middle', halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: CW / 3 - 20 },
      2: { fontStyle: 'bold', cellWidth: 20, fillColor: C.gold, fontSize: fs - 0.5, valign: 'middle', halign: 'center' },
      3: { fontStyle: 'bold', cellWidth: CW / 3 - 20 },
      4: { fontStyle: 'bold', cellWidth: 20, fillColor: C.gold, fontSize: fs - 0.5, valign: 'middle', halign: 'center' },
      5: { fontStyle: 'bold', cellWidth: CW / 3 - 20 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && hookData.column.index === 0) {
        hookData.cell.colSpan = 6;
      }
      if (hookData.section === 'body' && (hookData.column.index % 2 === 0)) {
        hookData.cell.styles.textColor = [80, 50, 20];
        hookData.cell.styles.fontSize = fs - 0.5;
        hookData.cell.styles.valign = 'middle';
        hookData.cell.styles.halign = 'center';
      }
      if (hookData.section === 'body' && (hookData.column.index % 2 === 1)) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = fs;
        hookData.cell.styles.textColor = [10, 10, 10];
      }
    },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + gap;

  // ===== MENU SECTION =====
  if (hasRegularMenu || hasPresetText) {
    autoTable(doc, {
      startY: y,
      head: [[isPreset ? 'PRESET MENU' : 'MENU SELECTION', '']],
      body: [],
      theme: 'grid',
      headStyles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', fontSize: fsH, cellPadding: 1.5, halign: 'center' },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 0) hookData.cell.colSpan = 2;
      },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY;
    const halfW = CW / 2;

    // Parse other items for inline use within categories
    let otherItemsObj = data.otherItems || {};
    if (typeof otherItemsObj === 'string') {
      try { otherItemsObj = JSON.parse(otherItemsObj); } catch { otherItemsObj = {}; }
    }

    // Helper: count other items for a category
    const getOtherCount = (catKey) => {
      const raw = otherItemsObj[catKey] && otherItemsObj[catKey].trim();
      if (!raw) return 0;
      return raw.split(',').map((s) => s.trim()).filter(Boolean).length;
    };

    // Helper: get other items array for a category
    const getOtherItems = (catKey) => {
      const raw = otherItemsObj[catKey] && otherItemsObj[catKey].trim();
      if (!raw) return [];
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    };

    // Helper: combine preset items + other items into a single numbered list
    const getCombinedItems = (catKey) => {
      const preset = data[catKey] || [];
      const others = getOtherItems(catKey);
      const combined = [];
      preset.forEach((item, i) => combined.push(`  ${i + 1}. ${item}`));
      others.forEach((item, i) => combined.push(`  ${preset.length + i + 1}. ${item} *`));
      return combined;
    };

    const menuColStyles = {
      0: { fontStyle: 'bold', cellWidth: 26, fillColor: C.gold, fontSize: fs - 0.5, textColor: [80, 50, 20] },
      1: { fontStyle: 'bold', cellWidth: halfW - 26, fillColor: C.cream },
      2: { fontStyle: 'bold', cellWidth: 26, fillColor: C.gold, fontSize: fs - 0.5, textColor: [80, 50, 20] },
      3: { fontStyle: 'bold', cellWidth: halfW - 26, fillColor: C.cream },
    };

    if (hasPresetText) {
      // Preset Menu — write-in text, paired side by side
      const presetPairs = [
        { left: 'vegStarters', leftLabel: 'Veg Starters', right: 'nonVegStarters', rightLabel: 'Non-Veg Starters' },
        { left: 'vegMainCourse', leftLabel: 'Veg Main Course', right: 'nonVegMainCourse', rightLabel: 'Non-Veg Main Course' },
        { left: 'rice', leftLabel: 'Rice', right: 'dal', rightLabel: 'Dal' },
        { left: 'salad', leftLabel: 'Salad', right: 'desserts', rightLabel: 'Desserts' },
        { left: 'accompaniments', leftLabel: 'Accompaniments', right: null, rightLabel: '' },
      ];

      for (const pair of presetPairs) {
        const leftLines = (pmt[pair.left] || '').split('\n').filter(Boolean);
        const rightLines = pair.right ? (pmt[pair.right] || '').split('\n').filter(Boolean) : [];
        // Merge other items into preset lines
        const leftOthers = getOtherItems(pair.left);
        const rightOthers = pair.right ? getOtherItems(pair.right) : [];
        const leftAll = [...leftLines.map((l, i) => `  ${i + 1}. ${l}`), ...leftOthers.map((o, i) => `  ${leftLines.length + i + 1}. ${o} *`)];
        const rightAll = [...rightLines.map((l, i) => `  ${i + 1}. ${l}`), ...rightOthers.map((o, i) => `  ${rightLines.length + i + 1}. ${o} *`)];
        if (leftAll.length === 0 && rightAll.length === 0) continue;
        const maxRows = Math.max(leftAll.length, rightAll.length, 1);
        const body = [];
        for (let i = 0; i < maxRows; i++) {
          body.push([
            i === 0 ? pair.leftLabel : '',
            leftAll[i] || '',
            i === 0 ? (pair.rightLabel || '') : '',
            rightAll[i] || '',
          ]);
        }
        autoTable(doc, {
          startY: y, body, theme: 'grid',
          bodyStyles: { fontSize: fs, cellPadding: cp, textColor: [10, 10, 10] },
          columnStyles: menuColStyles,
          margin: { left: M, right: M },
        });
        y = doc.lastAutoTable.finalY;
      }
    } else if (hasRegularMenu) {
      // Package menu — checkbox items + other items combined, paired Veg/Non-Veg
      for (const pair of pairedMenu) {
        const leftCombined = getCombinedItems(pair.left);
        const rightCombined = getCombinedItems(pair.right);
        if (leftCombined.length === 0 && rightCombined.length === 0) continue;
        const leftLim = pkg?.limits[pair.left] ?? '-';
        const rightLim = pkg?.limits[pair.right] ?? '-';
        const maxRows = Math.max(leftCombined.length, rightCombined.length, 1);
        const body = [];
        for (let i = 0; i < maxRows; i++) {
          body.push([
            i === 0 ? `${pair.leftLabel} (${leftCombined.length}/${leftLim})` : '',
            leftCombined[i] || '',
            i === 0 ? `${pair.rightLabel} (${rightCombined.length}/${rightLim})` : '',
            rightCombined[i] || '',
          ]);
        }
        autoTable(doc, {
          startY: y, body, theme: 'grid',
          bodyStyles: { fontSize: fs, cellPadding: cp, textColor: [10, 10, 10] },
          columnStyles: menuColStyles,
          margin: { left: M, right: M },
        });
        y = doc.lastAutoTable.finalY;
      }

      const singleEntries = singleMenu
        .filter(({ key }) => getCombinedItems(key).length > 0)
        .map(({ key, label }) => {
          const combined = getCombinedItems(key);
          const lim = pkg?.limits[key] ?? '-';
          return { key, label: `${label} (${combined.length}/${lim})`, items: combined };
        });

      for (let i = 0; i < singleEntries.length; i += 2) {
        const left = singleEntries[i];
        const right = singleEntries[i + 1];
        const maxRows = Math.max(left.items.length, right?.items.length || 0, 1);
        const body = [];
        for (let r = 0; r < maxRows; r++) {
          body.push([
            r === 0 ? left.label : '',
            left.items[r] || '',
            r === 0 ? (right?.label || '') : '',
            right?.items[r] || '',
          ]);
        }
        autoTable(doc, {
          startY: y, body, theme: 'grid',
          bodyStyles: { fontSize: fs, cellPadding: cp, textColor: [10, 10, 10] },
          columnStyles: menuColStyles,
          margin: { left: M, right: M },
        });
        y = doc.lastAutoTable.finalY;
      }
    }
    y += gap;
  }

  // ===== OTHER ITEM (Outside Menu) — only _general =====
  let otherItemsObj = data.otherItems || {};
  if (typeof otherItemsObj === 'string') {
    try { otherItemsObj = JSON.parse(otherItemsObj); } catch { otherItemsObj = {}; }
  }
  if (otherItemsObj._general && otherItemsObj._general.trim()) {
    const generalItems = otherItemsObj._general.split(',').map((s) => s.trim()).filter(Boolean);
    const generalBody = generalItems.map((item, i) => [i === 0 ? 'Guest Request' : '', `  ${i + 1}. ${item}`]);
    if (generalBody.length === 0) generalBody.push(['Guest Request', otherItemsObj._general.trim()]);
    autoTable(doc, {
      startY: y,
      head: [['OTHER ITEM (Outside Menu)', '']],
      body: generalBody,
      theme: 'grid',
      headStyles: { fillColor: [180, 130, 50], textColor: 255, fontStyle: 'bold', fontSize: fsH, cellPadding: 1.5, halign: 'center' },
      bodyStyles: { fontSize: fs, cellPadding: cp, fillColor: [255, 250, 235], fontStyle: 'bold', textColor: [10, 10, 10] },
      columnStyles: {
        0: { cellWidth: 42, textColor: [120, 100, 60] },
        1: { fillColor: [255, 250, 235] },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 0) hookData.cell.colSpan = 2;
      },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + gap;
  }

  // ===== ADDONS =====
  if (addonParts.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['ADDONS (Extra Charges)']],
      body: addonParts.map((p) => [p]),
      theme: 'grid',
      headStyles: { fillColor: [210, 100, 30], textColor: 255, fontStyle: 'bold', fontSize: fsH, cellPadding: 1.5, halign: 'center' },
      bodyStyles: { fontSize: fs, cellPadding: cp, fillColor: C.orange, fontStyle: 'bold', textColor: [10, 10, 10] },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + gap;
  }

  // ===== DRINKS — Full width, bar times beside Includes/Serving =====
  if (hasDrinks) {
    const dRows = [];
    if (pkg && pkg.drinks.length > 0) dRows.push(['Brands', pkg.drinks.join(',  '), '', '']);
    if (pkg) {
      const extras2 = [pkg.cocktails, pkg.mocktails, pkg.softDrinks].filter(Boolean).join('  |  ');
      if (extras2) dRows.push(['Includes', extras2, 'Bar Start', data.drinksStartTime || '']);
      dRows.push(['Serving', pkg.serving, 'Bar End', data.drinksEndTime || '']);
    }
    if (data.barNotes) dRows.push(['Notes', data.barNotes, '', '']);

    const drinkLabelW = 22;
    const timeLabW = 18;
    const timeValW = 22;
    const mainValW = CW - drinkLabelW - timeLabW - timeValW;

    autoTable(doc, {
      startY: y,
      head: [['DRINKS & BAR   |   ALCOHOLIC { Pouring will be 30ml }   |   NOTE: DRINKS WILL BE SERVED AS PER AVAILABILITY', '', '', '']],
      body: dRows,
      theme: 'grid',
      headStyles: { fillColor: [120, 60, 120], textColor: 255, fontStyle: 'bold', fontSize: fsH - 0.5, cellPadding: 1.5, halign: 'center' },
      bodyStyles: { fontSize: fs + 0.5, cellPadding: cp, overflow: 'linebreak', fontStyle: 'bold', textColor: [10, 10, 10] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: drinkLabelW, fillColor: [240, 230, 245], textColor: [80, 40, 80], fontSize: fs },
        1: { fillColor: C.cream, cellWidth: mainValW },
        2: { fontStyle: 'bold', cellWidth: timeLabW, fillColor: [240, 230, 245], textColor: [80, 40, 80], fontSize: fs },
        3: { fillColor: C.cream, cellWidth: timeValW, fontStyle: 'bold' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 0) hookData.cell.colSpan = 4;
      },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + gap;
  }

  // ===== ENTERTAINMENT =====
  if (entItems.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['ENTERTAINMENT & ARRANGEMENTS', '']],
      body: entItems,
      theme: 'grid',
      headStyles: { fillColor: [80, 120, 160], textColor: 255, fontStyle: 'bold', fontSize: fsH, cellPadding: 1.5, halign: 'center' },
      bodyStyles: { fontSize: fs, cellPadding: cp, fontStyle: 'bold', textColor: [10, 10, 10] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 22, fillColor: [225, 235, 245], textColor: [40, 60, 100] },
        1: { fillColor: C.cream },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'head' && hookData.column.index === 0) hookData.cell.colSpan = 2;
      },
      margin: { left: M, right: M },
    });
    y = doc.lastAutoTable.finalY + gap;
  }

  // ===== SIGN-OFF =====
  autoTable(doc, {
    startY: y,
    head: [['SIGN-OFF & DISTRIBUTION', '', '', '', '', '']],
    body: [
      ['F&P By', data.fpMadeBy || '', 'Manager', data.managerName || '', 'Guest', data.contactPerson || ''],
      ['Kitchen', data.kitchenDept || '', 'Service', data.serviceDept || '', 'Bar', data.barDept || ''],
      ['Stores', data.storesDept || '', 'Maint.', data.maintenance || '', 'Front Off.', data.frontOffice || ''],
    ],
    theme: 'grid',
    headStyles: { fillColor: C.akan, textColor: 255, fontStyle: 'bold', fontSize: fsH, cellPadding: 1.5, halign: 'center' },
    bodyStyles: { fontSize: fs, cellPadding: { top: 2, bottom: signH - 6, left: 2, right: 2 }, fontStyle: 'bold', textColor: [10, 10, 10], minCellHeight: signH },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20, fillColor: C.gold, textColor: [80, 50, 20] },
      1: { cellWidth: CW / 3 - 20 },
      2: { fontStyle: 'bold', cellWidth: 20, fillColor: C.gold, textColor: [80, 50, 20] },
      3: { cellWidth: CW / 3 - 20 },
      4: { fontStyle: 'bold', cellWidth: 20, fillColor: C.gold, textColor: [80, 50, 20] },
      5: { cellWidth: CW / 3 - 20 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && hookData.column.index === 0) hookData.cell.colSpan = 6;
    },
    margin: { left: M, right: M },
  });
  y = doc.lastAutoTable.finalY + gap;

  // ===== TERMS & CONDITIONS =====
  // Calculate remaining space and adjust T&C to fit
  const footerSpace = 8;
  const remainingY = H - y - footerSpace;
  const tcHeaderH = 3.5;

  doc.setFontSize(tcFs + 1);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMS & CONDITIONS', M, y);
  y += tcHeaderH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(tcFs);
  doc.setTextColor(50, 50, 50);

  // Calculate if all T&C fits; if not, use even smaller font
  let actualTcFs = tcFs;
  let actualTcLh = tcLh;
  let totalTcHeight = 0;
  tcItems.forEach((tc) => {
    const lines = doc.splitTextToSize(`${tcItems.indexOf(tc) + 1}. ${tc}`, CW);
    totalTcHeight += lines.length * actualTcLh;
  });

  if (totalTcHeight > remainingY - tcHeaderH) {
    actualTcFs = Math.max(4.5, tcFs - 1);
    actualTcLh = Math.max(2, tcLh - 0.5);
    doc.setFontSize(actualTcFs);
  }

  tcItems.forEach((tc, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${tc}`, CW);
    if (y + lines.length * actualTcLh < H - footerSpace) {
      doc.text(lines, M, y);
      y += lines.length * actualTcLh;
    }
  });

  // ===== FOOTER =====
  doc.setDrawColor(...C.akan);
  doc.setLineWidth(0.4);
  doc.line(M, H - 7, W - M, H - 7);
  doc.setFontSize(5.5);
  doc.setTextColor(...C.gray);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(`Generated: ${dateStr}`, W - M, H - 4, { align: 'right' });

  // ===== Save =====
  const filename = `FP_${data.fpId || 'draft'}_${(data.contactPerson || 'guest').replace(/\s+/g, '_')}.pdf`;
  doc.save(filename.replace(/[^a-zA-Z0-9_.-]/g, '_'));
}

// ---- Helpers ----
function d(val) {
  return val || '-';
}

// Format date from YYYY-MM-DD or any parseable format to DD-MM-YYYY (Indian format)
function formatDateIN(val) {
  if (!val) return '-';
  const str = String(val).trim();
  // Already DD-MM-YYYY?
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) return str;
  // YYYY-MM-DD
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  // Try Date parse
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = dt.getFullYear();
    return `${dd}-${mm}-${yy}`;
  }
  return str || '-';
}

// Parse least pax from a range like "100-150" → 100, or plain "80" → 80
function parseLeastPax(val) {
  if (!val) return '';
  const str = String(val).trim();
  const parts = str.split(/[-–\/]/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  if (parts.length > 0) return String(Math.min(...parts));
  return str;
}

function buildAddonParts(data) {
  const parts = [];
  const mSt = data.addonMuttonStarters || [];
  const mMc = data.addonMuttonMainCourse || [];
  if (mSt.length + mMc.length > 0) {
    parts.push(`Mutton (Rs.${ADDONS.mutton.pricePerHead}/pp): ${[...mSt, ...mMc].join(', ')}`);
  }
  const pSt = data.addonPrawnsStarters || [];
  const pMc = data.addonPrawnsMainCourse || [];
  if (pSt.length + pMc.length > 0) {
    parts.push(`Prawns (Rs.${ADDONS.prawns.pricePerHead}/pp): ${[...pSt, ...pMc].join(', ')}`);
  }
  const ext = data.addonExtras || [];
  if (ext.length > 0) {
    const extStr = ext.map((e) => {
      const f = ADDONS.extras.items.find((i) => i.name === e);
      return f ? `${e} (Rs.${f.price})` : e;
    }).join(', ');
    parts.push(`Extras: ${extStr}`);
  }
  return parts;
}

function buildEntItems(data) {
  const items = [];
  if (data.dj) items.push(['DJ', data.dj]);
  if (data.mc) items.push(['MC', data.mc]);
  if (data.mics) items.push(['Mics', data.mics]);
  if (data.decor) items.push(['Decor', data.decor]);
  if (data.seatingArrangements) items.push(['Seating', data.seatingArrangements]);
  return items;
}
