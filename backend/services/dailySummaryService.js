/**
 * Daily Summary — pure digest builder (no I/O).
 *
 * buildDailySummary(rows, history, nowMs) takes Party Bookings rows (as
 * returned by sheetsService.getAllRows) and Edit History entries (as returned
 * by sheetsService.getAllEditHistory) and returns:
 *
 *   todayActivity — every party with an Edit History entry dated today (IST),
 *                   most recently touched first, with today's actions
 *   next7         — parties dated today .. today+7 (must follow up)
 *   next30        — parties dated today+8 .. today+30 (no overlap with next7)
 *
 * All three sections hide parties whose CURRENT status is in
 * opts.hiddenStatuses (default Confirmed, Cancelled, Ala Carte — nothing left
 * to follow up; Admin can change this in Settings → Daily Summary). Upcoming
 * lists also exclude TBC dates (no exact date to count days from).
 * opts.extraFields adds the chosen FIELD_CATALOG details to each party.
 * Pure so it can be verified read-only against real data.
 */

const DAY_MS = 86400000;

// Mirrors VALID_STATUSES in routes/parties.js
const ALL_STATUSES = ['Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled', 'Ala Carte'];

// Default: statuses with no follow-up left are hidden from every section.
const HIDDEN_STATUSES = new Set(['Confirmed', 'Cancelled', 'Ala Carte']);

// Optional per-party details Admin can add to the summary (Settings →
// Daily Summary). key is what settings store; label is what the summary shows.
const FIELD_CATALOG = [
  { key: 'uniqueId', label: 'ID', name: 'Unique ID', col: 'Unique ID' },
  { key: 'confirmedPax', label: 'Confirmed Pax', name: 'Confirmed Pax', col: 'Confirmed Pax' },
  { key: 'partyTime', label: 'Time', name: 'Party Time', col: 'Party Time' },
  { key: 'place', label: 'Place', name: 'Place / Area', col: 'Place' },
  { key: 'occasionType', label: 'Occasion', name: 'Occasion Type', col: 'Occasion Type' },
  { key: 'handledBy', label: 'Handled By', name: 'Handled By', col: 'Handled By' },
  { key: 'packageSelected', label: 'Package', name: 'Package Selected', col: 'Package Selected' },
  // Same fallback as F&P: Final Rate, else Confirmed Final Rate
  { key: 'ratePerHead', label: 'Rate/Head', name: 'Rate Per Head', money: true, get: (r) => r['Final Rate'] || r['Confirmed Final Rate'] },
  { key: 'finalTotal', label: 'Total', name: 'Final Total Amount', money: true, col: 'Final Total Amount' },
  { key: 'advancePaid', label: 'Advance', name: 'Advance Paid', money: true, col: 'Total Advance Paid' },
  { key: 'dueAmount', label: 'Due', name: 'Due Amount', money: true, col: 'Due Amount' },
  { key: 'paymentStatus', label: 'Payment', name: 'Payment Status', col: 'Payment Status' },
  { key: 'enquirySource', label: 'Reference', name: 'Reference / Enquiry Source', col: 'Enquiry Source' },
  { key: 'guestEmail', label: 'Email', name: 'Guest Email', col: 'Guest Email' },
  { key: 'altContact', label: 'Alt Contact', name: 'Alt Contact', col: 'Alt Contact' },
  { key: 'specialRequirements', label: 'Special Req', name: 'Special Requirements', col: 'Special Requirements' },
  { key: 'remarks', label: 'Remarks', name: 'Remarks', col: 'Remarks' },
  { key: 'lostReason', label: 'Lost Reason', name: 'Lost Reason', col: 'Lost Reason' },
  { key: 'createdBy', label: 'Created By', name: 'Created By', col: 'Created By' },
];
const FIELD_BY_KEY = new Map(FIELD_CATALOG.map((f) => [f.key, f]));

// "1700" / "1,700" / "₹1700" / "1700/-" / "Rs. 1700" → "₹1,700";
// anything non-numeric passes through
function fmtMoney(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const digits = s.replace(/^(rs\.?|inr)/i, '').replace(/\/-$/, '').replace(/[₹,\s]/g, '');
  const n = digits ? Number(digits) : NaN;
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : s;
}

// [{ label, value }] for the chosen fields, in catalog order, blanks skipped
function partyExtras(r, extraFields) {
  if (!extraFields || extraFields.length === 0) return [];
  const chosen = new Set(extraFields);
  const out = [];
  FIELD_CATALOG.forEach((f) => {
    if (!chosen.has(f.key)) return;
    const raw = f.get ? f.get(r) : r[f.col];
    const value = f.money ? fmtMoney(raw) : String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (value) out.push({ label: f.label, value });
  });
  return out;
}
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

