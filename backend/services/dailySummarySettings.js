/**
 * Daily Summary settings — Admin-edited JSON in backend/data/ (same pattern as
 * enquiry-sources.json; the deploy never overwrites data/).
 *
 *   hiddenStatuses — party statuses left out of every summary section
 *   extraFields    — FIELD_CATALOG keys added as an extra line per party
 *
 * Missing / corrupt file → defaults (Confirmed, Cancelled, Ala Carte hidden;
 * no extra details), i.e. exactly the behaviour before this setting existed.
 */
const fs = require('fs');
const path = require('path');
const { ALL_STATUSES, HIDDEN_STATUSES, FIELD_BY_KEY } = require('./dailySummaryService');

const DS_PATH = path.join(__dirname, '..', 'data', 'daily-summary-settings.json');

const DEFAULTS = Object.freeze({
  hiddenStatuses: [...HIDDEN_STATUSES],
  extraFields: [],
});

// Keep only known values, de-duped, in canonical order
function sanitize(input) {
  const hidden = new Set(Array.isArray(input?.hiddenStatuses) ? input.hiddenStatuses.map((s) => String(s).trim()) : DEFAULTS.hiddenStatuses);
  const fields = new Set(Array.isArray(input?.extraFields) ? input.extraFields.map((k) => String(k).trim()) : DEFAULTS.extraFields);
  return {
    hiddenStatuses: ALL_STATUSES.filter((s) => hidden.has(s)),
    extraFields: [...FIELD_BY_KEY.keys()].filter((k) => fields.has(k)),
  };
}

function loadDailySummarySettings() {
  try {
    if (fs.existsSync(DS_PATH)) {
      const s = sanitize(JSON.parse(fs.readFileSync(DS_PATH, 'utf-8')));
      // A file that hides everything would make the page blank — treat as corrupt
      if (s.hiddenStatuses.length < ALL_STATUSES.length) return s;
    }
  } catch { /* fall through */ }
  return sanitize(DEFAULTS);
}

function saveDailySummarySettings(settings) {
  const dir = path.dirname(DS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

module.exports = {
  DS_PATH,
  DEFAULTS,
  sanitize,
  loadDailySummarySettings,
  saveDailySummarySettings,
};
