const { getSheetsClient, SHEET_NAMES, GUEST_CONTACTS_SHEET_ID } = require('../config/google-sheets');

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
  'Party Time',                  // I
  'Expected Pax',                // J
  'Package Selected',            // K
  'Special Requirements',        // L
  'Status',                      // M
  'Guest Visited',               // N
  'Lost Reason',                 // O
  'Cancelled Date',              // P
  'Approx Bill Amount',          // Q
  'Confirmed Final Rate',         // R
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
  'Created By',                  // AL  (Who created this party: "Name (ROLE)")
  'Guest Contacts Status',       // AM  (Pending / Completed / No Contacts Requested / No Contacts Approved)
  'Attendance Count',            // AN  (e.g. "45/50 (90%)")
  'Guest Checkin',               // AO  (Yes / No — toggle to enable check-in module for this party)
];

/**
 * COLUMN_MAP: { 'Unique ID': 0, 'Date': 1, ... }
 */
const COLUMN_MAP = {};
COLUMNS.forEach((name, idx) => {
  COLUMN_MAP[name] = idx;
});

// Last column letter for range references
const LAST_COL = 'AO';

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
// F&P Records
// ---------------------------------------------------------------------------

/**
 * Column mapping for the F&P Records sheet.
 * 49 columns (A through AW).
 */
const FP_COLUMNS = [
  'FP ID',                  // A
  'Party Unique ID',        // B
  'Created At',             // C
  'Updated At',             // D
  'Created By',             // E
  'Status',                 // F  (Draft/Issued/Revised)
  'Date of Booking',        // G
  'Date of Event',          // H
  'Day of Event',           // I
  'Time of Event',          // J
  'Advance Payment',        // K
  'Allocated Area',         // L
  'Rate Per Head',          // M
  'Company',                // N
  'Minimum Guarantee',      // O
  'Contact Person',         // P
  'Pax Expected',           // Q
  'Phone',                  // R
  'Package Type',           // S
  'Reference',              // T
  'Mode of Payment',        // U
  'Veg Starters',           // V  (JSON array)
  'Non-Veg Starters',       // W  (JSON array)
  'Veg Main Course',        // X  (JSON array)
  'Non-Veg Main Course',    // Y  (JSON array)
  'Rice',                   // Z  (JSON array)
  'Dal',                    // AA (JSON array)
  'Salad',                  // AB (JSON array)
  'Accompaniments',         // AC (JSON array)
  'Desserts',               // AD (JSON array)
  'Addon Mutton Starters',  // AE (JSON array)
  'Addon Mutton Main Course', // AF (JSON array)
  'Addon Prawns Starters',  // AG (JSON array)
  'Addon Prawns Main Course', // AH (JSON array)
  'Addon Extras',           // AI (JSON array)
  'DJ',                     // AJ
  'MC',                     // AK
  'Mics',                   // AL
  'Decor',                  // AM
  'Seating Arrangements',   // AN
  'Bar Notes',              // AO
  'Manager Name',           // AP
  'Guest Name',             // AQ
  'Drinks Start Time',      // AR
  'Drinks End Time',        // AS
  'FP Made By',             // AT
  'Kitchen Dept',           // AU
  'Service Dept',           // AV
  'Bar Dept',               // AW
  'Stores Dept',            // AX
  'Maintenance',            // AY
  'Front Office',           // AZ
  'Preset Menu Text',       // BA (JSON - write-in menu for preset menus)
  'Other Items',            // BB (guest-requested items not in package)
  'Approx Bill Amount',     // BC (auto-calculated: min guarantee × rate per head)
  'Show Spice Levels',      // BD (boolean)
  'Spice Level',            // BE (Mild/Medium/Spicy/Extra Spicy)
  'Jain Food',              // BF (boolean)
  'Jain Food Pax',          // BG (number)
  'Vegan Food',             // BH (boolean)
  'Vegan Food Pax',         // BI (number)
  'Entertainment Notes',    // BJ
  'Activities',             // BK (JSON - array of {name, pax, amount})
];

const FP_COLUMN_MAP = {};
FP_COLUMNS.forEach((name, idx) => {
  FP_COLUMN_MAP[name] = idx;
});

const FP_LAST_COL = 'BK';

/**
 * Generate a unique ID for a new F&P record.
 * Format: FP-YYYYMMDD-XXXX (date + 4 random alphanumeric chars)
 */
