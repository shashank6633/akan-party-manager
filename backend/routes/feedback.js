const express = require('express');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const sheetsService = require('../services/sheetsService');
const { toCamelCase, toSheetFormat, columnToCamel } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helper: convert feedback sheet-keyed object to camelCase
// ---------------------------------------------------------------------------
function feedbackToCamel(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key === '_rowIndex' ? 'rowIndex' : columnToCamel(key)] = val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/feedback - List all feedback records
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    await sheetsService.ensureFeedbackSheet();
    const rows = await sheetsService.getAllFeedbackRows();
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
        (r['Feedback ID'] || '').toLowerCase().includes(s) ||
        (r['Party Unique ID'] || '').toLowerCase().includes(s)
      );
    }

    // Sort newest first
    filtered.reverse();

    res.json({
      success: true,
      feedback: filtered.map(feedbackToCamel),
      total: filtered.length,
    });
  } catch (err) {
    console.error('Feedback list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/feedback/:id - Get single feedback by row index
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.id);
    if (isNaN(rowIndex) || rowIndex < 2) {
      return res.status(400).json({ success: false, message: 'Invalid feedback ID.' });
    }
    await sheetsService.ensureFeedbackSheet();
    const row = await sheetsService.getFeedbackRow(rowIndex);
    if (!row) return res.status(404).json({ success: false, message: 'Feedback not found.' });
    res.json({ success: true, feedback: feedbackToCamel(row) });
  } catch (err) {
    console.error('Feedback get error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/feedback/by-fp/:fpId - Get feedback for a specific F&P record
// ---------------------------------------------------------------------------
router.get('/by-fp/:fpId', async (req, res) => {
  try {
    await sheetsService.ensureFeedbackSheet();
    const rows = await sheetsService.getAllFeedbackRows();
    const matches = rows.filter((r) => r['FP ID'] === req.params.fpId);
    res.json({
      success: true,
      feedback: matches.map(feedbackToCamel),
      total: matches.length,
    });
  } catch (err) {
    console.error('Feedback by-fp error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch feedback.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/feedback - Submit new feedback
// ---------------------------------------------------------------------------
router.post(
  '/',
  roleCheck(ROLES.SALES, ROLES.MANAGER, ROLES.FEEDBACK, ROLES.ADMIN),
  async (req, res) => {
    try {
      await sheetsService.ensureFeedbackSheet();

      // Convert camelCase body to sheet format
      const data = {};
      for (const [key, val] of Object.entries(req.body)) {
        // Try matching to a feedback column
        const col = sheetsService.FEEDBACK_COLUMNS.find((c) => columnToCamel(c) === key);
        if (col) data[col] = val;
      }

      // Auto-fill system fields
      data['Feedback ID'] = sheetsService.generateFeedbackId();
      data['Submitted At'] = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      data['Submitted By'] = req.user.name || req.user.username;

      // Validate required
      if (!data['Overall Rating']) {
        return res.status(400).json({ success: false, message: 'Overall rating is required.' });
      }

      const result = await sheetsService.appendFeedbackRow(data);

      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully.',
        feedback: feedbackToCamel(result),
      });
    } catch (err) {
      console.error('Feedback submit error:', err);
      res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
    }
  }
);

module.exports = router;
