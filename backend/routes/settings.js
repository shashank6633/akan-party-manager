/**
 * Settings routes — configurable lookup lists stored as JSON on disk.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');

// All settings routes require a logged-in user; PUTs require ADMIN
router.use(authenticate);

// ---------------------------------------------------------------------------
// Enquiry Sources — admin-managed list of values for the new "Enquiry Source"
// field on Party Bookings. Drives the dropdown in Add Party / Party Detail.
// ---------------------------------------------------------------------------

const ENQ_PATH = path.join(__dirname, '..', 'data', 'enquiry-sources.json');

// Hard-coded fallback if the JSON file is missing / corrupt
const DEFAULT_SOURCES = [
  'Call', 'WhatsApp', 'Instagram', 'Facebook', 'Google',
  'Communities Ad', 'Public Hoardings', 'Walk-in',
  'Reference', 'Management', 'Other',
];

function loadEnquirySources() {
  try {
    if (fs.existsSync(ENQ_PATH)) {
      const data = JSON.parse(fs.readFileSync(ENQ_PATH, 'utf-8'));
      if (Array.isArray(data.sources)) return data.sources;
    }
  } catch { /* fall through */ }
  return [...DEFAULT_SOURCES];
}

function saveEnquirySources(sources) {
  const dir = path.dirname(ENQ_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ENQ_PATH, JSON.stringify({ sources }, null, 2), 'utf-8');
}

/**
 * GET /api/settings/enquiry-sources
 * Returns the current list. Available to any authenticated user (drives
 * the form dropdown).
 */
router.get('/enquiry-sources', async (req, res) => {
  try {
    res.json({ success: true, sources: loadEnquirySources() });
  } catch (err) {
    console.error('GET enquiry-sources error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load enquiry sources.' });
  }
});

/**
 * PUT /api/settings/enquiry-sources
 * Body: { sources: ['Call', 'WhatsApp', ...] }
 * Admin only. Replaces the whole list. Order is preserved as the dropdown
 * order shown to users.
 */
router.put(
  '/enquiry-sources',
  roleCheck(ROLES.ADMIN),
  [
    body('sources').isArray({ min: 1 }).withMessage('At least one source is required.'),
    body('sources.*').isString().trim().notEmpty().withMessage('Source values must be non-empty strings.'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      // De-dupe (case-insensitive), trim, cap at 50 items
      const cleaned = [];
      const seen = new Set();
      for (const raw of req.body.sources) {
        const s = String(raw).trim();
        if (!s) continue;
        const key = s.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(s);
        if (cleaned.length >= 50) break;
      }
      if (cleaned.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one valid source is required.' });
      }

      saveEnquirySources(cleaned);
      res.json({ success: true, sources: cleaned });
    } catch (err) {
      console.error('PUT enquiry-sources error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to save enquiry sources.' });
    }
  }
);

module.exports = router;