function generateFpId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FP-${dateStr}-${rand}`;
}

/**
 * Ensure the F&P Records sheet tab and header row exist.
 * Creates the tab and header if missing; adds missing columns if tab exists.
 */
async function ensureFpSheet() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title,sheets.properties.sheetId,sheets.properties.gridProperties',
    });
    const fpSheet = meta.data.sheets.find(
      (s) => s.properties.title === SHEET_NAMES.FP_RECORDS
    );
    const exists = !!fpSheet;

    if (!exists) {
      // Create the F&P Records tab with enough columns
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            { addSheet: { properties: { title: SHEET_NAMES.FP_RECORDS, gridProperties: { columnCount: Math.max(FP_COLUMNS.length, 52) } } } },
          ],
        },
      });
      // Add header row
      const endCol = indexToColumnLetter(FP_COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAMES.FP_RECORDS}'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [FP_COLUMNS] },
      });
      console.log('F&P Records: Created sheet with header row.');
    } else {
      // Sheet exists — expand grid if needed before writing new columns
      const currentCols = fpSheet.properties.gridProperties?.columnCount || 26;
      if (currentCols < FP_COLUMNS.length) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              appendDimension: {
                sheetId: fpSheet.properties.sheetId,
                dimension: 'COLUMNS',
                length: FP_COLUMNS.length - currentCols,
              },
            }],
          },
        });
        console.log(`F&P Records: Expanded grid from ${currentCols} to ${FP_COLUMNS.length} columns.`);
      }

      // Check if new columns need to be added to header
      const endCol = indexToColumnLetter(FP_COLUMNS.length - 1);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${SHEET_NAMES.FP_RECORDS}'!A1:${endCol}1`,
      });
      const header = (res.data.values || [])[0] || [];
      if (header.length < FP_COLUMNS.length) {
        const newCols = FP_COLUMNS.slice(header.length);
        const startCol = indexToColumnLetter(header.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${SHEET_NAMES.FP_RECORDS}'!${startCol}1:${endCol}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [newCols] },
        });
        console.log(`F&P Records: Added ${newCols.length} new column(s): ${newCols.join(', ')}`);
      }
    }
  });
}

/**
 * Read all data rows from the F&P Records sheet (excluding header row).
 * Returns an array of objects keyed by column name.
 */
async function getAllFpRows() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FP_RECORDS}'!A2:${FP_LAST_COL}`,
    });
    const rows = res.data.values || [];
    return rows.map((row, idx) => {
      const obj = {};
      FP_COLUMNS.forEach((col, colIdx) => {
        obj[col] = row[colIdx] !== undefined ? row[colIdx] : '';
      });
      obj._rowIndex = idx + 2;
      return obj;
    });
  });
}

/**
 * Read a single F&P row by its 1-based sheet row index.
 * @param {number} rowIndex - 1-based row number in the sheet (header = row 1)
 */
async function getFpRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FP_RECORDS}'!A${rowIndex}:${FP_LAST_COL}${rowIndex}`,
    });
    const row = (res.data.values || [])[0];
    if (!row) return null;
    const obj = {};
    FP_COLUMNS.forEach((col, colIdx) => {
      obj[col] = row[colIdx] !== undefined ? row[colIdx] : '';
    });
    obj._rowIndex = rowIndex;
    return obj;
  });
}

/**
 * Append a new row to the F&P Records sheet.
 * @param {object} data - Object keyed by column name
 * @returns {object} The appended data with _rowIndex
 */
