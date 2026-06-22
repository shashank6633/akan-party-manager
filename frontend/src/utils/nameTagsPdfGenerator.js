import jsPDF from 'jspdf';
import { FULL_MENU } from '../data/menuTemplates';

// AKAN brand palette
const C = {
  bgR: 174, bgG: 68, bgB: 8,           // burnt-orange terracotta  #AE4408
  textR: 255, textG: 231, textB: 204,  // cream                    #FFE7CC
  vegGreen: [34, 139, 34],             // FSSAI veg indicator
  nonVegRed: [178, 34, 34],            // FSSAI non-veg indicator
};

// Display labels for each menu category (top-level field name → human label).
// `nonVeg` is true when the dietary indicator should be the red triangle.
const CATEGORY_META = {
  vegStarters:           { label: 'VEG STARTER',          nonVeg: false },
  nonVegStarters:        { label: 'NON-VEG STARTER',      nonVeg: true },
  vegMainCourse:         { label: 'VEG MAIN COURSE',      nonVeg: false },
  nonVegMainCourse:      { label: 'NON-VEG MAIN COURSE',  nonVeg: true },
  rice:                  { label: 'RICE',                 nonVeg: false },
  dal:                   { label: 'DAL',                  nonVeg: false },
  salad:                 { label: 'SALAD',                nonVeg: false },
  accompaniments:        { label: 'ACCOMPANIMENT',        nonVeg: false },
  desserts:              { label: 'DESSERT',              nonVeg: false },
  addonVegStarters:      { label: 'VEG STARTER (ADD-ON)', nonVeg: false },
  addonVegMainCourse:    { label: 'VEG MAIN (ADD-ON)',    nonVeg: false },
  addonMuttonStarters:   { label: 'MUTTON STARTER',       nonVeg: true },
  addonMuttonMainCourse: { label: 'MUTTON MAIN',          nonVeg: true },
  addonPrawnsStarters:   { label: 'PRAWNS STARTER',       nonVeg: true },
  addonPrawnsMainCourse: { label: 'PRAWNS MAIN',          nonVeg: true },
  addonLiveCounterVeg:   { label: 'LIVE COUNTER (VEG)',   nonVeg: false },
  addonLiveCounterNonVeg:{ label: 'LIVE COUNTER',         nonVeg: true },
};

// Order tags appear in: all veg groups first (clusters at buffet), then non-veg.
const CATEGORY_ORDER = [
  // Veg block
  'vegStarters',
  'vegMainCourse',
  'rice',
  'dal',
  'salad',
  'accompaniments',
  'desserts',
  'addonVegStarters',
  'addonVegMainCourse',
  'addonLiveCounterVeg',
  // Non-veg block
  'nonVegStarters',
  'nonVegMainCourse',
  'addonMuttonStarters',
  'addonMuttonMainCourse',
  'addonPrawnsStarters',
  'addonPrawnsMainCourse',
  'addonLiveCounterNonVeg',
];

// Parse a stored field that could be array or JSON-string or undefined
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

// Find the subcategory (Indian / Continental / Asian / etc.) the item is in,
// by looking it up in FULL_MENU. Returns null if not found (custom items).
function findSubcategory(categoryKey, itemName) {
  const cat = FULL_MENU[categoryKey];
  if (!cat || !cat.subcategories) return null;
  const lc = (itemName || '').toLowerCase().trim();
  for (const [subKey, items] of Object.entries(cat.subcategories)) {
    if (items.some((i) => i.toLowerCase().trim() === lc)) return subKey;
  }
  return null;
}

// Build the list of all tags to render from an F&P record.
// Returns [{ name, categoryLabel, nonVeg }]
function collectTags(fp) {
  const tags = [];
  CATEGORY_ORDER.forEach((catKey) => {
    const items = asArray(fp[catKey]);
    if (items.length === 0) return;
    const meta = CATEGORY_META[catKey] || { label: catKey.toUpperCase(), nonVeg: false };
    items.forEach((rawName) => {
      const name = (rawName || '').trim();
      if (!name) return;
      const sub = findSubcategory(catKey, name);
      const categoryLabel = sub ? `${meta.label} • ${sub.toUpperCase()}` : meta.label;
      tags.push({ name, categoryLabel, nonVeg: meta.nonVeg });
    });
  });
  return tags;
}

