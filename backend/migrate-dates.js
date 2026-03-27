/**
 * One-time migration: Convert Date column from YYYY-MM-DD to DD-MM-YYYY in Google Sheets.
 * Run: node migrate-dates.js
 */
require('dotenv').config();
const { getSheetsClient, SHEET_NAMES } = require('./config/google-sheets');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const DATE_COL_INDEX = 1; // Column B (0-based)
const LAST_COL = 'AK';

async function migrate() {
  const sheets = getSheetsClient();

  // Read all rows
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAMES.PARTY_BOOKINGS}!A2:${LAST_COL}`,
  });

  const rows = res.data.values || [];
  console.log(`Found ${rows.length} rows to check`);

  let updated = 0;
  const updates = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dateVal = row[DATE_COL_INDEX] || '';

    // Skip TBC dates
    if (dateVal.startsWith('TBC:')) continue;

    // Check if it's YYYY-MM-DD format
    const m = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const newDate = `${m[3]}-${m[2]}-${m[1]}`;
      const rowNum = i + 2; // 1-based, skip header
      updates.push({
        range: `${SHEET_NAMES.PARTY_BOOKINGS}!B${rowNum}`,
        values: [[newDate]],
      });
      updated++;
    }
  }

  if (updates.length === 0) {
    console.log('No dates to convert. All dates are already in DD-MM-YYYY format.');
    return;
  }

  // Batch update
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates,
    },
  });

  console.log(`Successfully converted ${updated} dates from YYYY-MM-DD to DD-MM-YYYY`);
}

migrate().catch(console.error);