async function appendFpRow(data) {
  return withRetry(async () => {
    const sheets = getSheetsClient();

    // Auto-generate FP ID if not provided
    if (!data['FP ID']) {
      data['FP ID'] = generateFpId();
    }

    const values = FP_COLUMNS.map((col) => {
      const val = data[col];
      return val !== undefined && val !== null ? String(val) : '';
    });

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FP_RECORDS}'!A:${FP_LAST_COL}`,
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
 * Update an existing F&P row.
 * Only updates the columns present in `data`; preserves others.
 * @param {number} rowIndex - 1-based sheet row index
 * @param {object} data - Partial object keyed by column name
 */
async function updateFpRow(rowIndex, data) {
  return withRetry(async () => {
    // First read the current row to merge
    const current = await getFpRow(rowIndex);
    if (!current) throw new Error(`F&P row ${rowIndex} not found`);

    // Merge: incoming data overwrites current values
    const merged = { ...current };
    Object.keys(data).forEach((key) => {
      if (FP_COLUMN_MAP[key] !== undefined) {
        merged[key] = data[key];
      }
    });

    const values = FP_COLUMNS.map((col) => {
      const val = merged[col];
      return val !== undefined && val !== null ? String(val) : '';
    });

    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FP_RECORDS}'!A${rowIndex}:${FP_LAST_COL}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return { ...merged, _rowIndex: rowIndex };
  });
}

/**
 * Delete a row from the F&P Records sheet.
 * @param {number} rowIndex - 1-based sheet row index
 */
async function deleteFpRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: 'sheets.properties',
    });
    const sheet = meta.data.sheets.find(
      (s) => s.properties.title === SHEET_NAMES.FP_RECORDS
    );
    if (!sheet) throw new Error('F&P Records sheet not found');

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

// ---------------------------------------------------------------------------
// Edit History (Audit Log)
// ---------------------------------------------------------------------------

const EDIT_HISTORY_COLUMNS = [
  'Edit ID',            // A  (unique identifier)
  'Party Unique ID',    // B  (links to Party Bookings)
  'Row Index',          // C  (party row number)
  'Timestamp',          // D  (IST formatted)
  'User Name',          // E  (who made the edit)
  'User Role',          // F  (SALES, MANAGER, ADMIN, etc.)
  'Action',             // G  (Edit, Status Change, Payment, Follow-up, Created)
  'Changes',            // H  (JSON: [{field, from, to}])
  'Summary',            // I  (human-readable summary)
];

const EDIT_HISTORY_LAST_COL = 'I';

function generateEditId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ED-${dateStr}-${rand}`;
}

async function ensureEditHistorySheet() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const exists = meta.data.sheets.some((s) => s.properties.title === 'Edit History');
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Edit History' } } }] },
      });
      const endCol = indexToColumnLetter(EDIT_HISTORY_COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Edit History'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [EDIT_HISTORY_COLUMNS] },
      });
      console.log('Edit History: Created sheet with header row.');
    } else {
      // Check if columns need updating
      const endCol = indexToColumnLetter(EDIT_HISTORY_COLUMNS.length - 1);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'Edit History'!A1:${endCol}1`,
      });
      const header = (res.data.values || [])[0] || [];
      if (header.length < EDIT_HISTORY_COLUMNS.length) {
        const newCols = EDIT_HISTORY_COLUMNS.slice(header.length);
        const startCol = indexToColumnLetter(header.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Edit History'!${startCol}1:${endCol}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [newCols] },
        });
        console.log(`Edit History: Added ${newCols.length} new column(s).`);
      }
    }
  });
}

/**
 * Append an edit history entry.
 * @param {Object} entry - { partyUniqueId, rowIndex, userName, userRole, action, changes, summary }
 */
async function appendEditHistory(entry) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const editId = generateEditId();
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });

    const values = [
      editId,
      entry.partyUniqueId || '',
      entry.rowIndex || '',
      timestamp,
      entry.userName || '',
      entry.userRole || '',
      entry.action || 'Edit',
      typeof entry.changes === 'string' ? entry.changes : JSON.stringify(entry.changes || []),
      entry.summary || '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `'Edit History'!A:${EDIT_HISTORY_LAST_COL}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });

    return { editId, timestamp };
  });
}

/**
 * Get all edit history for a specific party (by Unique ID).
 * Returns entries sorted newest first.
 */
