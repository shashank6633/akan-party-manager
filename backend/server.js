require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const { ensureDefaultAdmin } = require('./routes/auth');
const partyRoutes = require('./routes/parties');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const reportService = require('./services/reportService');
const emailService = require('./services/emailService');
const sheetsService = require('./services/sheetsService');

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Security & Middleware
// ---------------------------------------------------------------------------

// Helmet for security headers
app.use(helmet());

// CORS - allow frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// No API rate limiting - internal use with frequent requests

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/auth', authRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AKAN Party Manager API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);

  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error.'
        : err.message || 'Internal server error.',
  });
});

// ---------------------------------------------------------------------------
// In-memory notifications store (real-time alerts for bell icon)
// ---------------------------------------------------------------------------
const notifications = [];
let notificationIdCounter = 1;

function addNotification(type, text, partyId, severity = 'warning') {
  const notif = {
    id: notificationIdCounter++,
    type, // 'stale_enquiry', 'new_enquiry', 'status_change', etc.
    text,
    partyId,
    severity, // 'info', 'warning', 'error'
    time: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(notif);
  // Keep only last 50 notifications
  if (notifications.length > 50) notifications.length = 50;
  return notif;
}

// Expose notification store for routes
app.locals.notifications = notifications;
app.locals.addNotification = addNotification;

// ---------------------------------------------------------------------------
// Cron Job: Check for stale enquiries every 15 minutes
// ---------------------------------------------------------------------------
cron.schedule('*/15 * * * *', async () => {
  console.log('Checking for stale enquiries...');
  try {
    const rows = await sheetsService.getAllRows();
    const now = new Date();
    const staleParties = [];

    for (const row of rows) {
      const status = row['Status'];
      // Only check parties still in "Enquiry" status
      if (status !== 'Enquiry') continue;

      const enquiredAt = row['Enquired At'];
      if (!enquiredAt) continue; // Old entries without timestamp - skip

      const enquiredDate = new Date(enquiredAt);
      const hoursSinceEnquiry = (now - enquiredDate) / (1000 * 60 * 60);

      if (hoursSinceEnquiry >= 1) {
        staleParties.push({
          ...row,
          _hoursAgo: Math.floor(hoursSinceEnquiry),
        });
      }
    }

    if (staleParties.length > 0) {
      console.log(`Found ${staleParties.length} stale enquir${staleParties.length === 1 ? 'y' : 'ies'} (>1 hour old)`);

      // Add in-app notifications
      for (const party of staleParties) {
        const existingNotif = notifications.find(
          (n) => n.type === 'stale_enquiry' && n.partyId === party._rowIndex && !n.read
        );
        if (!existingNotif) {
          addNotification(
            'stale_enquiry',
            `⚠️ "${party['Host Name']}" enquiry status pending for ${party._hoursAgo}h - needs immediate action`,
            party._rowIndex,
            'error'
          );
        }
      }

      // Send email alert (non-blocking)
      emailService.sendStaleEnquiryAlert(staleParties).catch((err) => {
        console.error('Failed to send stale enquiry alert email:', err.message);
      });
    } else {
      console.log('No stale enquiries found.');
    }
  } catch (err) {
    console.error('Stale enquiry check failed:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Cron Job: Daily night report at 10 PM
// ---------------------------------------------------------------------------
cron.schedule('0 22 * * *', async () => {
  console.log('Running daily night report cron job...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const report = await reportService.generateDailyReport(today);
    const html = reportService.formatReportHTML(report);
    await emailService.sendDailyReport(html, today);
    console.log('Daily report sent successfully.');
  } catch (err) {
    console.error('Daily report cron failed:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Cron Job: Daily follow-up & payment reminder at 9 AM
// ---------------------------------------------------------------------------
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily follow-up & payment reminder cron...');
  try {
    const rows = await sheetsService.getAllRows();
    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);

    // Find parties needing follow-up (Enquiry/Contacted/Tentative with no recent follow-up)
    const needsFollowUp = rows.filter((r) => {
      const status = r['Status'];
      if (status !== 'Enquiry' && status !== 'Contacted' && status !== 'Tentative') return false;
      const lastFollowUp = r['Last Follow Up Date'];
      if (!lastFollowUp) return true;
      const diffDays = Math.floor((todayDate - new Date(lastFollowUp)) / (1000 * 60 * 60 * 24));
      return diffDays >= 2;
    });

    // Find confirmed parties with pending payments
    const pendingPayments = rows.filter((r) => {
      if (r['Status'] !== 'Confirmed') return false;
      const due = parseFloat(r['Due Amount']) || 0;
      return due > 0;
    });

    // Find upcoming parties (next 3 days)
    const upcomingParties = rows.filter((r) => {
      if (r['Status'] === 'Cancelled') return false;
      const dateStr = r['Date'];
      if (!dateStr || dateStr.startsWith('TBC:')) return false;
      const partyDate = new Date(dateStr);
      const diffDays = Math.floor((partyDate - todayDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    });

    if (needsFollowUp.length > 0 || pendingPayments.length > 0 || upcomingParties.length > 0) {
      await emailService.sendDailyFollowUpReminder(needsFollowUp, pendingPayments, upcomingParties);
      console.log(`Daily follow-up email sent: ${needsFollowUp.length} follow-ups, ${pendingPayments.length} pending payments, ${upcomingParties.length} upcoming.`);
    } else {
      console.log('No follow-ups or pending payments to report.');
    }
  } catch (err) {
    console.error('Daily follow-up cron failed:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Cron Job: Payment reminder emails at 8:00 AM IST (2:30 AM UTC)
// Sends reminders: 2 days before, 1 day before, and on the payment due date
// ---------------------------------------------------------------------------
cron.schedule('30 2 * * *', async () => {
  console.log('Running payment reminder cron job (8:00 AM IST)...');
  // Check if payment reminders are enabled in settings
  if (process.env.PAYMENT_REMINDER_ENABLED !== 'true') {
    console.log('Payment reminders are disabled. Skipping.');
    return;
  }
  try {
    const rows = await sheetsService.getAllRows();
    // Use IST for date calculations
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = nowIST.toISOString().split('T')[0];

    // Filter parties with dues on today's balance payment date
    const partiesWithDues = rows.filter((r) => {
      if ((r['Status'] || '').trim() === 'Cancelled') return false;
      const balanceDate = (r['Balance Payment Date'] || '').trim();
      if (!balanceDate) return false;
      const due = parseFloat(r['Due Amount']) || 0;
      if (due <= 0) return false;
      if (!r['Guest Email']) return false;
      const normalizedDate = balanceDate.length === 10 ? balanceDate : new Date(balanceDate).toISOString().split('T')[0];
      return normalizedDate === todayIST;
    });

    let sentCount = 0;
    for (const party of partiesWithDues) {
      emailService.sendPaymentReminderToGuest(party, 'due_today').catch((err) => {
        console.error(`Failed to send payment reminder for ${party['Host Name']}:`, err.message);
      });
      sentCount++;
    }

    console.log(`Payment reminder cron complete: ${sentCount} reminders sent.`);
  } catch (err) {
    console.error('Payment reminder cron failed:', err.message);
  }
});

// ---------------------------------------------------------------------------
// Server Startup
// ---------------------------------------------------------------------------
async function startServer() {
  try {
    // Ensure sheets are set up and default admin exists
    console.log('Initializing Google Sheets...');
    await sheetsService.ensurePartyBookingsHeader();
    await ensureDefaultAdmin();
    console.log('Google Sheets initialized.');

    app.listen(PORT, () => {
      console.log(`\nAKAN Party Manager API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log('Daily report cron: Every day at 10:00 PM\n');
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    console.error(
      'Make sure your .env file is configured correctly with Google Sheets credentials.'
    );
    process.exit(1);
  }
}

startServer();

module.exports = app;
