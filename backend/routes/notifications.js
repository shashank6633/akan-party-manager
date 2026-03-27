const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const emailService = require('../services/emailService');

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /api/notifications/test-email - Test SMTP email connectivity
// ---------------------------------------------------------------------------
router.post(
  '/test-email',
  roleCheck(ROLES.MANAGER),
  [body('to').optional().isEmail().withMessage('Invalid recipient email')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const to = req.body.to || process.env.ADMIN_EMAIL;

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'No recipient email provided and ADMIN_EMAIL not configured.',
        });
      }

      // First verify the SMTP connection
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: parseInt(process.env.SMTP_PORT, 10) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.verify();

      // Send test email
      await emailService.sendEmail(
        to,
        'AKAN Party Manager - Test Email',
        `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; text-align: center;">
          <h2 style="color: #27ae60;">Email Configuration Working!</h2>
          <p>This is a test email from the AKAN Party Manager system.</p>
          <p style="color: #7f8c8d; font-size: 12px;">
            Sent at: ${new Date().toLocaleString()}<br/>
            SMTP Host: ${process.env.SMTP_HOST}<br/>
            From: ${process.env.SMTP_USER}
          </p>
        </div>
        `
      );

      res.json({
        success: true,
        message: `Test email sent successfully to ${to}.`,
      });
    } catch (err) {
      console.error('Test email error:', err);

      let detail = err.message;
      if (err.code === 'ECONNREFUSED') {
        detail = 'SMTP connection refused. Check SMTP_HOST and SMTP_PORT.';
      } else if (err.code === 'EAUTH') {
        detail = 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS.';
      }

      res.status(500).json({
        success: false,
        message: 'Email test failed.',
        detail,
      });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/notifications/config - Check notification configuration status
// ---------------------------------------------------------------------------
router.get(
  '/config',
  roleCheck(ROLES.MANAGER),
  async (req, res) => {
    res.json({
      success: true,
      config: {
        smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
        salesEmail: process.env.SALES_EMAIL || null,
        managerEmail: process.env.MANAGER_EMAIL || null,
        adminEmail: process.env.ADMIN_EMAIL || null,
        smtpHost: process.env.SMTP_HOST || null,
        smtpPort: process.env.SMTP_PORT || null,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/notifications/email-settings - Get email notification settings
// ---------------------------------------------------------------------------
router.get(
  '/email-settings',
  roleCheck(ROLES.ADMIN),
  async (req, res) => {
    res.json({
      success: true,
      settings: {
        notificationEmails: process.env.NOTIFICATION_EMAILS || '',
        salesEmail: process.env.SALES_EMAIL || '',
        managerEmail: process.env.MANAGER_EMAIL || '',
        adminEmail: process.env.ADMIN_EMAIL || '',
      },
    });
  }
);

// ---------------------------------------------------------------------------
// PUT /api/notifications/email-settings - Update email notification settings
// ---------------------------------------------------------------------------
router.put(
  '/email-settings',
  roleCheck(ROLES.ADMIN),
  async (req, res) => {
    try {
      const { notificationEmails, salesEmail, managerEmail, adminEmail } = req.body;

      // Update process.env in memory
      if (notificationEmails !== undefined) process.env.NOTIFICATION_EMAILS = notificationEmails;
      if (salesEmail !== undefined) process.env.SALES_EMAIL = salesEmail;
      if (managerEmail !== undefined) process.env.MANAGER_EMAIL = managerEmail;
      if (adminEmail !== undefined) process.env.ADMIN_EMAIL = adminEmail;

      // Persist to .env file
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');

      const updateEnvVar = (content, key, value) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          return content.replace(regex, `${key}=${value}`);
        }
        return content + `\n${key}=${value}`;
      };

      if (notificationEmails !== undefined) envContent = updateEnvVar(envContent, 'NOTIFICATION_EMAILS', notificationEmails);
      if (salesEmail !== undefined) envContent = updateEnvVar(envContent, 'SALES_EMAIL', salesEmail);
      if (managerEmail !== undefined) envContent = updateEnvVar(envContent, 'MANAGER_EMAIL', managerEmail);
      if (adminEmail !== undefined) envContent = updateEnvVar(envContent, 'ADMIN_EMAIL', adminEmail);

      fs.writeFileSync(envPath, envContent, 'utf-8');

      res.json({ success: true, message: 'Email settings updated successfully.' });
    } catch (err) {
      console.error('Update email settings error:', err);
      res.status(500).json({ success: false, message: 'Failed to update email settings.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/notifications - Get in-app notifications for bell icon
// ---------------------------------------------------------------------------
router.get(
  '/',
  async (req, res) => {
    const notifications = req.app.locals.notifications || [];
    const userRole = req.user?.role?.toUpperCase();

    // GRE only sees new_enquiry notifications; others see all
    const filtered = userRole === 'GRE'
      ? notifications.filter((n) => n.type === 'new_enquiry')
      : notifications;

    res.json({
      success: true,
      notifications: filtered.slice(0, 20),
      unreadCount: filtered.filter((n) => !n.read).length,
    });
  }
);

// ---------------------------------------------------------------------------
// PUT /api/notifications/:id/read - Mark notification as read
// ---------------------------------------------------------------------------
router.put(
  '/:id/read',
  async (req, res) => {
    const notifications = req.app.locals.notifications || [];
    const id = parseInt(req.params.id, 10);
    const notif = notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
    res.json({ success: true });
  }
);

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all - Mark all notifications as read
// ---------------------------------------------------------------------------
router.put(
  '/read-all',
  async (req, res) => {
    const notifications = req.app.locals.notifications || [];
    notifications.forEach((n) => { n.read = true; });
    res.json({ success: true });
  }
);

// ---------------------------------------------------------------------------
// GET /api/notifications/stale-enquiries - Get current stale enquiries
// For Dashboard alert section
// ---------------------------------------------------------------------------
router.get(
  '/stale-enquiries',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const sheetsService = require('../services/sheetsService');
      const { toCamelCase } = require('../utils/calculations');
      const rows = await sheetsService.getAllRows();
      const now = new Date();
      const stale = [];

      for (const row of rows) {
        if (row['Status'] !== 'Enquiry') continue;
        const enquiredAt = row['Enquired At'];
        if (!enquiredAt) continue;

        const hoursSince = (now - new Date(enquiredAt)) / (1000 * 60 * 60);
        if (hoursSince >= 1) {
          stale.push({
            ...toCamelCase(row),
            hoursAgo: Math.floor(hoursSince),
            minutesAgo: Math.floor((now - new Date(enquiredAt)) / (1000 * 60)),
          });
        }
      }

      res.json({ success: true, staleEnquiries: stale, total: stale.length });
    } catch (err) {
      console.error('Stale enquiries error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch stale enquiries.' });
    }
  }
);

// ---------------------------------------------------------------------------
// Payment reminder auto-send toggle (persisted in .env)
// ---------------------------------------------------------------------------
router.get(
  '/payment-reminder-setting',
  roleCheck(ROLES.ADMIN),
  async (req, res) => {
    res.json({ success: true, enabled: process.env.PAYMENT_REMINDER_ENABLED === 'true' });
  }
);

router.post(
  '/payment-reminder-setting',
  roleCheck(ROLES.ADMIN),
  async (req, res) => {
    try {
      const enabled = !!req.body.enabled;
      process.env.PAYMENT_REMINDER_ENABLED = String(enabled);

      // Persist to .env
      const envPath = path.join(__dirname, '..', '.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');
      const regex = /^PAYMENT_REMINDER_ENABLED=.*$/m;
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `PAYMENT_REMINDER_ENABLED=${enabled}`);
      } else {
        envContent += `\nPAYMENT_REMINDER_ENABLED=${enabled}`;
      }
      fs.writeFileSync(envPath, envContent, 'utf-8');

      res.json({ success: true, enabled });
    } catch (err) {
      console.error('Toggle payment reminder error:', err);
      res.status(500).json({ success: false, message: 'Failed to update setting.' });
    }
  }
);

module.exports = router;