async function getEditHistoryByParty(partyUniqueId) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'Edit History'!A2:${EDIT_HISTORY_LAST_COL}`,
    });
    const rows = res.data.values || [];
    const entries = rows
      .filter((row) => row[1] === partyUniqueId)
      .map((row) => ({
        editId: row[0] || '',
        partyUniqueId: row[1] || '',
        rowIndex: row[2] || '',
        timestamp: row[3] || '',
        userName: row[4] || '',
        userRole: row[5] || '',
        action: row[6] || '',
        changes: row[7] || '[]',
        summary: row[8] || '',
      }));
    // Return newest first (they are appended chronologically, so reverse)
    return entries.reverse();
  });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const FEEDBACK_COLUMNS = [
  'Feedback ID',            // A
  'Party Unique ID',        // B
  'FP ID',                  // C
  'Reviewer Name',          // D  (person giving feedback — may differ from host)
  'Guest Name',             // E  (host/contact from F&P)
  'Phone',                  // F
  'Company',                // G
  'Date of Event',          // H
  'Package Type',           // I
  'Overall Rating',         // J  (1-5)
  'Overall Comment',        // K
  'Food Quality Rating',    // L  (1-5)
  'Starters Item Ratings',  // M  (JSON: [{item,rating,comment}])
  'Main Course Item Ratings', // N  (JSON)
  'Sides Item Ratings',     // O  (JSON: rice, dal, salad, accompaniments)
  'Dessert Item Ratings',   // P  (JSON)
  'Addon Item Ratings',     // Q  (JSON: mutton, prawns, extras)
  'Beverages Rating',       // R  (1-5)
  'Beverages Comment',      // S
  'Staff Behavior Rating',  // T  (1-5)
  'Order Accuracy Rating',  // U  (1-5)
  'Serving Speed Rating',   // V  (1-5)
  'Service Comment',        // W
  'Cleanliness Rating',     // X  (1-5)
  'Music Rating',           // Y  (1-5)
  'Seating Comfort Rating', // Z  (1-5)
  'Ambience Comment',       // AA
  'Complaint',              // AB
  'Suggestion',             // AC
  'Wants Callback',         // AD (Yes/No)
  'Submitted At',           // AE
  'Submitted By',           // AF
];

const FEEDBACK_COLUMN_MAP = {};
FEEDBACK_COLUMNS.forEach((name, idx) => { FEEDBACK_COLUMN_MAP[name] = idx; });

const FEEDBACK_JSON_FIELDS = [
  'Starters Item Ratings', 'Main Course Item Ratings',
  'Sides Item Ratings', 'Dessert Item Ratings',
  'Addon Item Ratings',
];

function generateFeedbackId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FB-${dateStr}-${rand}`;
}

async function ensureFeedbackSheet() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const exists = meta.data.sheets.some((s) => s.properties.title === SHEET_NAMES.FEEDBACK);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAMES.FEEDBACK } } }] },
      });
      const endCol = indexToColumnLetter(FEEDBACK_COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAMES.FEEDBACK}'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [FEEDBACK_COLUMNS] },
      });
      console.log('Feedback: Created sheet with header row.');
    }
  });
}

async function getAllFeedbackRows() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const endCol = indexToColumnLetter(FEEDBACK_COLUMNS.length - 1);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FEEDBACK}'!A2:${endCol}`,
    });
    const rows = res.data.values || [];
    return rows.map((row, idx) => {
      const obj = { _rowIndex: idx + 2 };
      FEEDBACK_COLUMNS.forEach((col, i) => {
        let val = row[i] || '';
        if (FEEDBACK_JSON_FIELDS.includes(col) && val) {
          try { val = JSON.parse(val); } catch { /* keep string */ }
        }
        obj[col] = val;
      });
      return obj;
    });
  });
}

async function appendFeedbackRow(data) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const values = FEEDBACK_COLUMNS.map((col) => {
      let val = data[col] ?? '';
      if (FEEDBACK_JSON_FIELDS.includes(col) && typeof val !== 'string') {
        val = JSON.stringify(val);
      }
      return val;
    });
    const endCol = indexToColumnLetter(FEEDBACK_COLUMNS.length - 1);
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FEEDBACK}'!A:${endCol}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
    const updatedRange = res.data.updates?.updatedRange || '';
    const match = updatedRange.match(/!A(\d+):/);
    const rowIndex = match ? parseInt(match[1]) : -1;
    return { ...data, _rowIndex: rowIndex };
  });
}

async function getFeedbackRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const endCol = indexToColumnLetter(FEEDBACK_COLUMNS.length - 1);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.FEEDBACK}'!A${rowIndex}:${endCol}${rowIndex}`,
    });
    const row = (res.data.values || [])[0];
    if (!row) return null;
    const obj = { _rowIndex: rowIndex };
    FEEDBACK_COLUMNS.forEach((col, i) => {
      let val = row[i] || '';
      if (FEEDBACK_JSON_FIELDS.includes(col) && val) {
        try { val = JSON.parse(val); } catch { /* keep string */ }
      }
      obj[col] = val;
    });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Pre-Tasting (pre-event tasting review — compared against Feedback post-event)
