const { google } = require('googleapis');

// Sheet tab names
const SHEET_NAMES = {
  PARTY_BOOKINGS: 'Party Bookings',
  USERS: 'Users',
  REMINDER_LOG: 'Payment Reminder Log',
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
 * Return an authenticated Google Sheets API v4 client.
 */
function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

module.exports = {
  getSheetsClient,
  getAuthClient,
  SHEET_NAMES,
  SPREADSHEET_ID: process.env.GOOGLE_SHEETS_ID,
};
