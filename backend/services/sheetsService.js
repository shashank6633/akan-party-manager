const { getSheetsClient, SHEET_NAMES } = require('../config/google-sheets');

// Date format: Google Sheets and frontend both use YYYY-MM-DD
const DATE_COLUMNS = [];
function toSheetDate(v) { return v; }
function fromSheetDate(v) { return v; }

/**
 * Column mapping: ordered list of all 32 columns (A through AF) in the Party Bookings sheet.
 * The index in this array corresponds to the column position (0 = A, 1 = B, ...).
 *
 * SECTION 1: Basic Details (A-G)
 * SECTION 2: Party Details (H-L)
 * SECTION 3: Status Tracking (M-P)
 * SECTION 4: Estimation (Q-R)
 * SECTION 5: Final Confirmation (S-U)
 * SECTION 6: Payment Tracking (V-Z)
 * SECTION 7: System Fields (AA-AF)
 * SECTION 8: Additional Fields (AG-AJ)
 */
const COLUMNS = [
  'Unique ID',                   // A
  'Date',                        // B
  'Host Name',                   // C
  'Phone Number',                // D
  'Company',                     // E
  'Place',                       // F
  'Handled By',                   // G
  'Occasion Type',               // H
  'Meal Type',                   // I
  'Expected Pax',                // J
  'Package Selected',            // K
  'Special Requirements',        // L
  'Status',                      // M
  'Guest Visited',               // N
  'Lost Reason',                 // O
  'Cancelled Date',              // P
  'Approx Bill Amount',          // Q
  'Approx Balance Amount',       // R
  'Confirmed Pax',               // S
  'Final Rate',                  // T
  'Final Total Amount',          // U
  'Payment Log',                 // V
  'Total Advance Paid',          // W
  'Total Paid',                  // X
  'Total Amount Paid',           // Y
  'Due Amount',                  // Z
  'Follow Up Notes',             // AA
  'Last Follow Up Date',         // AB
  'Enquired At',                 // AC
  'Payment Status',              // AD
  'FP Issued',                   // AE
  'Remarks',                     // AF
  'Alt Contact',                 // AG  (Alt Contact Person + Alt Phone in one cell)
  'Guest Email',                 // AH
  'Balance Payment Date',        // AI
  'Bill Order ID',               // AJ
  'Day',                         // AK  (Auto-calculated from Date)
];

/**
 * COLUMN_MAP: { 'Unique ID': 0, 'Date': 1, ... }
 */
const COLUMN_MAP = {};
COLUMNS.forEach((name, idx) => {
  COLUMN_MAP[name] = idx;
});

// Last column letter for range references
const LAST_COL = 'AK';

// Retry wrapper for transient Google API errors
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err.code === 429 ||
        err.code === 503 ||
        err.code === 'ECONNRESET' ||
        (err.message && err.message.includes('quota'));
      if (isRetryable && attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`Sheets API attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Get the spreadsheet ID from environment (deferred so .env is loaded first).
 */
function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID;
}

/**
 * Generate a unique ID for a new party booking.
 * Format: AKN-YYYYMMDD-XXXX (date + 4 random alphanumeric chars)
 */
function generateUniqueId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `AKN-${dateStr}-${rand}`;
}

// ---------------------------------------------------------------------------
// Party Bookings CRUD
// ---------------------------------------------------------------------------

/**
 * Read all data rows from the Party Bookings sheet (excluding header row).
 * Returns an array of objects keyed by column name.
 */
async function getAllRows() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!A2:${LAST_COL}`,
    });
    const rows = res.data.values || [];
    return rows.map((row, idx) => {
      const obj = {};
      COLUMNS.forEach((col, colIdx) => {
        let val = row[colIdx] !== undefined ? row[colIdx] : '';
        if (DATE_COLUMNS.includes(col)) val = fromSheetDate(val);
        obj[col] = val;
      });
      // Row index in the sheet (1-based, accounting for header row)
      obj._rowIndex = idx + 2;
      return obj;
    });
  });
}

/**
 * Read a single row by its 1-based sheet row index.
 * @param {number} rowIndex - 1-based row number in the sheet (header = row 1)
 */