// ---------------------------------------------------------------------------

const PRE_TASTING_COLUMNS = [
  'Pre-Tasting ID',          // A
  'Party Unique ID',         // B
  'FP ID',                   // C
  'Reviewer Name',           // D (team member conducting the tasting)
  'Guest Name',              // E (host)
  'Phone',                   // F
  'Company',                 // G
  'Tasting Date',            // H (date of tasting — usually day of/before party)
  'Event Date',              // I (actual party date)
  'Package Type',            // J
  'Overall Rating',          // K (1-5)
  'Overall Comment',         // L
  'Food Quality Rating',     // M (1-5)
  'Starters Item Ratings',   // N (JSON)
  'Main Course Item Ratings',// O (JSON)
  'Sides Item Ratings',      // P (JSON)
  'Dessert Item Ratings',    // Q (JSON)
  'Addon Item Ratings',      // R (JSON)
  'Beverages Rating',        // S (1-5)
  'Beverages Comment',       // T
  'Items to Change',         // U (free text — additions/removals flagged)
  'Complaint',               // V
  'Suggestion',              // W
  'Submitted At',            // X
  'Submitted By',            // Y
];

const PRE_TASTING_COLUMN_MAP = {};
PRE_TASTING_COLUMNS.forEach((name, idx) => { PRE_TASTING_COLUMN_MAP[name] = idx; });

const PRE_TASTING_JSON_FIELDS = [
  'Starters Item Ratings', 'Main Course Item Ratings',
  'Sides Item Ratings', 'Dessert Item Ratings',
  'Addon Item Ratings',
];

function generatePreTastingId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PT-${dateStr}-${rand}`;
}

async function ensurePreTastingSheet() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const exists = meta.data.sheets.some((s) => s.properties.title === SHEET_NAMES.PRE_TASTING);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAMES.PRE_TASTING } } }] },
      });
      const endCol = indexToColumnLetter(PRE_TASTING_COLUMNS.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAMES.PRE_TASTING}'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [PRE_TASTING_COLUMNS] },
      });
      console.log('Pre-Tasting: Created sheet with header row.');
    }
  });
}

async function getAllPreTastingRows() {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const endCol = indexToColumnLetter(PRE_TASTING_COLUMNS.length - 1);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.PRE_TASTING}'!A2:${endCol}`,
    });
    const rows = res.data.values || [];
    return rows.map((row, idx) => {
      const obj = { _rowIndex: idx + 2 };
      PRE_TASTING_COLUMNS.forEach((col, i) => {
        let val = row[i] || '';
        if (PRE_TASTING_JSON_FIELDS.includes(col) && val) {
          try { val = JSON.parse(val); } catch { /* keep string */ }
        }
        obj[col] = val;
      });
      return obj;
    });
  });
}

async function appendPreTastingRow(data) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const values = PRE_TASTING_COLUMNS.map((col) => {
      let val = data[col] ?? '';
      if (PRE_TASTING_JSON_FIELDS.includes(col) && typeof val !== 'string') {
        val = JSON.stringify(val);
      }
      return val;
    });
    const endCol = indexToColumnLetter(PRE_TASTING_COLUMNS.length - 1);
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.PRE_TASTING}'!A:${endCol}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
    const updatedRange = res.data.updates?.updatedRange || '';
    const match = updatedRange.match(/!A(\d+):/);
    const rowIndex = match ? parseInt(match[1]) : -1;
    return { ...data, _rowIndex: rowIndex };
  });
}

async function getPreTastingRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const endCol = indexToColumnLetter(PRE_TASTING_COLUMNS.length - 1);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `'${SHEET_NAMES.PRE_TASTING}'!A${rowIndex}:${endCol}${rowIndex}`,
    });
    const row = (res.data.values || [])[0];
    if (!row) return null;
    const obj = { _rowIndex: rowIndex };
    PRE_TASTING_COLUMNS.forEach((col, i) => {
      let val = row[i] || '';
      if (PRE_TASTING_JSON_FIELDS.includes(col) && val) {
        try { val = JSON.parse(val); } catch { /* keep string */ }
      }
      obj[col] = val;
    });
    return obj;
  });
}

