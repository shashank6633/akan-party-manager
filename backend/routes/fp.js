const express = require('express');
const { param, query, body, validationResult } = require('express-validator');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const sheetsService = require('../services/sheetsService');
const { columnToCamel, camelToColumn } = require('../utils/calculations');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

// All F&P routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helpers: camelCase <-> sheet column conversion for F&P
// ---------------------------------------------------------------------------

/**
 * Build a reverse map from camelCase keys to F&P column names.
 */
const fpCamelToColMap = {};
sheetsService.FP_COLUMNS.forEach((col) => {
  fpCamelToColMap[columnToCamel(col)] = col;
});

/**
 * Convert a camelCase-keyed object to F&P sheet column-keyed object.
 */
function fpToSheetFormat(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const col = fpCamelToColMap[key] || key;
    result[col] = val;
  }
  return result;
}

/**
 * Convert an F&P sheet-keyed object to camelCase for API response.
 */
function fpToCamelCase(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key === '_rowIndex' ? 'rowIndex' : columnToCamel(key)] = val;
  }
  return result;
}

/**
 * JSON array columns that should be parsed/stringified.
 */
const JSON_ARRAY_COLUMNS = [
  'Veg Starters', 'Non-Veg Starters', 'Veg Main Course', 'Non-Veg Main Course',
  'Rice', 'Dal', 'Salad', 'Accompaniments', 'Desserts',
  'Addon Mutton Starters', 'Addon Mutton Main Course',
  'Addon Prawns Starters', 'Addon Prawns Main Course', 'Addon Extras',
];

/**
 * Stringify any JSON array fields before writing to sheet.
 */
function stringifyJsonFields(data) {
  for (const col of JSON_ARRAY_COLUMNS) {
    if (data[col] !== undefined && data[col] !== null && typeof data[col] !== 'string') {
      data[col] = JSON.stringify(data[col]);
    }
  }
  return data;
}

/**
 * Parse JSON array fields when reading from sheet.
 */
function parseJsonFields(obj) {
  for (const col of JSON_ARRAY_COLUMNS) {
    const camelKey = columnToCamel(col);
    if (obj[camelKey] && typeof obj[camelKey] === 'string' && obj[camelKey].trim()) {
      try {
        obj[camelKey] = JSON.parse(obj[camelKey]);
      } catch {
        // Leave as string if not valid JSON
      }
    }
  }
  return obj;
}

/**
 * Auto-fill F&P data from a party booking record.
 * Maps party fields to F&P fields.
 */
function autoFillFromParty(party) {
  const mapping = {};
  if (party['Date']) mapping['Date of Event'] = party['Date'];
  if (party['Company']) mapping['Company'] = party['Company'];
  if (party['Host Name']) mapping['Contact Person'] = party['Host Name'];
  if (party['Phone Number']) mapping['Phone'] = party['Phone Number'];
  if (party['Expected Pax']) mapping['Pax Expected'] = party['Expected Pax'];
  // Use Final Rate if available, otherwise Approx Bill Amount
  if (party['Final Rate']) {
    mapping['Rate Per Head'] = party['Final Rate'];
  } else if (party['Approx Bill Amount']) {
    mapping['Rate Per Head'] = party['Approx Bill Amount'];
  }
  if (party['Package Selected']) mapping['Package Type'] = party['Package Selected'];
  if (party['Handled By']) mapping['Reference'] = party['Handled By'];
  if (party['Total Advance Paid']) mapping['Advance Payment'] = party['Total Advance Paid'];
  if (party['Place']) mapping['Allocated Area'] = party['Place'];
  if (party['Enquired At']) mapping['Date of Booking'] = party['Enquired At'];

  // Auto-calculate Day of Event from Date
  if (mapping['Date of Event'] && /^\d{4}-\d{2}-\d{2}$/.test(mapping['Date of Event'])) {
    const date = new Date(mapping['Date of Event'] + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    mapping['Day of Event'] = days[date.getDay()];
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/fp - List all F&P records
 * Optional query: ?partyId=<partyUniqueId>
 */
router.get(
  '/',
  [query('partyId').optional().isString()],
  async (req, res) => {
    try {
      let rows = await sheetsService.getAllFpRows();
      const { partyId } = req.query;
      if (partyId) {
        rows = rows.filter((r) => r['Party Unique ID'] === partyId);
      }
      const result = rows.map((r) => parseJsonFields(fpToCamelCase(r)));
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('GET /api/fp error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch F&P records.' });
    }
  }
);

/**
 * GET /api/fp/by-party/:partyUniqueId - Get all F&Ps for a specific party
 */
router.get(
  '/by-party/:partyUniqueId',
  [param('partyUniqueId').isString().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const rows = await sheetsService.getAllFpRows();
      const filtered = rows.filter((r) => r['Party Unique ID'] === req.params.partyUniqueId);
      const result = filtered.map((r) => parseJsonFields(fpToCamelCase(r)));
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('GET /api/fp/by-party error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch F&P records for party.' });
    }
  }
);

