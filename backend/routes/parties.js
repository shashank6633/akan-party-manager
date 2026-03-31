const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const sheetsService = require('../services/sheetsService');
const { applyAutoCalculations, calculatePaymentTotals, toCamelCase, toSheetFormat } = require('../utils/calculations');
const emailService = require('../services/emailService');

const router = express.Router();

// All party routes require authentication
router.use(authenticate);

// Helper: convert camelCase request body to sheet column names (called after validation)
function convertBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = toSheetFormat(req.body, sheetsService.COLUMNS);
  }
}

// Valid statuses (flow: Enquiry → Contacted → Tentative → Confirmed → Cancelled)
const VALID_STATUSES = ['Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'];

/**
 * Role-based field restrictions.
 * Defines which columns each role is allowed to update.
 */
const ROLE_EDITABLE_FIELDS = {
  GRE: [
    'Date',
    'Host Name',
    'Phone Number',
    'Company',
    'Guest Visited',
    'Status',
    'Place',
    'Meal Type',
    'Expected Pax',
    'Remarks',
    'Occasion Type',
    'Special Requirements',
    'Alt Contact',
    'Handled By',
  ],
  CASHIER: [
    'Confirmed Pax',
    'Final Rate',
    'Final Total Amount',
    'Payment Log',
    'Payment Status',
    'Total Advance Paid',
    'Total Paid',
    'Total Amount Paid',
    'Due Amount',
    'Bill Order ID',
    'Balance Payment Date',
    'Guest Email',
  ],
  ACCOUNTS: [
    'Final Total Amount',
    'Total Amount Paid',
    'Due Amount',
    'Payment Status',
    'Balance Payment Date',
    'Bill Order ID',
  ],
  SALES: [
    'Date',
    'Host Name',
    'Phone Number',
    'Company',
    'Guest Visited',
    'Status',
    'Place',
    'Meal Type',
    'Expected Pax',
    'Remarks',
    'Occasion Type',
    'Handled By',
    'Package Selected',
    'Special Requirements',
    'FP Issued',
    'Lost Reason',
    'Approx Bill Amount',
    'Approx Balance Amount',
    'Confirmed Pax',
    'Final Rate',
    'Payment Log',
    'Payment Status',
    'Total Advance Paid',
    'Total Paid',
    'Total Amount Paid',
    'Due Amount',
    'Follow Up Notes',
    'Last Follow Up Date',
    'Alt Contact',
    'Guest Email',
    'Balance Payment Date',
    'Bill Order ID',
  ],
  MANAGER: '__ALL__',
  ADMIN: '__ALL__',
};

/**
 * Filter data object to only include fields the user's role can edit.
 * Returns { allowed: {...}, denied: [...] }
 */
function filterByRole(role, data) {
  const fields = ROLE_EDITABLE_FIELDS[role.toUpperCase()];
  if (fields === '__ALL__') {
    return { allowed: data, denied: [] };
  }

  const allowed = {};
  const denied = [];
  Object.keys(data).forEach((key) => {
    if (key.startsWith('_')) return; // skip internal fields
    if (fields.includes(key)) {
      allowed[key] = data[key];
    } else {
      denied.push(key);
    }
  });
  return { allowed, denied };
}