// ===========================================================================
// GUEST CONTACTS SHEET
// ===========================================================================
const GUEST_CONTACT_COLUMNS = [
  'Party Unique ID',       // A - Link to party
  'Party Date',            // B - Auto-fetched from party
  'Host Name',             // C - Auto-fetched from party
  'Company',               // D - Auto-fetched from party
  'Guest Name',            // E - Entered by GRE
  'Guest Phone',           // F - Entered by GRE
  'Entered By',            // G - Who entered this record
  'Entered At',            // H - Timestamp
];

const GUEST_CONTACT_COLUMN_MAP = {};
GUEST_CONTACT_COLUMNS.forEach((name, idx) => { GUEST_CONTACT_COLUMN_MAP[name] = idx; });

function generateContactId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GC-${ts}-${rand}`;
}

/**
 * Get the Guest Contacts spreadsheet ID (separate Google Sheet).
 * Falls back to main sheet if GUEST_CONTACTS_SHEET_ID is not set.
 */
function getGuestContactsSheetId() {
  const id = GUEST_CONTACTS_SHEET_ID;
  if (!id) throw new Error('GUEST_CONTACTS_SHEET_ID environment variable is not set. Create a new Google Sheet for Guest Contacts and add its ID to .env');
  return id;
}

const GUEST_CONTACTS_TAB = 'Guest Contacts';
let _guestContactsSheetVerified = false;

async function ensureGuestContactsSheet() {
  if (_guestContactsSheetVerified) return;
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getGuestContactsSheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const sheetTitles = meta.data.sheets.map((s) => s.properties.title);

    // Check if our tab exists; if not, rename Sheet1 or create it
    if (!sheetTitles.includes(GUEST_CONTACTS_TAB)) {
      if (sheetTitles.length === 1) {
        // Rename the default first sheet
        const firstSheetId = meta.data.sheets[0].properties.sheetId;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: firstSheetId, title: GUEST_CONTACTS_TAB },
                fields: 'title',
              },
            }],
          },
        });
      } else {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              { addSheet: { properties: { title: GUEST_CONTACTS_TAB, gridProperties: { columnCount: Math.max(GUEST_CONTACT_COLUMNS.length, 26) } } } },
            ],
          },
        });
      }
    }

    // Ensure header row exists and matches current columns
    const endCol = indexToColumnLetter(GUEST_CONTACT_COLUMNS.length - 1);
    // Read wider range to detect old headers (up to column L = 12 cols)
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${GUEST_CONTACTS_TAB}'!A1:L1`,
    });
    const header = (headerRes.data.values && headerRes.data.values[0]) || [];
    const headerMatches = header.length === GUEST_CONTACT_COLUMNS.length &&
      GUEST_CONTACT_COLUMNS.every((col, i) => header[i] === col);

    if (!headerMatches) {
      // Detect old 12-column format and migrate data
      const OLD_COLUMNS = ['Contact ID', 'Party Unique ID', 'Party Date', 'Host Name', 'Company', 'Place', 'Guest Name', 'Guest Phone', 'Guest Email', 'Notes', 'Entered By', 'Entered At'];
      const isOldFormat = header.length >= 12 && header[0] === 'Contact ID' && header[1] === 'Party Unique ID';

      if (isOldFormat) {
        console.log('Guest Contacts: Detected old 12-column format. Migrating data...');
        // Read all existing data (old format: A-L)
        const dataRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${GUEST_CONTACTS_TAB}'!A2:L`,
        });
        const oldRows = dataRes.data.values || [];

        // Map old columns to new columns
        // Old: Contact ID(0), Party Unique ID(1), Party Date(2), Host Name(3), Company(4), Place(5), Guest Name(6), Guest Phone(7), Guest Email(8), Notes(9), Entered By(10), Entered At(11)
        // New: Party Unique ID(0), Party Date(1), Host Name(2), Company(3), Guest Name(4), Guest Phone(5), Entered By(6), Entered At(7)
        const migratedRows = oldRows.map((row) => [
          row[1] || '',  // Party Unique ID (was col 1)
          row[2] || '',  // Party Date (was col 2)
          row[3] || '',  // Host Name (was col 3)
          row[4] || '',  // Company (was col 4)
          row[6] || '',  // Guest Name (was col 6)
          row[7] || '',  // Guest Phone (was col 7)
          row[10] || '', // Entered By (was col 10)
          row[11] || '', // Entered At (was col 11)
        ]);

        // Clear the entire sheet first (old data + old header)
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `'${GUEST_CONTACTS_TAB}'!A1:L`,
        });

        // Write new header
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${GUEST_CONTACTS_TAB}'!A1:${endCol}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [GUEST_CONTACT_COLUMNS] },
        });

        // Write migrated data if any
        if (migratedRows.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${GUEST_CONTACTS_TAB}'!A2:${endCol}${migratedRows.length + 1}`,
            valueInputOption: 'RAW',
            requestBody: { values: migratedRows },
          });
        }
        console.log(`Guest Contacts: Migrated ${migratedRows.length} rows from old format to new 8-column format.`);
      } else {
        // Not old format, just write/update header
        // Clear any extra columns beyond our range first
        if (header.length > GUEST_CONTACT_COLUMNS.length) {
          const oldEndCol = indexToColumnLetter(header.length - 1);
          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${GUEST_CONTACTS_TAB}'!A1:${oldEndCol}1`,
          });
        }
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${GUEST_CONTACTS_TAB}'!A1:${endCol}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [GUEST_CONTACT_COLUMNS] },
        });
        console.log('Guest Contacts: Header row created/updated in separate sheet.');
      }
    }
    _guestContactsSheetVerified = true;
  });
}