/**
 * GET /api/fp/:id - Get a single F&P record by row index
 */
router.get(
  '/:id',
  [param('id').isInt({ min: 2 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const row = await sheetsService.getFpRow(parseInt(req.params.id, 10));
      if (!row) {
        return res.status(404).json({ success: false, message: 'F&P record not found.' });
      }
      const result = parseJsonFields(fpToCamelCase(row));
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('GET /api/fp/:id error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to fetch F&P record.' });
    }
  }
);

/**
 * POST /api/fp - Create a new F&P record
 * Body: { partyUniqueId, ...overrides }
 * Auto-fills from party data, allows overrides.
 */
router.post(
  '/',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const body = req.body;
      const { partyUniqueId } = body;

      if (!partyUniqueId) {
        return res.status(400).json({ success: false, message: 'partyUniqueId is required.' });
      }

      // Look up the party by uniqueId
      const allParties = await sheetsService.getAllRows();
      const party = allParties.find((p) => p['Unique ID'] === partyUniqueId);
      if (!party) {
        return res.status(404).json({ success: false, message: `Party not found: ${partyUniqueId}` });
      }

      // Only allow F&P creation for Confirmed or Tentative parties
      const partyStatus = (party['Status'] || '').trim();
      if (!['Confirmed', 'Tentative'].includes(partyStatus)) {
        return res.status(400).json({
          success: false,
          message: `F&P can only be created for Confirmed or Tentative parties. Current status: ${partyStatus}`,
        });
      }

      // Auto-fill from party data
      const autoFilled = autoFillFromParty(party);

      // Convert camelCase body to sheet format (excluding partyUniqueId which is handled separately)
      const bodySheetFormat = fpToSheetFormat(body);
      delete bodySheetFormat.partyUniqueId; // Not a column name

      // Merge: auto-filled first, then body overrides
      const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const data = {
        ...autoFilled,
        ...bodySheetFormat,
        'Party Unique ID': partyUniqueId,
        'FP ID': sheetsService.generateFpId(),
        'Created At': now,
        'Updated At': now,
        'Created By': req.user.name || req.user.username,
        'Status': bodySheetFormat['Status'] || 'Draft',
        'FP Made By': bodySheetFormat['FP Made By'] || req.user.name || req.user.username,
      };

      // Stringify JSON array fields
      stringifyJsonFields(data);

      const result = await sheetsService.appendFpRow(data);

      // Set FP Issued to "Yes" on the party booking
      try {
        await sheetsService.updateRow(party._rowIndex, { 'FP Issued': 'Yes' });
      } catch (fpUpdateErr) {
        console.warn('Failed to set FP Issued on party:', fpUpdateErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'F&P record created.',
        data: parseJsonFields(fpToCamelCase(result)),
      });
    } catch (err) {
      console.error('POST /api/fp error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to create F&P record.' });
    }
  }
);

/**
 * PUT /api/fp/:id - Update an F&P record
 */
router.put(
  '/:id',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  [param('id').isInt({ min: 2 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const rowIndex = parseInt(req.params.id, 10);

      // Convert camelCase body to sheet format
      const bodySheetFormat = fpToSheetFormat(req.body);

      // Set Updated At timestamp
      const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      bodySheetFormat['Updated At'] = now;

      // Stringify JSON array fields
      stringifyJsonFields(bodySheetFormat);

      const result = await sheetsService.updateFpRow(rowIndex, bodySheetFormat);
      res.json({
        success: true,
        message: 'F&P record updated.',
        data: parseJsonFields(fpToCamelCase(result)),
      });
    } catch (err) {
      console.error('PUT /api/fp/:id error:', err.message);
      if (err.message.includes('not found')) {
        return res.status(404).json({ success: false, message: 'F&P record not found.' });
      }
      res.status(500).json({ success: false, message: 'Failed to update F&P record.' });
    }
  }
);

/**
 * DELETE /api/fp/:id - Delete an F&P record (ADMIN/MANAGER only)
 */
router.delete(
  '/:id',
  roleCheck(ROLES.MANAGER),
  [param('id').isInt({ min: 2 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const rowIndex = parseInt(req.params.id, 10);

      // Verify the row exists before deleting
      const existing = await sheetsService.getFpRow(rowIndex);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'F&P record not found.' });
      }

      await sheetsService.deleteFpRow(rowIndex);
      res.json({ success: true, message: 'F&P record deleted.' });
    } catch (err) {
      console.error('DELETE /api/fp/:id error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to delete F&P record.' });
    }
  }
);

