const express = require('express');
const { query, validationResult } = require('express-validator');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const reportService = require('../services/reportService');
const emailService = require('../services/emailService');
const sheetsService = require('../services/sheetsService');

const router = express.Router();

// All report routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/reports/daily - Daily summary report
// ---------------------------------------------------------------------------
router.get(
  '/daily',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  [query('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const date = req.query.date || new Date().toISOString().split('T')[0];
      const report = await reportService.generateDailyReport(date);

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      console.error('Daily report error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate daily report.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/reports/range - Date range report
// ---------------------------------------------------------------------------
router.get(
  '/range',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  [
    query('from').isISO8601().withMessage('From date is required (YYYY-MM-DD)'),
    query('to').isISO8601().withMessage('To date is required (YYYY-MM-DD)'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { from, to } = req.query;

      if (from > to) {
        return res.status(400).json({
          success: false,
          message: '"from" date must be before or equal to "to" date.',
        });
      }

      const report = await reportService.generateRangeReport(from, to);

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      console.error('Range report error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate range report.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/reports/export - Export all data as JSON (for frontend Excel/PDF conversion)
// ---------------------------------------------------------------------------
router.get(
  '/export',
  roleCheck(ROLES.MANAGER),
  [
    query('status').optional().isIn(['Enquiry', 'Confirmed', 'Tentative', 'Cancelled']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      let rows = await sheetsService.getAllRows();

      // Apply optional filters
      if (req.query.status) {
        rows = rows.filter((r) => r['Status'] === req.query.status);
      }
      if (req.query.from) {
        rows = rows.filter((r) => normalizeDate(r['Date']) >= req.query.from);
      }
      if (req.query.to) {
        rows = rows.filter((r) => {
          const d = normalizeDate(r['Date']);
          return d && d <= req.query.to;
        });
      }

      // Strip internal row index
      const exportData = rows.map(({ _rowIndex, ...rest }) => rest);

      res.json({
        success: true,
        columns: sheetsService.COLUMNS,
        data: exportData,
        total: exportData.length,
        exportedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Export error:', err);
      res.status(500).json({ success: false, message: 'Failed to export data.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/reports/send-daily - Trigger daily report email manually
// ---------------------------------------------------------------------------
router.post(
  '/send-daily',
  roleCheck(ROLES.MANAGER),
  async (req, res) => {
    try {
      const date = req.body.date || new Date().toISOString().split('T')[0];
      const report = await reportService.generateDailyReport(date);
      const html = reportService.formatReportHTML(report);

      // Send to the requesting user's email
      const userEmail = req.user?.email || '';
      await emailService.sendDailyReport(html, date, userEmail);

      res.json({
        success: true,
        message: `Daily report for ${date} sent to ${userEmail || 'configured recipients'}.`,
      });
    } catch (err) {
      console.error('Send daily report error:', err);
      res.status(500).json({ success: false, message: 'Failed to send daily report email.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/reports/send-range - Send report for a custom date range
// ---------------------------------------------------------------------------
router.post(
  '/send-range',
  roleCheck(ROLES.MANAGER),
  async (req, res) => {
    try {
      const { from, to, label } = req.body;
      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'From and To dates are required.' });
      }
      const report = await reportService.generateRangeReport(from, to);
      const html = reportService.formatReportHTML(report);

      // Send to the requesting user's email
      const userEmail = req.user?.email || '';
      await emailService.sendDailyReport(html, label || `${from} to ${to}`, userEmail);

      res.json({
        success: true,
        message: `${label || 'Range'} report sent to ${userEmail || 'configured recipients'}.`,
      });
    } catch (err) {
      console.error('Send range report error:', err);
      res.status(500).json({ success: false, message: 'Failed to send report email.' });
    }
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr.toString().trim();
  return parsed.toISOString().split('T')[0];
}

module.exports = router;