async function getAllGuestContactRows() {
  return withRetry(async () => {
    const endCol = indexToColumnLetter(GUEST_CONTACT_COLUMNS.length - 1);
    const res = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId: getGuestContactsSheetId(),
      range: `'${GUEST_CONTACTS_TAB}'!A2:${endCol}`,
    });
    const rows = res.data.values || [];
    return rows.map((row, idx) => {
      const obj = {};
      GUEST_CONTACT_COLUMNS.forEach((col, i) => {
        obj[col] = row[i] || '';
      });
      obj._rowIndex = idx + 2;
      return obj;
    });
  });
}

async function appendGuestContactRow(data) {
  return withRetry(async () => {
    const values = GUEST_CONTACT_COLUMNS.map((col) => {
      const val = data[col];
      return val !== undefined && val !== null ? String(val) : '';
    });
    const endCol = indexToColumnLetter(GUEST_CONTACT_COLUMNS.length - 1);
    await getSheetsClient().spreadsheets.values.append({
      spreadsheetId: getGuestContactsSheetId(),
      range: `'${GUEST_CONTACTS_TAB}'!A:${endCol}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [values] },
    });
  });
}

async function updateGuestContactRow(rowIndex, data) {
  return withRetry(async () => {
    const values = GUEST_CONTACT_COLUMNS.map((col) => {
      const val = data[col];
      return val !== undefined && val !== null ? String(val) : '';
    });
    const endCol = indexToColumnLetter(GUEST_CONTACT_COLUMNS.length - 1);
    await getSheetsClient().spreadsheets.values.update({
      spreadsheetId: getGuestContactsSheetId(),
      range: `'${GUEST_CONTACTS_TAB}'!A${rowIndex}:${endCol}${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });
  });
}

async function deleteGuestContactRow(rowIndex) {
  return withRetry(async () => {
    const sheets = getSheetsClient();
    const spreadsheetId = getGuestContactsSheetId();
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
    const sheet = meta.data.sheets.find((s) => s.properties.title === GUEST_CONTACTS_TAB);
    if (!sheet) throw new Error('Guest Contacts tab not found');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        }],
      },
    });
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
  // F&P Records
  FP_COLUMNS,
  FP_COLUMN_MAP,
  generateFpId,
  ensureFpSheet,
  getAllFpRows,
  getFpRow,
  appendFpRow,
  updateFpRow,
  deleteFpRow,
  // Edit History
  EDIT_HISTORY_COLUMNS,
  ensureEditHistorySheet,
  appendEditHistory,
  getEditHistoryByParty,
  // Feedback
  FEEDBACK_COLUMNS,
  FEEDBACK_COLUMN_MAP,
  generateFeedbackId,
  ensureFeedbackSheet,
  getAllFeedbackRows,
  appendFeedbackRow,
  getFeedbackRow,
  // Pre-Tasting
  PRE_TASTING_COLUMNS,
  PRE_TASTING_COLUMN_MAP,
  generatePreTastingId,
  ensurePreTastingSheet,
  getAllPreTastingRows,
  appendPreTastingRow,
  getPreTastingRow,
  // Guest Contacts
  GUEST_CONTACT_COLUMNS,
  GUEST_CONTACT_COLUMN_MAP,
  generateContactId,
  ensureGuestContactsSheet,
  getAllGuestContactRows,
  appendGuestContactRow,
  updateGuestContactRow,
  deleteGuestContactRow,
  // Attendance Log
  ensureAttendanceSheet,
  syncAttendanceLog,
};

