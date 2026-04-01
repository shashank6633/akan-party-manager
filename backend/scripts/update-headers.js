/**
 * Force-update ALL sheet headers in Google Sheets to match current column definitions.
 * Run: node scripts/update-headers.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getSheetsClient, SHEET_NAMES } = require('../config/google-sheets');

// Import column definitions
const sheetsService = require('../services/sheetsService');

// Column letter helper
function indexToColumnLetter(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

async function updateAllHeaders() {
  console.log('🔄 Updating ALL sheet headers in Google Sheets...\n');

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

  // 1. Party Bookings
  const PARTY_COLUMNS = sheetsService.COLUMNS;
  const partyLastCol = indexToColumnLetter(PARTY_COLUMNS.length - 1);
  console.log(`📋 Party Bookings: ${PARTY_COLUMNS.length} columns (A to ${partyLastCol})`);
  console.log(`   Columns: ${PARTY_COLUMNS.join(' | ')}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.PARTY_BOOKINGS}!A1:${partyLastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [PARTY_COLUMNS] },
  });
  console.log('   ✅ Party Bookings headers updated!\n');

  // 2. Users
  const USER_COLUMNS = ['Username', 'Password', 'Role', 'Name', 'Email', 'CreatedAt', 'LastLogin', 'LoginCount', 'Status'];
  const usersLastCol = indexToColumnLetter(USER_COLUMNS.length - 1);
  console.log(`👤 Users: ${USER_COLUMNS.length} columns (A to ${usersLastCol})`);
  console.log(`   Columns: ${USER_COLUMNS.join(' | ')}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.USERS}!A1:${usersLastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [USER_COLUMNS] },
  });
  console.log('   ✅ Users headers updated!\n');

  // 3. F&P Records
  const FP_COLUMNS = sheetsService.FP_COLUMNS;
  const fpLastCol = indexToColumnLetter(FP_COLUMNS.length - 1);
  console.log(`📄 F&P Records: ${FP_COLUMNS.length} columns (A to ${fpLastCol})`);
  console.log(`   Columns: ${FP_COLUMNS.join(' | ')}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_NAMES.FP_RECORDS}'!A1:${fpLastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [FP_COLUMNS] },
  });
  console.log('   ✅ F&P Records headers updated!\n');

  // 4. Feedback
  const FEEDBACK_COLUMNS = sheetsService.FEEDBACK_COLUMNS;
  const fbLastCol = indexToColumnLetter(FEEDBACK_COLUMNS.length - 1);
  console.log(`💬 Feedback: ${FEEDBACK_COLUMNS.length} columns (A to ${fbLastCol})`);
  console.log(`   Columns: ${FEEDBACK_COLUMNS.join(' | ')}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_NAMES.FEEDBACK}'!A1:${fbLastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [FEEDBACK_COLUMNS] },
  });
  console.log('   ✅ Feedback headers updated!\n');

  // 5. Payment Reminder Log
  const REMINDER_COLUMNS = ['Unique ID', 'Host Name', 'Guest Email', 'Reminder Type', 'Due Amount', 'Balance Payment Date', 'Sent At', 'Sent By'];
  const remLastCol = indexToColumnLetter(REMINDER_COLUMNS.length - 1);
  console.log(`💰 Payment Reminder Log: ${REMINDER_COLUMNS.length} columns (A to ${remLastCol})`);
  console.log(`   Columns: ${REMINDER_COLUMNS.join(' | ')}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_NAMES.REMINDER_LOG}'!A1:${remLastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [REMINDER_COLUMNS] },
  });
  console.log('   ✅ Payment Reminder Log headers updated!\n');

  // 6. Edit History
  const EDIT_HISTORY_COLUMNS = sheetsService.EDIT_HISTORY_COLUMNS;
  const ehLastCol = indexToColumnLetter(EDIT_HISTORY_COLUMNS.length - 1);
  console.log(`📝 Edit History: ${EDIT_HISTORY_COLUMNS.length} columns (A to ${ehLastCol})`);
  console.log(`   Columns: ${EDIT_HISTORY_COLUMNS.join(' | ')}`);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Edit History'!A1:${ehLastCol}1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [EDIT_HISTORY_COLUMNS] },
  });
  console.log('   ✅ Edit History headers updated!\n');

  console.log('🎉 ALL sheet headers updated successfully!');
}

updateAllHeaders().catch((err) => {
  console.error('❌ Error updating headers:', err.message);
  process.exit(1);
});
