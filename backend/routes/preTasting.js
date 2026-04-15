const express = require('express');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const sheetsService = require('../services/sheetsService');
const { columnToCamel } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helper: convert pre-tasting sheet-keyed object to camelCase
// ---------------------------------------------------------------------------
function preTastingToCamel(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key === '_rowIndex' ? 'rowIndex' : columnToCamel(key)] = val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/pre-tasting - List all pre-tasting records
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    await sheetsService.ensurePreTastingSheet();
    const rows = await sheetsService.getAllPreTastingRows();
    const { partyId, search } = req.query;

    let filtered = rows;
    if (partyId) {
      filtered = filtered.filter((r) => r['Party Unique ID'] === partyId);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((r) =>
        (r['Guest Name'] || '').toLowerCase().includes(s) ||
        (r['Company'] || '').toLowerCase().includes(s) ||
        (r['Phone'] || '').includes(s) ||
        (r['Pre-Tasting ID'] || '').toLowerCase().includes(s) ||
        (r['Party Unique ID'] || '').toLowerCase().includes(s)
      );
    }

    filtered.reverse();

    res.json({
      success: true,
      preTasting: filtered.map(preTastingToCamel),
      total: filtered.length,
    });
  } catch (err) {
    console.error('Pre-Tasting list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pre-tasting records.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pre-tasting/by-fp/:fpId - Get pre-tasting for a specific F&P record
// ---------------------------------------------------------------------------
router.get('/by-fp/:fpId', async (req, res) => {
  try {
    await sheetsService.ensurePreTastingSheet();
    const rows = await sheetsService.getAllPreTastingRows();
    const matches = rows.filter((r) => r['FP ID'] === req.params.fpId);
    res.json({
      success: true,
      preTasting: matches.map(preTastingToCamel),
      total: matches.length,
    });
  } catch (err) {
    console.error('Pre-Tasting by-fp error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pre-tasting records.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/pre-tasting/:id - Get single pre-tasting by row index
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id);
    if (isNaN(rowIndex) || rowIndex < 2) {
      return res.status(400).json({ success: false, message: 'Invalid pre-tasting ID.' });
    }
    await sheetsService.ensurePreTastingSheet();
    const row = await sheetsService.getPreTastingRow(rowIndex);
    if (!row) return res.status(404).json({ success: false, message: 'Pre-tasting record not found.' });
    res.json({ success: true, preTasting: preTastingToCamel(row) });
  } catch (err) {
    console.error('Pre-Tasting get error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch pre-tasting record.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/pre-tasting - Submit new pre-tasting review
// ---------------------------------------------------------------------------
router.post(
  '/',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER, ROLES.FEEDBACK, ROLES.ADMIN),
  async (req, res) => {
    try {
      await sheetsService.ensurePreTastingSheet();

      // Convert camelCase body to sheet format
      const data = {};
      for (const [key, val] of Object.entries(req.body)) {
        const col = sheetsService.PRE_TASTING_COLUMNS.find((c) => columnToCamel(c) === key);
        if (col) data[col] = val;
      }

      // Auto-fill system fields
      data['Pre-Tasting ID'] = sheetsService.generatePreTastingId();
      data['Submitted At'] = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      data['Submitted By'] = req.user.name || req.user.username;
      if (!data['Tasting Date']) {
        data['Tasting Date'] = new Date().toISOString().slice(0, 10);
      }

      if (!data['Overall Rating']) {
        return res.status(400).json({ success: false, message: 'Overall rating is required.' });
      }

      const result = await sheetsService.appendPreTastingRow(data);

      res.status(201).json({
        success: true,
        message: 'Pre-tasting review submitted successfully.',
        preTasting: preTastingToCamel(result),
      });
    } catch (err) {
      console.error('Pre-Tasting submit error:', err);
      res.status(500).json({ success: false, message: 'Failed to submit pre-tasting review.' });
    }
  }
);

module.exports = router;
