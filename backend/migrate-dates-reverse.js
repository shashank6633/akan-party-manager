/**
 * Reverse migration: Convert Date column from DD-MM-YYYY back to YYYY-MM-DD in Google Sheets.
 */
require('dotenv').config();
const { getSheetsClient, SHEET_NAMES } = require('./config/google-sheets');

async function migrate() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  // Read all dates (column C = Date)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.PARTY_BOOKINGS}!C2:C`,
  });

  const dates = res.data.values || [];
  const updates = [];

  dates.forEach((row, idx) => {
    const val = (row[0] || '').trim();
    if (!val) return;
    if (val.startsWith('TBC:')) return;

    // Match DD-MM-YYYY
    const m = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) {
      updates.push({
        range: `${SHEET_NAMES.PARTY_BOOKINGS}!C${idx + 2}`,
        values: [[`${m[3]}-${m[2]}-${m[1]}`]],
      });
    }
  });

  if (updates.length === 0) {
    console.log('All dates are already in YYYY-MM-DD format.');
    return;
  }

  console.log(`Converting ${updates.length} dates from DD-MM-YYYY to YYYY-MM-DD...`);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates,
    },
  });

  console.log(`Done! ${updates.length} dates converted.`);
}

migrate().catch(console.error);