/**
 * POST /api/fp/:id/send-email - Send F&P details via email
 * Body: { to: "email@example.com" }
 */
router.post(
  '/:id/send-email',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  [param('id').isInt({ min: 2 }), body('to').isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const rowIndex = parseInt(req.params.id, 10);
      const row = await sheetsService.getFpRow(rowIndex);
      if (!row) {
        return res.status(404).json({ success: false, message: 'F&P record not found.' });
      }

      const fp = parseJsonFields(fpToCamelCase(row));
      const { to } = req.body;

      // Build email HTML
      const menuItems = [];
      const menuCats = [
        { key: 'vegStarters', label: 'Veg Starters' },
        { key: 'nonVegStarters', label: 'Non-Veg Starters' },
        { key: 'vegMainCourse', label: 'Veg Main Course' },
        { key: 'nonVegMainCourse', label: 'Non-Veg Main Course' },
        { key: 'rice', label: 'Rice' },
        { key: 'dal', label: 'Dal' },
        { key: 'salad', label: 'Salad' },
        { key: 'accompaniments', label: 'Accompaniments' },
        { key: 'desserts', label: 'Desserts' },
      ];
      menuCats.forEach(({ key, label }) => {
        const items = Array.isArray(fp[key]) ? fp[key] : [];
        if (items.length > 0) {
          menuItems.push(`<tr><td style="padding:6px 10px;font-weight:bold;background:#FFF5E6;border:1px solid #eee;">${label}</td><td style="padding:6px 10px;border:1px solid #eee;">${items.join(', ')}</td></tr>`);
        }
      });

      const subject = `AKAN F&P - ${fp.fpId || 'Draft'} | ${fp.contactPerson || fp.guestName || 'Guest'} | ${fp.dateOfEvent || ''}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;">
          <div style="background:#af4408;color:white;padding:16px 20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;font-size:18px;">AKAN - Function & Prospectus</h2>
            <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">${fp.fpId || ''} | Status: ${fp.status || 'Draft'}</p>
          </div>
          <div style="padding:20px;border:1px solid #eee;border-top:none;">
            <h3 style="color:#af4408;font-size:14px;margin-bottom:10px;">Event Details</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr><td style="padding:4px 0;color:#666;width:120px;">Event Date</td><td style="font-weight:bold;">${fp.dateOfEvent || '-'} (${fp.dayOfEvent || '-'})</td></tr>
              <tr><td style="padding:4px 0;color:#666;">Time</td><td style="font-weight:bold;">${fp.timeOfEvent || '-'}</td></tr>
              <tr><td style="padding:4px 0;color:#666;">Contact</td><td style="font-weight:bold;">${fp.contactPerson || '-'}</td></tr>
              <tr><td style="padding:4px 0;color:#666;">Company</td><td style="font-weight:bold;">${fp.company || '-'}</td></tr>
              <tr><td style="padding:4px 0;color:#666;">Pax</td><td style="font-weight:bold;">${fp.paxExpected || '-'}</td></tr>
              <tr><td style="padding:4px 0;color:#666;">Package</td><td style="font-weight:bold;">${fp.packageType || '-'}</td></tr>
              <tr><td style="padding:4px 0;color:#666;">Area</td><td style="font-weight:bold;">${fp.allocatedArea || '-'}</td></tr>
            </table>
            ${menuItems.length > 0 ? `
              <h3 style="color:#af4408;font-size:14px;margin:16px 0 8px;">Menu Selection</h3>
              <table style="width:100%;border-collapse:collapse;font-size:12px;">${menuItems.join('')}</table>
            ` : ''}
            <p style="margin-top:20px;font-size:11px;color:#999;">This is an auto-generated email from AKAN Party Manager. Please download the PDF for the complete F&P document.</p>
          </div>
          <div style="background:#f5f5f5;padding:10px 20px;border-radius:0 0 8px 8px;border:1px solid #eee;border-top:none;">
            <p style="margin:0;font-size:11px;color:#999;">Sent by ${req.user.name || req.user.username} via AKAN Party Manager</p>
          </div>
        </div>
      `;

      await sendEmail(to, subject, html);
      res.json({ success: true, message: `F&P email sent to ${to}` });
    } catch (err) {
      console.error('POST /api/fp/:id/send-email error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to send email.' });
    }
  }
);

module.exports = router;