async function getRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!A${rowIndex}:${LAST_COL}${rowIndex}`,
    });
    const row = (res.data.values || [])[0];
    if (!row) return null;
    const obj = {};
    COLUMNS.forEach((col, colIdx) => {
      let val = row[colIdx] !== undefined ? row[colIdx] : '';
      if (DATE_COLUMNS.includes(col)) val = fromSheetDate(val);
      obj[col] = val;
    });
    obj._rowIndex = rowIndex;
    return obj;
  });
}

/**
 * Append a new row to the Party Bookings sheet in date-sorted order.
 * If the date is a real date (YYYY-MM-DD), inserts at the correct position.
 * TBC dates go to the end.
 * @param {object} data - Object keyed by column name
 * @returns {object} The appended data with _rowIndex
 */
async function appendRow(data) {
  return withRetry(async () => {
    const sheets = getSheetsClient();

    // Auto-generate Unique ID if not provided
    if (!data['Unique ID']) {
      data['Unique ID'] = generateUniqueId();
    }

    const values = COLUMNS.map((col) => {
      let val = data[col];
      if (DATE_COLUMNS.includes(col)) val = toSheetDate(val);
      return val !== undefined && val !== null ? String(val) : '';
    });

    const newDate = data['Date'] || '';
    const isTBC = newDate.toString().startsWith('TBC:');

    // If it's a real date, find the right position to insert
    if (!isTBC && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      try {
        const allRows = await getAllRows();
        let insertIdx = allRows.length; // default: end

        for (let i = 0; i < allRows.length; i++) {
          const rowDate = allRows[i]['Date'] || '';
          if (rowDate.startsWith('TBC:')) continue; // TBC dates stay at end
          if (/^\d{4}-\d{2}-\d{2}$/.test(rowDate) && rowDate > newDate) {
            insertIdx = i;
            break;
          }
        }

        // insertIdx is 0-based among data rows; sheet row = insertIdx + 2 (header=1)
        const sheetRowIndex = insertIdx + 2;

        // Get sheetId for batchUpdate
        const meta = await sheets.spreadsheets.get({
          spreadsheetId: getSpreadsheetId(),
          fields: 'sheets.properties',
        });
        const sheet = meta.data.sheets.find(
          (s) => s.properties.title === SHEET_NAMES.PARTY_BOOKINGS
        );
        if (sheet) {
          // Insert a blank row at the position
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: getSpreadsheetId(),
            requestBody: {
              requests: [{
                insertDimension: {
                  range: {
                    sheetId: sheet.properties.sheetId,
                    dimension: 'ROWS',
                    startIndex: sheetRowIndex - 1, // 0-based
                    endIndex: sheetRowIndex,
                  },
                  inheritFromBefore: false,
                },
              }],
            },
          });

          // Write data into the new row
          await sheets.spreadsheets.values.update({
            spreadsheetId: getSpreadsheetId(),
            range: `${SHEET_NAMES.PARTY_BOOKINGS}!A${sheetRowIndex}:${LAST_COL}${sheetRowIndex}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
          });

          return { ...data, _rowIndex: sheetRowIndex };
        }
      } catch (err) {
        console.warn('Date-sorted insert failed, falling back to append:', err.message);
      }
    }

    // Fallback: simple append (for TBC dates or if sorted insert fails)
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!A:${LAST_COL}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });

    const updatedRange = res.data.updates.updatedRange || '';
    const match = updatedRange.match(/!A(\d+):/);
    const rowIndex = match ? parseInt(match[1], 10) : null;

    return { ...data, _rowIndex: rowIndex };
  });
}

/**
 * Update an existing row in the Party Bookings sheet.
 * Only updates the columns present in `data`; preserves others.
 * @param {number} rowIndex - 1-based sheet row index
 * @param {object} data - Partial object keyed by column name
 */
async function updateRow(rowIndex, data) {
  return withRetry(async () => {
    // First read the current row to merge
    const current = await getRow(rowIndex);
    if (!current) throw new Error(`Row ${rowIndex} not found`);

    // Merge: incoming data overwrites current values
    const merged = { ...current };
    Object.keys(data).forEach((key) => {
      if (COLUMN_MAP[key] !== undefined) {
        merged[key] = data[key];
      }
    });

    const values = COLUMNS.map((col) => {
      let val = merged[col];
      if (DATE_COLUMNS.includes(col)) val = toSheetDate(val);
      return val !== undefined && val !== null ? String(val) : '';
    });

    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!A${rowIndex}:${LAST_COL}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return { ...merged, _rowIndex: rowIndex };
  });
}

/**
 * Delete a row from the Party Bookings sheet by clearing its contents.
 * Uses batchUpdate to actually delete the row so subsequent indices shift.
 * @param {number} rowIndex - 1-based sheet row index
 */
async function deleteRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();

    // We need the sheetId (numeric) for the Party Bookings tab
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: 'sheets.properties',
    });
    const sheet = meta.data.sheets.find(
      (s) => s.properties.title === SHEET_NAMES.PARTY_BOOKINGS
    );
    if (!sheet) throw new Error('Party Bookings sheet not found');

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-based
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    return true;
  });
}

/**
 * Find duplicate entries by phone number and date.
 * @param {string} phone
 * @param {string} date
 * @returns {Array} Matching rows
 */
