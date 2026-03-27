/**
 * One-time migration: Populate Day column (AK) for all existing parties.
 * Run: node migrate-days.js
 */
require('dotenv').config();
const { getSheetsClient, SHEET_NAMES } = require('./config/google-sheets');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const DATE_COL_INDEX = 1;  // Column B (Date)
const DAY_COL_INDEX = 36;  // Column AK (Day) - 0-based
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function migrate() {
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAMES.PARTY_BOOKINGS}!A2:AK`,
  });

  const rows = res.data.values || [];
  console.log(`Found ${rows.length} rows to check`);

  const updates = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dateVal = (row[DATE_COL_INDEX] || '').trim();
    const existingDay = (row[DAY_COL_INDEX] || '').trim();
    const rowNum = i + 2;

    // Skip if Day already populated
    if (existingDay) continue;

    if (dateVal.startsWith('TBC:')) {
      updates.push({ range: `${SHEET_NAMES.PARTY_BOOKINGS}!AK${rowNum}`, values: [['TBC']] });
      continue;
    }

    // Parse DD-MM-YYYY format
    let parsed;
    const ddmmyyyy = dateVal.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) {
      parsed = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
    } else {
      parsed = new Date(dateVal);
    }

    if (!isNaN(parsed.getTime())) {
      const dayName = DAYS[parsed.getDay()];
      updates.push({ range: `${SHEET_NAMES.PARTY_BOOKINGS}!AK${rowNum}`, values: [[dayName]] });
    }
  }

  if (updates.length === 0) {
    console.log('No rows need Day populated.');
    return;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates,
    },
  });

  console.log(`Successfully populated Day for ${updates.length} parties`);
}

migrate().catch(console.error);
