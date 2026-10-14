/**
 * Daily Summary — WhatsApp text builders (pure, no React).
 * Output uses WhatsApp markup: *bold*, _italic_.
 *
 * Kept deliberately short: 4 lines per party
 *   1. *Host* – Company
 *   📅 Event: Date · 👥 Pax · Status · 📞 Phone
 *   ☎️ Last contacted: Date (N days ago)
 *   📝 Who: latest note
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Plain labels (the page has its own icons); emoji are added for WhatsApp only
export const TITLES = {
  today: "Today's Updates",
  next7: 'Follow Up – Next 7 Days',
  next30: 'Next 30 Days',
};
const EMOJI = { today: '📌', next7: '⏰', next30: '📆' };

// "2026-10-16" → "16 Oct (Fri)"; TBC / other strings pass through
export function fmtDate(iso) {
  if (!iso) return '-';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${Number(m[3])} ${MONTHS[d.getMonth()]} (${DAYS[d.getDay()]})`;
}

// Cuts by code points so an emoji is never split into a lone surrogate
// (which would make encodeURIComponent throw on the WhatsApp link)
export function trunc(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const cp = Array.from(t);
  return cp.length > n ? `${cp.slice(0, n - 1).join('')}…` : t;
}

// Replace any lone surrogate (bad sheet data) with U+FFFD
function wellFormed(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { out += s[i] + s[i + 1]; i++; } else out += '�';
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out += '�';
    } else {
      out += s[i];
    }
  }
  return out;
}

// api.whatsapp.com keeps emoji intact (wa.me's redirect turns them into �)
export function whatsappShareUrl(text) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(wellFormed(String(text || '')))}`;
}

// "[13 Oct, 05:31 pm - Naveen] Party created" → { when: "13 Oct", who: "Naveen", text: "Party created" }
export function parseNote(note) {
  const s = String(note || '').trim();
  const m = s.match(/^\[(.+?)\s+-\s+([^\]]+)\]\s*([\s\S]*)$/);
  if (!m) return { when: '', who: '', text: s };
  return { when: m[1].split(',')[0].trim(), who: m[2].trim(), text: m[3].trim() };
}

// Is a note's "13 Oct" / "13 Sept" the same calendar day as ISO today?
function isNoteToday(when, todayIso) {
  const w = String(when || '').match(/^(\d{1,2})\s+([A-Za-z]{3})/);
  const t = String(todayIso || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!w || !t) return false;
  return Number(w[1]) === Number(t[2]) && w[2].toLowerCase() === MONTHS[Number(t[1]) - 1].toLowerCase();
}

function whenLabel(p) {
  if (p.daysAway === 0) return 'Today';
  if (p.daysAway === 1) return 'Tomorrow';
  return '';
}

// "40" → "40 pax"; "40-50" → "40-50 pax"; "50 pax" stays as is
export function paxLabel(p) {
  const v = String(p.expectedPax || '').trim();
  if (!v) return '';
  return /pax/i.test(v) ? v : `${v} pax`;
}

// "2026-09-29" → "29 Sep"
function fmtDayMonth(iso) {
  const m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : '';
}

// Line 3: ☎️ Last contacted: 29 Sep (15 days ago) — '' if the backend didn't send it
export function contactLine(p) {
  if (p.lastContacted === undefined) return '';
  if (!p.lastContacted) return 'Not contacted yet';
  const d = p.contactedDaysAgo;
  const ago = d === 0 ? 'today' : d === 1 ? 'yesterday' : d > 1 ? `${d} days ago` : '';
  return `Last contacted: ${fmtDayMonth(p.lastContacted)}${ago ? ` (${ago})` : ''}`;
}

// Line 2: 📅 Event: 16 Oct (Fri) · Today · 👥 40 pax · Enquiry · 📞 98765…
function detailLine(p) {
  const bits = [`📅 Event: ${fmtDate(p.date)}`];
  const w = whenLabel(p);
  if (w) bits.push(w);
  const pax = paxLabel(p);
  if (pax) bits.push(`👥 ${pax}`);
  if (p.status) bits.push(p.status);
  if (p.phoneNumber) bits.push(`📞 ${p.phoneNumber}`);
  return bits.join(' · ');
}

// Line 3 for Today: what changed today. Prefer today's follow-up note;
// otherwise today's latest change (e.g. a pax edit with no note).
export function todayNote(p, todayIso) {
  const n = parseNote(p.latestFollowUp);
  if (n.text && isNoteToday(n.when, todayIso)) {
    return `${n.who ? `${n.who}: ` : ''}${trunc(n.text, 100)}`;
  }
  const last = (p.activities || [])[(p.activities || []).length - 1];
  if (last) return `${last.user ? `${last.user}: ` : ''}${trunc(last.summary, 100)}`;
  return n.text ? trunc(n.text, 100) : '';
}

// Note line for upcoming: latest follow-up. Its date is already on the
// "Last contacted" line, so it's repeated only when the two differ.
export function upcomingNote(p) {
  const n = parseNote(p.latestFollowUp);
  if (!n.text) return p.lastContacted === undefined ? 'No follow-up yet' : '';
  const showDate = n.when && (p.lastContacted === undefined || p.lastNoteDate !== p.lastContacted);
  const head = [showDate ? n.when : '', n.who].filter(Boolean).join(' · ');
  return `${head ? `${head}: ` : ''}${trunc(n.text, 100)}`;
}

// Optional line: extra details chosen in Settings → Daily Summary
export function extrasLine(p) {
  if (!p.extras?.length) return '';
  return p.extras.map((e) => `${e.label}: ${trunc(e.value, 60)}`).join(' · ');
}

function partyBlock(p, i, note) {
  // WhatsApp only bolds *text* with no space inside the asterisks
  const host = String(p.hostName || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim() || 'Unnamed';
  const co = String(p.company || '').replace(/\s+/g, ' ').trim();
  const company = co ? ` – ${co}` : '';
  const lines = [`${i + 1}. *${host}*${company}`, detailLine(p)];
  const contact = contactLine(p);
  if (contact) lines.push(`☎️ ${contact}`);
  const extras = extrasLine(p);
  if (extras) lines.push(`ℹ️ ${extras}`);
  if (note) lines.push(`📝 ${note}`);
  return lines.join('\n');
}

function section(title, list, noteFn, emptyText) {
  const out = [`*${title} (${list.length})*`];
  if (list.length === 0) {
    out.push(`_${emptyText}_`);
  } else {
    list.forEach((p, i) => out.push('', partyBlock(p, i, noteFn(p))));
  }
  return out.join('\n');
}

export function buildTodayText(data) {
  return section(`${EMOJI.today} ${TITLES.today}`, data?.todayActivity || [], (p) => todayNote(p, data?.today), 'No updates today.');
}

export function buildNext7Text(data) {
  return section(`${EMOJI.next7} ${TITLES.next7}`, data?.next7 || [], upcomingNote, 'Nothing to follow up.');
}

export function buildNext30Text(data) {
  return section(`${EMOJI.next30} ${TITLES.next30}`, data?.next30 || [], upcomingNote, 'No parties.');
}

export function buildFullText(data) {
  return [
    `*AKAN Daily Summary · ${fmtDate(data?.today)}*`,
    '',
    buildTodayText(data),
    '',
    '',
    buildNext7Text(data),
    '',
    '',
    buildNext30Text(data),
  ].join('\n');
}