async function findDuplicates(phone, date) {
  const rows = await getAllRows();
  return rows.filter(
    (row) =>
      row['Phone Number'] &&
      row['Date'] &&
      row['Phone Number'].toString().trim() === phone.toString().trim() &&
      row['Date'].toString().trim() === date.toString().trim()
  );
}

/**
 * Get all values for a specific column.
 * @param {string} columnName - One of the COLUMNS names
 * @returns {Array<string>}
 */
async function getColumnValues(columnName) {
  const colIdx = COLUMN_MAP[columnName];
  if (colIdx === undefined) throw new Error(`Unknown column: ${columnName}`);

  return withRetry(async () => {
    const sheets = getSheetsClient();
    // Convert index to column letter(s)
    const colLetter = indexToColumnLetter(colIdx);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!${colLetter}2:${colLetter}`,
    });
    return (res.data.values || []).map((r) => r[0] || '');
  });
}

// ---------------------------------------------------------------------------
// Users Sheet CRUD
// ---------------------------------------------------------------------------

/**
 * Get all users from the Users sheet.
 * Columns: Username, Password (hashed), Role, Name, Email, CreatedAt
 */
async function getAllUsers() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.USERS}!A2:I`,
    });
    const rows = res.data.values || [];
    return rows.map((row, idx) => ({
      username: row[0] || '',
      password: row[1] || '',
      role: row[2] || '',
      name: row[3] || '',
      email: row[4] || '',
      createdAt: row[5] || '',
      lastLogin: row[6] || '',
      loginCount: row[7] || '0',
      status: row[8] || 'Active',
      _rowIndex: idx + 2,
    }));
  });
}

/**
 * Update a user's row in the Users sheet.
 * @param {number} rowIndex - 1-based sheet row index
 * @param {object} data - Fields to update
 */
async function updateUser(rowIndex, data) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    // Read current row
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.USERS}!A${rowIndex}:I${rowIndex}`,
    });
    const row = (res.data.values || [])[0] || [];
    const current = {
      username: row[0] || '',
      password: row[1] || '',
      role: row[2] || '',
      name: row[3] || '',
      email: row[4] || '',
      createdAt: row[5] || '',
      lastLogin: row[6] || '',
      loginCount: row[7] || '0',
      status: row[8] || 'Active',
    };
    const merged = { ...current, ...data };
    const values = [merged.username, merged.password, merged.role, merged.name, merged.email, merged.createdAt, merged.lastLogin, merged.loginCount, merged.status];
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.USERS}!A${rowIndex}:I${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });
    return merged;
  });
}

/**
 * Find a user by username.
 * @param {string} username
 * @returns {object|null}
 */
async function findUser(username) {
  const users = await getAllUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

/**
 * Append a new user row to the Users sheet.
 * @param {object} userData - { username, password, role, name, email }
 */
async function appendUser(userData) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const values = [
      userData.username,
      userData.password,
      userData.role,
      userData.name || '',
      userData.email || '',
      new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.USERS}!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });

    return userData;
  });
}

/**
 * Ensure the Users sheet tab and header row exist.
 * Creates the tab and header if missing.
 */
const USER_COLUMNS = ['Username', 'Password', 'Role', 'Name', 'Email', 'CreatedAt', 'LastLogin', 'LoginCount', 'Status'];

async function ensureUsersSheet() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: 'sheets.properties.title',
    });
    const exists = meta.data.sheets.some(
      (s) => s.properties.title === SHEET_NAMES.USERS
    );

    if (!exists) {
      // Create the Users tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: {
          requests: [
            { addSheet: { properties: { title: SHEET_NAMES.USERS } } },
          ],
        },
      });
      // Add header row
      const endCol = indexToColumnLetter(USER_COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEET_NAMES.USERS}!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [USER_COLUMNS] },
      });
      console.log('Users: Created sheet with header row.');
    } else {
      // Sheet exists — check if new columns need to be added
      const endCol = indexToColumnLetter(USER_COLUMNS.length - 1);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEET_NAMES.USERS}!A1:${endCol}1`,
      });
      const header = (res.data.values || [])[0] || [];
      if (header.length < USER_COLUMNS.length) {
        const newCols = USER_COLUMNS.slice(header.length);
        const startCol = indexToColumnLetter(header.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId: getSpreadsheetId(),
          range: `${SHEET_NAMES.USERS}!${startCol}1:${endCol}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [newCols] },
        });
        console.log(`Users: Added ${newCols.length} new column(s): ${newCols.join(', ')}`);
      }
    }
  });
}

/**
 * Ensure the Party Bookings sheet has its header row.
 */
async function ensurePartyBookingsHeader() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${SHEET_NAMES.PARTY_BOOKINGS}!A1:${LAST_COL}1`,
    });
    const header = (res.data.values || [])[0];
    if (!header || header.length === 0) {
      // No header at all — write the full header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEET_NAMES.PARTY_BOOKINGS}!A1:${LAST_COL}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [COLUMNS] },
      });
      console.log('Party Bookings: Created full header row.');
    } else if (header.length < COLUMNS.length) {
      // Header exists but has fewer columns — append the missing ones
      const newCols = COLUMNS.slice(header.length);
      const startCol = indexToColumnLetter(header.length);
      const endCol = indexToColumnLetter(COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId: getSpreadsheetId(),
        range: `${SHEET_NAMES.PARTY_BOOKINGS}!${startCol}1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newCols] },
      });
      console.log(`Party Bookings: Added ${newCols.length} new column(s): ${newCols.join(', ')}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a 0-based column index to a spreadsheet column letter (A, B, ... Z, AA, AB, AC).
 */
function indexToColumnLetter(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// ---------------------------------------------------------------------------
// Payment Reminder Log
// ---------------------------------------------------------------------------

const REMINDER_LOG_COLUMNS = ['Unique ID', 'Host Name', 'Guest Email', 'Reminder Type', 'Due Amount', 'Balance Payment Date', 'Sent At', 'Sent By'];

/**
 * Ensure the Payment Reminder Log sheet exists with headers.
 */
async function ensureReminderLogSheet() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets.some((s) => s.properties.title === SHEET_NAMES.REMINDER_LOG);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAMES.REMINDER_LOG } } }] },
      });
      const endCol = indexToColumnLetter(REMINDER_LOG_COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAMES.REMINDER_LOG}'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [REMINDER_LOG_COLUMNS] },
      });
      console.log('Payment Reminder Log: Created sheet with header row.');
    } else {
      // Sheet exists — check if new columns need to be added
      const endCol = indexToColumnLetter(REMINDER_LOG_COLUMNS.length - 1);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${SHEET_NAMES.REMINDER_LOG}'!A1:${endCol}1`,
      });
      const header = (res.data.values || [])[0] || [];
      if (header.length < REMINDER_LOG_COLUMNS.length) {
        const newCols = REMINDER_LOG_COLUMNS.slice(header.length);
        const startCol = indexToColumnLetter(header.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${SHEET_NAMES.REMINDER_LOG}'!${startCol}1:${endCol}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [newCols] },
        });
        console.log(`Payment Reminder Log: Added ${newCols.length} new column(s): ${newCols.join(', ')}`);
      }
    }
  });
}