// Draw a single dietary indicator (FSSAI style) — green dot in square (veg)
// or red triangle in square (non-veg). x/y is top-left of the square.
function drawDietaryIcon(doc, x, y, sizeMm, nonVeg) {
  const color = nonVeg ? C.nonVegRed : C.vegGreen;
  doc.setDrawColor(...color);
  doc.setLineWidth(0.4);
  // White inner fill so the icon reads even on the terracotta background
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, sizeMm, sizeMm, 'FD');
  doc.setFillColor(...color);
  if (nonVeg) {
    // Equilateral-ish triangle pointing up
    const m = sizeMm * 0.18;
    doc.triangle(
      x + m, y + sizeMm - m,            // bottom-left
      x + sizeMm - m, y + sizeMm - m,   // bottom-right
      x + sizeMm / 2, y + m,            // top
      'F'
    );
  } else {
    // Filled circle in centre
    doc.circle(x + sizeMm / 2, y + sizeMm / 2, sizeMm * 0.28, 'F');
  }
}

// Pick a font size so `name` fits in width x height using a wrapping word-break.
// Returns { fontSize, lines }.
function fitText(doc, name, maxWidthMm, maxHeightMm, startPt = 22, minPt = 9) {
  for (let pt = startPt; pt >= minPt; pt -= 1) {
    doc.setFontSize(pt);
    const lines = doc.splitTextToSize(name, maxWidthMm);
    // Approximate line height in mm: pt * 0.352 (point→mm) * 1.15 (leading)
    const lineHeight = pt * 0.352 * 1.15;
    if (lines.length * lineHeight <= maxHeightMm) return { fontSize: pt, lines, lineHeight };
  }
  // Fell through — use min and accept overflow / truncate
  doc.setFontSize(minPt);
  return { fontSize: minPt, lines: doc.splitTextToSize(name, maxWidthMm), lineHeight: minPt * 0.352 * 1.15 };
}

// Draw one tag at (x, y) of size (w, h) on the current page.
function drawTag(doc, x, y, w, h, tag) {
  // Background — burnt-orange terracotta
  doc.setFillColor(C.bgR, C.bgG, C.bgB);
  doc.rect(x, y, w, h, 'F');

  // Inner dashed cream border (4mm inset)
  const inset = 4;
  doc.setDrawColor(C.textR, C.textG, C.textB);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.rect(x + inset, y + inset, w - 2 * inset, h - 2 * inset, 'S');
  doc.setLineDashPattern([], 0);

  // Brand wordmark — top-left
  doc.setTextColor(C.textR, C.textG, C.textB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AKAN', x + 8, y + 11);

  // Dietary icon — top-right
  const iconSize = 6.5;
  drawDietaryIcon(doc, x + w - 8 - iconSize, y + 5.5, iconSize, tag.nonVeg);

  // Food name — large, centred vertically and horizontally
  const namePadX = 7;            // horizontal padding inside tag
  const nameTopOffset = 18;      // below brand line
  const nameBottomOffset = 12;   // above category label
  const nameMaxW = w - 2 * namePadX;
  const nameMaxH = h - nameTopOffset - nameBottomOffset;
  doc.setFont('helvetica', 'bold');
  const { fontSize, lines, lineHeight } = fitText(doc, tag.name.toUpperCase(), nameMaxW, nameMaxH, 22, 9);
  doc.setFontSize(fontSize);
  const blockH = lines.length * lineHeight;
  let cursorY = y + nameTopOffset + (nameMaxH - blockH) / 2 + lineHeight * 0.75;
  lines.forEach((ln) => {
    doc.text(ln, x + w / 2, cursorY, { align: 'center' });
    cursorY += lineHeight;
  });

  // Category label — bottom center, small caps, letter-spaced look
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(C.textR, C.textG, C.textB);
  doc.text(tag.categoryLabel, x + w / 2, y + h - 5, { align: 'center' });
}

/**
 * Generate a print-ready PDF of buffet name tags for an Approved F&P.
 * A4 portrait, 8 tags per page (2 cols × 4 rows).
 *
 * @param {object} opts
 * @param {object} opts.fp     — F&P record (camelCase fields)
 * @param {string} opts.fpId   — F&P ID for the filename
 */
export function generateNameTagsPdf({ fp, fpId }) {
  const tags = collectTags(fp);
  if (tags.length === 0) {
    alert('No menu items selected on this F&P — nothing to print.');
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 8;
  const COLS = 2;
  const ROWS = 4;
  const TAGS_PER_PAGE = COLS * ROWS;
  const GAP = 2;
  const tagW = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
  const tagH = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS;

  tags.forEach((tag, idx) => {
    if (idx > 0 && idx % TAGS_PER_PAGE === 0) doc.addPage();
    const slot = idx % TAGS_PER_PAGE;
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const x = MARGIN + col * (tagW + GAP);
    const y = MARGIN + row * (tagH + GAP);
    drawTag(doc, x, y, tagW, tagH, tag);
  });

  const safeId = (fpId || 'FP').toString().replace(/[^a-z0-9-]/gi, '_');
  doc.save(`AKAN_Name_Tags_${safeId}.pdf`);
}