// YYYY-MM-DD in IST for nowMs + offsetDays (server clock is UTC)
function istDateStr(nowMs, offsetDays = 0) {
  return new Date(nowMs + offsetDays * DAY_MS).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function isTBC(v) {
  return !!v && String(v).trim().toUpperCase().startsWith('TBC');
}

// Exact party date as YYYY-MM-DD, or '' when TBC / unparseable.
function partyIsoDate(v) {
  if (!v || isTBC(v)) return '';
  const s = String(v).trim();
  if (ISO_RE.test(s)) return s;
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Edit History timestamps: "13-Oct-2026, 4:33:04 pm" / "13 Oct 2026, ..." /
// "03-Sept-2026, 9:01:00 a.m." — en-IN output varies by Node/ICU version.
function editTimestampToDate(ts) {
  const m = String(ts || '').match(/(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s-,]+(\d{4})/);
  if (!m) return '';
  const mi = MONTHS_SHORT.indexOf(m[2].toLowerCase());
  if (mi === -1) return '';
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function editTimestampTime(ts) {
  const m = String(ts || '').match(/(\d{1,2}:\d{2})(?::\d{2})?\s*([ap]\.?m\.?)/i);
  return m ? `${m[1]} ${m[2].replace(/\./g, '').toUpperCase()}` : '';
}

// Every save auto-recalculates money fields, so the audit log is full of
// no-op parts like `Due Amount: "0" → ""`. Strip parts whose old and new
// values are both "empty-ish" (blank or 0). Returns '' if nothing meaningful
// is left, so the caller can drop the activity entirely.
const EMPTYISH = new Set(['', '0', '0.0', '0.00']);
function cleanSummary(summary) {
  const s = String(summary || '').trim();
  if (!s) return '';
  const parts = s.split(/;\s*/).filter((part) => {
    const m = part.match(/^[^:]+:\s*"([^"]*)"\s*→\s*"([^"]*)"\s*$/);
    if (!m) return true; // not a field diff — keep (e.g. "Party created — …")
    return !(EMPTYISH.has(m[1].trim()) && EMPTYISH.has(m[2].trim()));
  });
  return parts.join('; ');
}

// Follow-up notes are PREPENDED, so the first non-empty line is the latest.
function latestFollowUp(r) {
  const notes = String(r['Follow Up Notes'] || '').trim();
  if (!notes) return '';
  return notes.split('\n').map((l) => l.trim()).find(Boolean) || '';
}

function summaryParty(r, todayIso, extraFields) {
  const iso = partyIsoDate(r['Date']);
  return {
    rowIndex: r._rowIndex,
    uniqueId: r['Unique ID'] || '',
    hostName: r['Host Name'] || '',
    phoneNumber: r['Phone Number'] || '',
    company: r['Company'] || '',
    date: iso || String(r['Date'] || ''), // ISO when exact, else raw (e.g. "TBC: May 2026")
    status: (r['Status'] || '').trim(),
    expectedPax: String(r['Expected Pax'] || '').replace(/\s+/g, ' ').trim(),
    place: r['Place'] || '',
    partyTime: r['Party Time'] || '',
    handledBy: r['Handled By'] || '',
    occasionType: r['Occasion Type'] || '',
    lastFollowUpDate: r['Last Follow Up Date'] || '',
    latestFollowUp: latestFollowUp(r),
    daysAway: iso ? Math.round((Date.parse(iso) - Date.parse(todayIso)) / DAY_MS) : null,
    extras: partyExtras(r, extraFields),
  };
}

function buildDailySummary(rows, history, nowMs = Date.now(), opts = {}) {
  const hidden = new Set(opts.hiddenStatuses || HIDDEN_STATUSES);
  const isHidden = (r) => hidden.has(String(r['Status'] || '').trim());
  const extraFields = opts.extraFields || [];
  const today = istDateStr(nowMs, 0);
  const in7 = istDateStr(nowMs, 7);
  const from30 = istDateStr(nowMs, 8);
  const in30 = istDateStr(nowMs, 30);

  const byUid = new Map();
  (rows || []).forEach((r) => {
    const uid = String(r['Unique ID'] || '').trim();
    if (uid && !byUid.has(uid)) byUid.set(uid, r);
  });

  // 1. Today's activity. History is appended chronologically, so the array
  //    index is a reliable recency key (timestamps are locale strings).
  const todayMap = new Map();
  (history || []).forEach((h, idx) => {
    if (editTimestampToDate(h.timestamp) !== today) return;
    const uid = String(h.partyUniqueId || '').trim();
    if (!uid) return;
    const summary = cleanSummary(h.summary);
    if (!summary) return; // pure auto-calc noise — not an activity
    if (!todayMap.has(uid)) todayMap.set(uid, { lastIdx: idx, acts: [] });
    const entry = todayMap.get(uid);
    entry.lastIdx = idx;
    const act = {
      time: editTimestampTime(h.timestamp),
      user: h.userName || '',
      action: h.action || '',
      summary,
    };
    // Collapse exact repeats (double-saves write identical entries)
    const prev = entry.acts[entry.acts.length - 1];
    if (prev && prev.action === act.action && prev.summary === act.summary && prev.user === act.user) return;
    entry.acts.push(act);
  });
  const todayActivity = [];
  todayMap.forEach(({ lastIdx, acts }, uid) => {
    const r = byUid.get(uid);
    if (!r) return; // party deleted since the edit
    if (isHidden(r)) return; // status Admin chose to leave out
    todayActivity.push({ ...summaryParty(r, today, extraFields), activities: acts, _lastIdx: lastIdx });
  });
  todayActivity.sort((a, b) => b._lastIdx - a._lastIdx);
  todayActivity.forEach((p) => { delete p._lastIdx; });

  // 2 & 3. Upcoming by exact event date
  const upcoming = (rows || [])
    .filter((r) => !isHidden(r) && !!partyIsoDate(r['Date']))
    .map((r) => summaryParty(r, today, extraFields))
    .sort((a, b) => a.date.localeCompare(b.date) || a.hostName.localeCompare(b.hostName));

  const next7 = upcoming.filter((p) => p.date >= today && p.date <= in7);
  const next30 = upcoming.filter((p) => p.date >= from30 && p.date <= in30);

  return {
    today,
    ranges: { next7: { from: today, to: in7 }, next30: { from: from30, to: in30 } },
    todayActivity,
    next7,
    next30,
  };
}

module.exports = {
  buildDailySummary,
  ALL_STATUSES,
  HIDDEN_STATUSES,
  FIELD_CATALOG,
  FIELD_BY_KEY,
  // exported for tests
  editTimestampToDate,
  editTimestampTime,
  cleanSummary,
  fmtMoney,
  partyExtras,
  partyIsoDate,
  istDateStr,
};