/**
 * Log a payment reminder that was sent.
 */
async function logPaymentReminder(entry) {
  await ensureReminderLogSheet();
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const row = [
      entry.uniqueId || '',
      entry.hostName || '',
      entry.guestEmail || '',
      entry.reminderType || 'manual',
      entry.dueAmount || '',
      entry.balancePaymentDate || '',
      new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      entry.sentBy || 'System',
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.REMINDER_LOG}'!A:H`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  });
}

/**
 * Check if a reminder was already sent for a party + reminder type + date combination.
 * Returns true if already sent today.
 */
async function hasReminderBeenSent(uniqueId, reminderType) {
  await ensureReminderLogSheet();
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.REMINDER_LOG}'!A2:H`,
    });
    const rows = res.data.values || [];
    const todayIST = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    return rows.some((r) => {
      if (r[0] !== uniqueId || r[3] !== reminderType) return false;
      // Check if sent today (Sent At column contains today's date)
      const sentAt = r[6] || '';
      return sentAt.includes(todayIST);
    });
  });
}

/**
 * Get all reminder logs.
 */
async function getReminderLogs() {
  await ensureReminderLogSheet();
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.REMINDER_LOG}'!A2:H`,
    });
    return (res.data.values || []).map((r) => ({
      uniqueId: r[0] || '',
      hostName: r[1] || '',
      guestEmail: r[2] || '',
      reminderType: r[3] || '',
      dueAmount: r[4] || '',
      balancePaymentDate: r[5] || '',
      sentAt: r[6] || '',
      sentBy: r[7] || '',
    }));
  });
}

module.exports = {
  COLUMNS,
  COLUMN_MAP,
  generateUniqueId,
  // Party Bookings
  getAllRows,
  getRow,
  appendRow,
  updateRow,
  deleteRow,
  findDuplicates,
  getColumnValues,
  // Users
  getAllUsers,
  findUser,
  appendUser,
  updateUser,
  ensureUsersSheet,
  ensurePartyBookingsHeader,
  // Payment Reminder Log
  logPaymentReminder,
  hasReminderBeenSent,
  getReminderLogs,
  ensureReminderLogSheet,
};