// ---------------------------------------------------------------------------
// Attendance Log — Separate Google Sheet
// ---------------------------------------------------------------------------

const ATTENDANCE_TAB = 'Attendance Log';
const ATTENDANCE_COLUMNS = [
  'Party ID',
  'Event Date',
  'Host Name',
  'Company',
  'Guest Name',
  'Phone',
  'Email',
  'Plus Ones',
  'Invite Sent',
  'Checked In',
  'Checked In At',
  'Checked In By',
  'Synced At',
];
const ATTENDANCE_LAST_COL = indexToColumnLetter(ATTENDANCE_COLUMNS.length - 1);

function getAttendanceSheetId() {
  return process.env.ATTENDANCE_SHEET_ID || process.env.GOOGLE_SHEETS_ID;
}

let _attendanceSheetVerified = false;

async function ensureAttendanceSheet() {
  if (_attendanceSheetVerified) return;
  const sheetId = getAttendanceSheetId();
  if (!sheetId) return;

  const sheets = getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${ATTENDANCE_TAB}'!A1:${ATTENDANCE_LAST_COL}1`,
    });
    const header = (res.data.values || [])[0] || [];
    if (header.length < ATTENDANCE_COLUMNS.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${ATTENDANCE_TAB}'!A1:${ATTENDANCE_LAST_COL}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [ATTENDANCE_COLUMNS] },
      });
    }
  } catch (err) {
    if (err.code === 400 || err.message?.includes('Unable to parse range')) {
      // Tab doesn't exist — create it
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: ATTENDANCE_TAB } } }],
          },
        });
      } catch (_) {}
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${ATTENDANCE_TAB}'!A1:${ATTENDANCE_LAST_COL}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [ATTENDANCE_COLUMNS] },
      });
    }
  }
  _attendanceSheetVerified = true;
}

/**
 * Sync attendance data to the separate Attendance Log sheet.
 * Clears existing rows for the party and writes fresh data.
 */
async function syncAttendanceLog(partyId, partyInfo, guests) {
  const sheetId = getAttendanceSheetId();
  if (!sheetId) return;

  await ensureAttendanceSheet();
  const sheets = getSheetsClient();
  const syncedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Read all existing rows to find and clear old entries for this party
  let existingRows = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${ATTENDANCE_TAB}'!A2:${ATTENDANCE_LAST_COL}`,
    });
    existingRows = res.data.values || [];
  } catch (_) {}

  // Find row indices to clear (0-based in existingRows, sheet row = index + 2)
  const rowsToClear = [];
  existingRows.forEach((row, i) => {
    if (row[0] === partyId) rowsToClear.push(i + 2); // sheet row number
  });

  // Clear old rows for this party (in reverse to avoid index shifting)
  if (rowsToClear.length > 0) {
    for (const rowNum of rowsToClear.reverse()) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `'${ATTENDANCE_TAB}'!A${rowNum}:${ATTENDANCE_LAST_COL}${rowNum}`,
      });
    }
  }

  // Build new rows
  const newRows = guests.map((g) => {
    let checkedInAt = '';
    if (g.checkedIn && g.checkedInAt) {
      if (typeof g.checkedInAt === 'string') {
        checkedInAt = new Date(g.checkedInAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      } else if (g.checkedInAt._seconds) {
        checkedInAt = new Date(g.checkedInAt._seconds * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      }
    }

    return [
      partyId,
      partyInfo.eventDate || '',
      partyInfo.hostName || '',
      partyInfo.company || '',
      g.name || '',
      g.phone || '',
      g.email || '',
      g.plusOnes || 0,
      g.inviteSent ? 'Yes' : 'No',
      g.checkedIn ? 'Yes' : 'No',
      checkedInAt,
      g.checkedInBy || '',
      syncedAt,
    ];
  });

  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${ATTENDANCE_TAB}'!A:${ATTENDANCE_LAST_COL}`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: newRows },
    });
  }
}
