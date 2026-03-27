/**
 * Convert ALL date columns to YYYY-MM-DD format in Google Sheets.
 */
require('dotenv').config();
const { getSheetsClient, SHEET_NAMES } = require('./config/google-sheets');

// Date columns: C=Date, O=Cancelled Date, AD=Last Follow Up Date, AI=Balance Payment Date
const DATE_COLS = [
  { col: 'B', name: 'Date' },
  { col: 'P', name: 'Cancelled Date' },
  { col: 'AD', name: 'Last Follow Up Date' },
  { col: 'AI', name: 'Balance Payment Date' },
];

async function migrate() {
  const sheets = getSheetsClient();
  const id = process.env.GOOGLE_SHEETS_ID;
  const updates = [];

  for (const { col, name } of DATE_COLS) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!${col}2:${col}`,
    });
    const vals = res.data.values || [];
    vals.forEach((row, idx) => {
      const val = (row[0] || '').trim();
      if (!val || val.startsWith('TBC:')) return;
      // DD-MM-YYYY → YYYY-MM-DD
      const m = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (m) {
        updates.push({
          range: `${SHEET_NAMES.PARTY_BOOKINGS}!${col}${idx + 2}`,
          values: [[`${m[3]}-${m[2]}-${m[1]}`]],
        });
        console.log(`  ${name} row ${idx + 2}: ${val} → ${m[3]}-${m[2]}-${m[1]}`);
      }
    });
  }

  if (updates.length === 0) {
    console.log('All dates are already in YYYY-MM-DD format.');
    return;
  }

  console.log(`\nConverting ${updates.length} dates...`);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });
  console.log('Done!');
}

migrate().catch(console.error);
