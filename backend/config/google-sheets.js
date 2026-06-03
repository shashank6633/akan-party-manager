const { google } = require('googleapis');

// Sheet tab names
const SHEET_NAMES = {
  PARTY_BOOKINGS: 'Party Bookings',
  USERS: 'Users',
  REMINDER_LOG: 'Payment Reminder Log',
  FP_RECORDS: 'F&P Records',
  FEEDBACK: 'Feedback',
  PRE_TASTING: 'Pre-Tasting',
  GUEST_CONTACTS: 'Guest Contacts',
};

/**
 * Initialize Google Sheets API client with service account credentials.
 * Uses GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY from environment.
 */
function getAuthClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    // Private key comes with literal \n in .env; replace them with actual newlines
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return auth;
}

/**
 * Sanitize a single cell value before it's written to Google Sheets.
 *
 * Google Sheets treats cells that start with `=`, `+`, `-`, or `@` as
 * formulas under valueInputOption: 'USER_ENTERED'. So a phone like
 *   "+91 9876543210"  →  parsed as `=+91 9876543210`  →  invalid syntax
 *   →  cell shows "#ERROR!"  →  original input lost.
 *
 * Prepending a single apostrophe forces Sheets to store the value as
 * literal text. The apostrophe is invisible in the cell display, the API
 * read also returns the value without the apostrophe, and dates / numbers
 * (which never start with these symbols) are unaffected.
 *
 * Safe re-write: if we read "+91 …" and write it back, only one apostrophe
 * ever gets prepended — the apostrophe is metadata, not content.
 */
function sanitizeForSheets(val) {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return val;
  if (val.length === 0) return val;
  if (/^[=+\-@]/.test(val)) return `'${val}`;
  return val;
}

/**
 * Recursively sanitize every leaf string in the values payload that
 * spreadsheets.values.update / append accepts. Handles both 1-D (header
 * rows) and 2-D (data rows) arrays.
 */
function sanitizeValuesPayload(values) {
  if (!Array.isArray(values)) return values;
  return values.map((row) =>
    Array.isArray(row) ? row.map((cell) => sanitizeForSheets(cell)) : sanitizeForSheets(row)
  );
}

/**
 * Return an authenticated Google Sheets API v4 client.
 *
 * The returned client has its write methods (values.update, values.append,
 * values.batchUpdate) wrapped so every cell value flows through
 * sanitizeForSheets() automatically — no caller has to remember.
 */
function getSheetsClient() {
  const auth = getAuthClient();
  const client = google.sheets({ version: 'v4', auth });
  const values = client.spreadsheets.values;
  const wrap = (origMethod) => (params, ...rest) => {
    if (params && params.requestBody && Array.isArray(params.requestBody.values)) {
      params = {
        ...params,
        requestBody: {
          ...params.requestBody,
          values: sanitizeValuesPayload(params.requestBody.values),
        },
      };
    }
    return origMethod.call(values, params, ...rest);
  };
  values.update = wrap(values.update);
  values.append = wrap(values.append);
  // values.batchUpdate has a different payload shape — sanitize each item's values
  const origBatch = values.batchUpdate.bind(values);
  values.batchUpdate = (params, ...rest) => {
    if (params && params.requestBody && Array.isArray(params.requestBody.data)) {
      params = {
        ...params,
        requestBody: {
          ...params.requestBody,
          data: params.requestBody.data.map((item) =>
            item && Array.isArray(item.values)
              ? { ...item, values: sanitizeValuesPayload(item.values) }
              : item
          ),
        },
      };
    }
    return origBatch(params, ...rest);
  };
  return client;
}

module.exports = {
  getSheetsClient,
  getAuthClient,
  SHEET_NAMES,
  SPREADSHEET_ID: process.env.GOOGLE_SHEETS_ID,
  GUEST_CONTACTS_SHEET_ID: process.env.GUEST_CONTACTS_SHEET_ID,
};