// ---------------------------------------------------------------------------
// GET /api/parties - List parties with filtering
// ---------------------------------------------------------------------------
router.get(
  '/',
  [
    query('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status filter'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid dateFrom format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid dateTo format'),
    query('search').optional().isString(),
    query('partyType').optional().isString(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be 1-500'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { status, dateFrom, dateTo, search, partyType, page = 1, limit = 50 } = req.query;

      let rows = await sheetsService.getAllRows();

      // CASHIER and ACCOUNTS can only see Confirmed parties
      const userRole = req.user?.role?.toUpperCase();
      if (userRole === 'CASHIER' || userRole === 'ACCOUNTS') {
        rows = rows.filter((r) => r['Status'] === 'Confirmed');
      }

      // Apply filters
      if (status) {
        rows = rows.filter((r) => r['Status'] === status);
      }

      if (dateFrom) {
        rows = rows.filter((r) => {
          const d = normalizeDate(r['Date']);
          return d >= dateFrom;
        });
      }

      if (dateTo) {
        rows = rows.filter((r) => {
          const d = normalizeDate(r['Date']);
          return d && d <= dateTo;
        });
      }

      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r['Host Name'] || '').toLowerCase().includes(s) ||
            (r['Phone Number'] || '').toLowerCase().includes(s) ||
            (r['Company'] || '').toLowerCase().includes(s) ||
            (r['Place'] || '').toLowerCase().includes(s) ||
            (r['Unique ID'] || '').toLowerCase().includes(s)
        );
      }

      if (partyType) {
        const pt = partyType.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r['Occasion Type'] || '').toLowerCase().includes(pt) ||
            (r['Package Selected'] || '').toLowerCase().includes(pt) ||
            (r['Company'] || '').toLowerCase().includes(pt) ||
            (r['Host Name'] || '').toLowerCase().includes(pt)
        );
      }

      // Pagination
      const total = rows.length;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIdx = (pageNum - 1) * limitNum;
      const paginated = rows.slice(startIdx, startIdx + limitNum);

      res.json({
        success: true,
        parties: paginated.map(toCamelCase),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (err) {
      console.error('List parties error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch parties.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/parties/lookup/:uniqueId - Lookup party by Unique ID (for Cashier)
// ---------------------------------------------------------------------------
router.get(
  '/lookup/:uniqueId',
  async (req, res) => {
    try {
      const uniqueId = req.params.uniqueId.trim().toUpperCase();
      const rows = await sheetsService.getAllRows();
      const match = rows.find((r) => (r['Unique ID'] || '').trim().toUpperCase() === uniqueId);

      if (!match) {
        return res.status(404).json({ success: false, message: 'No party found with this Unique ID.' });
      }

      // Check for duplicates (same Phone Number + Date)
      const phone = match['Phone Number'];
      const date = match['Date'];
      let duplicateWarning = null;
      if (phone && date) {
        const dupes = rows.filter(
          (r) =>
            r['Phone Number'] === phone &&
            normalizeDate(r['Date']) === normalizeDate(date) &&
            (r['Unique ID'] || '').trim().toUpperCase() !== uniqueId
        );
        if (dupes.length > 0) {
          duplicateWarning = `Warning: ${dupes.length} other party(ies) found with same Phone Number (${phone}) and Date (${date}).`;
        }
      }

      res.json({
        success: true,
        data: toCamelCase(match),
        duplicateWarning,
      });
    } catch (err) {
      console.error('Lookup party error:', err);
      res.status(500).json({ success: false, message: 'Failed to lookup party.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/parties/stats - Dashboard statistics
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    let rows = await sheetsService.getAllRows();

    // CASHIER only sees confirmed party stats
    const userRole = req.user?.role?.toUpperCase();
    if (userRole === 'CASHIER') {
      rows = rows.filter((r) => r['Status'] === 'Confirmed');
    }

    // Date range filtering for stats
    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      rows = rows.filter((r) => {
        const nd = normalizeDate(r['Date']);
        if (!nd) return false;
        if (dateFrom && nd < dateFrom) return false;
        if (dateTo && nd > dateTo) return false;
        return true;
      });
    }

    const knownStatuses = ['Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'];
    const getStatus = (r) => (r['Status'] || '').trim();
    const stats = {
      totalEnquiries: rows.length,
      confirmed: rows.filter((r) => getStatus(r) === 'Confirmed').length,
      tentative: rows.filter((r) => getStatus(r) === 'Tentative').length,
      cancelled: rows.filter((r) => getStatus(r) === 'Cancelled').length,
      enquiry: rows.filter((r) => getStatus(r) === 'Enquiry').length,
      contacted: rows.filter((r) => getStatus(r) === 'Contacted').length,
      unknown: rows.filter((r) => { const s = getStatus(r); return !s || !knownStatuses.includes(s); }).length,
      totalRevenue: rows.reduce((sum, r) => sum + (parseFloat(r['Final Total Amount']) || 0), 0),
      totalAdvance: rows.reduce(
        (sum, r) => sum + (parseFloat(r['Total Advance Paid']) || 0),
        0
      ),
      pendingDues: rows.reduce((sum, r) => sum + (parseFloat(r['Due Amount']) || 0), 0),
      totalEstimatedRevenue: rows
        .filter((r) => r['Status'] === 'Confirmed')
        .reduce((sum, r) => sum + (parseFloat(r['Final Total Amount']) || 0), 0),
      // Today's stats
      todayEnquiries: rows.filter((r) => normalizeDate(r['Date']) === todayStr()).length,
      todayConfirmed: rows.filter(
        (r) => normalizeDate(r['Date']) === todayStr() && r['Status'] === 'Confirmed'
      ).length,
    };

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/parties/pending-followups - Parties needing follow-up (SALES/MANAGER)
// Must be before /:id to avoid route conflict
// ---------------------------------------------------------------------------
router.get(
  '/pending-followups',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const rows = await sheetsService.getAllRows();
      const today = todayStr();

      const todayDate = new Date(today);

      const pending = rows.filter((r) => {
        const status = (r['Status'] || '').trim();
        const partyDate = normalizeDate(r['Date']);

        // Rule 1: Confirmed parties — show if party is within 2 days AND FP not issued
        if (status === 'Confirmed') {
          if (!partyDate) return false;
          const pDate = new Date(partyDate);
          const daysUntilParty = Math.floor((pDate - todayDate) / (1000 * 60 * 60 * 24));
          if (daysUntilParty < 0) return false; // past parties excluded
          if (daysUntilParty > 3) return false; // more than 3 days away
          const fpIssued = (r['FP Issued'] || '').trim().toLowerCase();
          return fpIssued !== 'yes'; // only show if FP not issued
        }

        // Rule 2: Enquiry/Contacted/Tentative — follow-up needed
        if (status !== 'Enquiry' && status !== 'Contacted' && status !== 'Tentative') return false;

        // Only show parties with tomorrow or future dates
        if (!partyDate || partyDate <= today) return false;

        const lastFollowUp = r['Last Follow Up Date'];
        if (!lastFollowUp) return true;

        const lastDate = new Date(lastFollowUp);
        const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        return diffDays >= 2;
      });

      // Sort by date ascending (nearest first)
      pending.sort((a, b) => {
        const dA = normalizeDate(a['Date']) || '9999-12-31';
        const dB = normalizeDate(b['Date']) || '9999-12-31';
        return dA.localeCompare(dB);
      });

      // Add fpAlert flag for confirmed parties needing FP
      const mapped = pending.map((r) => {
        const obj = toCamelCase(r);
        if ((r['Status'] || '').trim() === 'Confirmed') {
          obj._fpAlert = true;
        }
        return obj;
      });

      res.json({
        success: true,
        parties: mapped,
        total: mapped.length,
      });
    } catch (err) {
      console.error('Pending followups error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch pending follow-ups.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/parties/reminder-log - Get payment reminder log
// ---------------------------------------------------------------------------
router.get(
  '/reminder-log',
  roleCheck(ROLES.SALES, ROLES.MANAGER, ROLES.ADMIN),
  async (req, res) => {
    try {
      const logs = await sheetsService.getReminderLogs();
      res.json({ success: true, data: logs.reverse() }); // newest first
    } catch (err) {
      console.error('Reminder log error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch reminder log.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/parties/:id - Get single party by row index
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  [param('id').isInt({ min: 2 }).withMessage('Invalid party ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);
      const party = await sheetsService.getRow(rowIndex);

      if (!party) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      res.json(toCamelCase(party));
    } catch (err) {
      console.error('Get party error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch party.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/parties - Create new party (GRE and above)
// ---------------------------------------------------------------------------
router.post(
  '/',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  [
    body('date').trim().notEmpty().withMessage('Date is required'),
    // date can be YYYY-MM-DD or "TBC: Month Year" for unconfirmed dates
    body('hostName').trim().notEmpty().withMessage('Host Name is required'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone Number is required'),
    body('company').trim().notEmpty().withMessage('Company Name is required'),
    body('status')
      .optional()
      .isIn(VALID_STATUSES)
      .withMessage('Invalid status'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      convertBody(req);
      const data = extractPartyData(req.body);

      // Auto-generate Unique ID
      data['Unique ID'] = sheetsService.generateUniqueId();

      // Default status to Enquiry if not provided
      if (!data['Status']) {
        data['Status'] = 'Enquiry';
      }

      // Timestamp when enquiry was created (for stale alert tracking)
      data['Enquired At'] = new Date().toISOString();

      // Check for duplicates (same phone + date)
      const duplicates = await sheetsService.findDuplicates(
        data['Phone Number'],
        data['Date']
      );
      if (duplicates.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate entry: A party with this phone number and date already exists.',
          existing: duplicates[0],
        });
      }

      // Apply auto-calculations
      applyAutoCalculations(data);

      // Write to sheet
      const result = await sheetsService.appendRow(data);

      // Send notification (non-blocking)
      emailService.sendNewPartyNotification(data).catch((err) => {
        console.error('Failed to send new party notification:', err.message);
      });

      // In-app notification
      if (req.app.locals.addNotification) {
        req.app.locals.addNotification(
          'new_enquiry',
          `New enquiry: "${data['Host Name']}" for ${data['Date']}`,
          result._rowIndex,
          'info'
        );
      }

      res.status(201).json({
        success: true,
        message: 'Party created successfully.',
        data: toCamelCase(result),
      });
    } catch (err) {
      console.error('Create party error:', err);
      res.status(500).json({ success: false, message: 'Failed to create party.' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/parties/:id - Update party (role-based field restrictions)
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  roleCheck(ROLES.GRE, ROLES.CASHIER, ROLES.SALES, ROLES.MANAGER),
  [param('id').isInt({ min: 2 }).withMessage('Invalid party ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      convertBody(req);
      const rowIndex = parseInt(req.params.id, 10);
      const userRole = req.user.role.toUpperCase();

      // Verify row exists
      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      const data = extractPartyData(req.body);

      // Apply role-based field filtering
      const { allowed, denied } = filterByRole(userRole, data);

      if (Object.keys(allowed).length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update any of the provided fields.',
          deniedFields: denied,
        });
      }

      // Auto-append current user's name to "Handled By" if not already present
      const currentUserName = req.user.name || req.user.username;
      if (currentUserName) {
        const existingHandledBy = existing['Handled By'] || '';
        const handlers = existingHandledBy.split(',').map(h => h.trim()).filter(Boolean);
        if (!handlers.some(h => h.toLowerCase() === currentUserName.toLowerCase())) {
          handlers.push(currentUserName);
          allowed['Handled By'] = handlers.join(', ');
        }
      }

      // Merge with existing data for auto-calculations
      const merged = { ...existing, ...allowed };
      applyAutoCalculations(merged);

      // Only update the fields that changed plus auto-calculated fields
      const updateData = { ...allowed };
      // Auto-calculate Day if Date changed
      if (allowed['Date']) {
        updateData['Day'] = getDayFromDate(allowed['Date']);
      }
      // Include auto-calculated fields
      ['Final Total Amount', 'Total Advance Paid', 'Total Paid', 'Total Amount Paid', 'Due Amount'].forEach(
        (field) => {
          if (merged[field] !== undefined) {
            updateData[field] = merged[field];
          }
        }
      );

      const result = await sheetsService.updateRow(rowIndex, updateData);

      res.json({
        success: true,
        message: 'Party updated successfully.',
        data: toCamelCase(result),
        ...(denied.length > 0 && {
          warning: `The following fields were skipped due to role restrictions: ${denied.join(', ')}`,
        }),
      });
    } catch (err) {
      console.error('Update party error:', err);
      res.status(500).json({ success: false, message: 'Failed to update party.' });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/parties/:id - Delete party (ADMIN only)
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  roleCheck(ROLES.ADMIN),
  [param('id').isInt({ min: 2 }).withMessage('Invalid party ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);

      // Verify row exists
      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      await sheetsService.deleteRow(rowIndex);

      res.json({
        success: true,
        message: 'Party deleted successfully.',
      });
    } catch (err) {
      console.error('Delete party error:', err);
      res.status(500).json({ success: false, message: 'Failed to delete party.' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/parties/:id/status - Quick status change with notifications
// ---------------------------------------------------------------------------
router.put(
  '/:id/status',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  [
    param('id').isInt({ min: 2 }).withMessage('Invalid party ID'),
    body('status').isIn(VALID_STATUSES).withMessage('Invalid status value'),
    body('lostReason')
      .optional()
      .isString()
      .withMessage('Lost Reason must be a string'),
    body('followUpNote')
      .optional()
      .isString()
      .withMessage('Follow-up note must be a string'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);
      const status = req.body.status || req.body.Status;
      const lostReason = req.body.lostReason || req.body['Lost Reason'];

      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      const oldStatus = existing['Status'];
      const updateData = { Status: status };

      // Auto-update Follow-up Tracking when status changes from Enquiry to Contacted/Tentative
      if (oldStatus === 'Enquiry' && (status === 'Contacted' || status === 'Tentative')) {
        const userName = req.user.name || req.user.username;
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
        const followUpNote = req.body.followUpNote || req.body['Follow Up Note'] || '';
        const noteText = followUpNote ? followUpNote : 'Call follow-up';
        const autoNote = `[${timestamp} - ${userName}] Status: ${oldStatus} → ${status} | ${noteText}`;
        const existingNotes = existing['Follow Up Notes'] || '';
        updateData['Follow Up Notes'] = existingNotes ? `${autoNote}\n${existingNotes}` : autoNote;
        updateData['Last Follow Up Date'] = new Date().toISOString().split('T')[0];
      }

      // If cancelled, Lost Reason is REQUIRED and auto-fill Cancelled Date
      if (status === 'Cancelled') {
        if (!lostReason || !lostReason.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Lost Reason is required when cancelling a party.',
          });
        }
        updateData['Cancelled Date'] = new Date().toISOString().split('T')[0];
        updateData['Lost Reason'] = lostReason;
      }

      const result = await sheetsService.updateRow(rowIndex, updateData);

      // Send notifications (non-blocking)
      if (oldStatus !== status) {
        emailService
          .sendStatusChangeNotification(result, oldStatus, status)
          .catch((err) => {
            console.error('Status change notification failed:', err.message);
          });

        if (status === 'Cancelled') {
          emailService.sendCancellationNotification(result).catch((err) => {
            console.error('Cancellation notification failed:', err.message);
          });
        }

        // In-app notification
        if (req.app.locals.addNotification) {
          req.app.locals.addNotification(
            'status_change',
            `${result['Host Name']}: ${oldStatus} → ${status}`,
            rowIndex,
            status === 'Confirmed' ? 'info' : status === 'Cancelled' ? 'error' : 'warning'
          );
        }
      }

      res.json({
        success: true,
        message: `Status updated from ${oldStatus} to ${status}.`,
        data: toCamelCase(result),
      });
    } catch (err) {
      console.error('Status change error:', err);
      res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/parties/:id/payment - Add payment entry to Payment Log
// Supports MULTIPLE entries (appends, not overwrites)
// ---------------------------------------------------------------------------
router.put(
  '/:id/payment',
  roleCheck(ROLES.CASHIER, ROLES.SALES, ROLES.MANAGER),
  [
    param('id').isInt({ min: 2 }).withMessage('Invalid party ID'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    body('type')
      .isIn(['advance', 'payment'])
      .withMessage('Type must be "advance" or "payment"'),
    body('method')
      .optional()
      .isString()
      .withMessage('Invalid payment method'),
    body('note').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);
      const { amount, type, method, note } = req.body;

      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      // Parse existing Payment Log
      let paymentLog = [];
      try {
        if (existing['Payment Log']) {
          paymentLog = JSON.parse(existing['Payment Log']);
        }
        if (!Array.isArray(paymentLog)) paymentLog = [];
      } catch {
        paymentLog = [];
      }

      // Append new entry
      const newEntry = {
        amount: parseFloat(amount),
        type: type || 'payment',
        method: method || 'cash',
        note: note || '',
        date: new Date().toISOString(),
        recordedBy: req.user.name || req.user.username,
      };
      paymentLog.push(newEntry);

      const updateData = {
        'Payment Log': JSON.stringify(paymentLog),
      };

      // Recalculate payment totals
      const totals = calculatePaymentTotals(updateData['Payment Log']);
      updateData['Total Advance Paid'] = totals.totalAdvancePaid;
      updateData['Total Paid'] = totals.totalPaid;
      updateData['Total Amount Paid'] = totals.totalAmountPaid;

      // Due Amount = Final Total - Total Amount Paid
      const finalTotal = parseFloat(existing['Final Total Amount']) || 0;
      updateData['Due Amount'] = Math.max(0, finalTotal - totals.totalAmountPaid);

      // Auto-set Payment Status
      if (totals.totalAmountPaid <= 0) {
        updateData['Payment Status'] = 'Unpaid';
      } else if (finalTotal > 0 && totals.totalAmountPaid >= finalTotal) {
        updateData['Payment Status'] = 'Paid';
      } else {
        updateData['Payment Status'] = 'Partial';
      }

      // Business rule: if advance is paid, auto-confirm the party
      const oldStatus = existing['Status'];
      if (type === 'advance' && parseFloat(amount) > 0 && oldStatus !== 'Confirmed' && oldStatus !== 'Cancelled') {
        updateData['Status'] = 'Confirmed';
      }

      const result = await sheetsService.updateRow(rowIndex, updateData);

      // Send status change notification if auto-confirmed
      if (updateData['Status'] === 'Confirmed' && oldStatus !== 'Confirmed') {
        emailService.sendStatusChangeNotification(result, oldStatus, 'Confirmed').catch((err) => {
          console.error('Auto-confirm notification failed:', err.message);
        });
      }

      // Cashier billing update → notify Manager & Admin
      emailService.sendBillingUpdateNotification(result, newEntry).catch((err) => {
        console.error('Billing update notification failed:', err.message);
      });

      res.json({
        success: true,
        message: updateData['Status'] === 'Confirmed'
          ? 'Payment added. Party auto-confirmed.'
          : 'Payment added successfully.',
        data: toCamelCase(result),
        paymentEntry: newEntry,
      });
    } catch (err) {
      console.error('Payment entry error:', err);
      res.status(500).json({ success: false, message: 'Failed to add payment.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/parties/:id/payments - Get payment log for a party
// ---------------------------------------------------------------------------
router.get(
  '/:id/payments',
  roleCheck(ROLES.CASHIER, ROLES.SALES, ROLES.MANAGER),
  [param('id').isInt({ min: 2 }).withMessage('Invalid party ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);
      const party = await sheetsService.getRow(rowIndex);

      if (!party) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      let payments = [];
      try {
        if (party['Payment Log']) {
          payments = JSON.parse(party['Payment Log']);
        }
        if (!Array.isArray(payments)) payments = [];
      } catch {
        payments = [];
      }

      const totals = calculatePaymentTotals(party['Payment Log']);

      res.json({
        success: true,
        payments,
        totals: {
          ...totals,
          dueAmount: Math.max(0, (parseFloat(party['Final Total Amount']) || 0) - totals.totalAmountPaid),
        },
      });
    } catch (err) {
      console.error('Get payments error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch payments.' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/parties/:id/followup - Add follow-up note (SALES/MANAGER)
// ---------------------------------------------------------------------------
router.put(
  '/:id/followup',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  [
    param('id').isInt({ min: 2 }).withMessage('Invalid party ID'),
    body('note').trim().notEmpty().withMessage('Follow-up note is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);
      const { note } = req.body;

      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      const now = new Date().toISOString();
      const userName = req.user.name || req.user.username;
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
      const newNote = `[${timestamp} - ${userName}] ${note}`;

      // Prepend new note to existing notes
      const existingNotes = existing['Follow Up Notes'] || '';
      const allNotes = existingNotes ? `${newNote}\n${existingNotes}` : newNote;

      const updateData = {
        'Follow Up Notes': allNotes,
        'Last Follow Up Date': now.split('T')[0],
      };

      const result = await sheetsService.updateRow(rowIndex, updateData);

      res.json({
        success: true,
        message: 'Follow-up note added.',
        data: toCamelCase(result),
      });
    } catch (err) {
      console.error('Follow-up error:', err);
      res.status(500).json({ success: false, message: 'Failed to add follow-up.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/parties/:id/send-payment-reminder - Send payment reminder email to guest
// ---------------------------------------------------------------------------
router.post(
  '/:id/send-payment-reminder',
  roleCheck(ROLES.SALES, ROLES.MANAGER, ROLES.ADMIN),
  [param('id').isInt({ min: 2 }).withMessage('Invalid party ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const rowIndex = parseInt(req.params.id, 10);
      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Party not found.' });
      }

      const guestEmail = existing['Guest Email'];
      if (!guestEmail) {
        return res.status(400).json({ success: false, message: 'No guest email set for this party. Please add a Guest Email first.' });
      }

      const dueAmount = parseFloat(existing['Due Amount']) || 0;
      if (dueAmount <= 0) {
        return res.status(400).json({ success: false, message: 'No pending dues for this party.' });
      }

      await emailService.sendPaymentReminderToGuest(existing, 'manual', req.user.name || req.user.username);

      res.json({
        success: true,
        message: `Payment reminder sent to ${guestEmail}`,
      });
    } catch (err) {
      console.error('Send payment reminder error:', err);
      res.status(500).json({ success: false, message: 'Failed to send payment reminder email.' });
    }
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract only valid party columns from request body.
 */
function extractPartyData(body) {
  const data = {};
  sheetsService.COLUMNS.forEach((col) => {
    if (body[col] !== undefined) {
      data[col] = body[col];
    }
  });
  // Auto-calculate Day from Date
  if (data['Date']) {
    data['Day'] = getDayFromDate(data['Date']);
  }
  return data;
}

/**
 * Get day name (Monday, Tuesday, etc.) from a date string.
 * Handles YYYY-MM-DD and TBC dates.
 */
function getDayFromDate(dateStr) {
  if (!dateStr) return '';
  if (isTBCDate(dateStr)) return 'TBC';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return '';
  return days[parsed.getDay()];
}

/**
 * Check if a date string is a "TBC" (To Be Confirmed) date.
 */
function isTBCDate(dateStr) {
  return dateStr && dateStr.toString().trim().startsWith('TBC:');
}

/**
 * Normalize date to YYYY-MM-DD for filtering.
 * TBC dates return '' so they don't match exact date filters.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  if (isTBCDate(dateStr)) {
    // Parse TBC dates like "TBC: April 2026" → mid-month for range matching
    const match = dateStr.toString().match(/TBC:\s*(\w+)\s+(\d{4})/i);
    if (match) {
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const mIdx = months.indexOf(match[1].toLowerCase());
      if (mIdx !== -1) {
        return `${match[2]}-${String(mIdx + 1).padStart(2, '0')}-15`;
      }
    }
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr.toString().trim();
  return parsed.toISOString().split('T')[0];
}

/**
 * Today's date as YYYY-MM-DD.
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

module.exports = router;
