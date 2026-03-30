const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Email routing config — reads admin-configurable roles per notification type
// ---------------------------------------------------------------------------
const EMAIL_ROUTING_PATH = path.join(__dirname, '..', 'data', 'email-routing.json');

const DEFAULT_EMAIL_ROUTING = {
  newParty:      ['SALES', 'MANAGER'],
  statusChange:  ['MANAGER', 'SALES'],
  cancellation:  ['MANAGER', 'ADMIN'],
  staleEnquiry:  ['SALES', 'MANAGER'],
  criticalAlert: ['ADMIN'],
  dailyFollowUp: ['SALES', 'MANAGER', 'ADMIN'],
  dailyReport:   ['MANAGER', 'ADMIN'],
  billingUpdate: ['MANAGER', 'ADMIN'],
};

/**
 * Get the configured roles for a notification type.
 * Falls back to defaults if config file is missing.
 * @param {string} notifType - e.g. 'newParty', 'statusChange'
 * @returns {string[]} Array of role strings
 */
function getRoutingRoles(notifType) {
  try {
    if (fs.existsSync(EMAIL_ROUTING_PATH)) {
      const data = JSON.parse(fs.readFileSync(EMAIL_ROUTING_PATH, 'utf-8'));
      if (data[notifType] && Array.isArray(data[notifType]) && data[notifType].length > 0) {
        return data[notifType];
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_EMAIL_ROUTING[notifType] || [];
}

/**
 * Create a reusable SMTP transporter from environment config.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Lazy-load sheetsService to avoid circular dependency
let _sheetsService = null;
function getSheetsService() {
  if (!_sheetsService) _sheetsService = require('./sheetsService');
  return _sheetsService;
}

/**
 * Get email addresses for users matching specific roles.
 * @param {string[]} roles - Array of role strings e.g. ['SALES', 'MANAGER', 'ADMIN']
 * @returns {string[]} Array of email addresses
 */
async function getEmailsByRoles(roles) {
  try {
    const users = await getSheetsService().getAllUsers();
    return users
      .filter((u) => roles.includes(u.role?.toUpperCase()) && u.email)
      .map((u) => u.email.trim())
      .filter(Boolean);
  } catch (err) {
    console.error('Failed to get emails by roles:', err.message);
    // Fallback to env vars
    const fallback = [];
    if (roles.includes('SALES') && process.env.SALES_EMAIL) fallback.push(process.env.SALES_EMAIL);
    if (roles.includes('MANAGER') && process.env.MANAGER_EMAIL) fallback.push(process.env.MANAGER_EMAIL);
    if (roles.includes('ADMIN') && process.env.ADMIN_EMAIL) fallback.push(process.env.ADMIN_EMAIL);
    return fallback;
  }
}

/**
 * Send a generic email.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML body
 * @returns {object} Nodemailer send result
 */
async function sendEmail(to, subject, html) {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"AKAN Party Manager" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    throw err;
  }
}

/**
 * Notify sales team about a new party enquiry.
 * @param {object} partyData - Party booking data
 */
async function sendNewPartyNotification(partyData) {
  // New Party → configurable (default: Sales, Manager)
  const emails = await getEmailsByRoles(getRoutingRoles('newParty'));
  const to = [...new Set(emails)].join(',');
  if (!to) return;

  const subject = `New Party Enquiry - ${partyData['Host Name'] || 'N/A'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
        New Party Enquiry
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Date</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Date'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Event / Host</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Host Name'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Phone</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Phone Number'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Company</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Company'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Place</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Place'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Meal</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Meal Type'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Expected Pax</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Expected Pax'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Package</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Package Selected'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Status</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Status'] || 'Enquiry'}</td>
        </tr>
      </table>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        This is an automated notification from AKAN Party Manager.
      </p>
    </div>
  `;

  return sendEmail(to, subject, html);
}

/**
 * Notify manager about a status change.
 * @param {object} partyData - Updated party data
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 */
async function sendStatusChangeNotification(partyData, oldStatus, newStatus) {
  // Status Change → configurable (default: Manager, Sales)
  const emails = await getEmailsByRoles(getRoutingRoles('statusChange'));
  const to = [...new Set(emails)].join(',');
  if (!to) return;

  const subject = `Status Change: ${partyData['Host Name'] || 'Party'} - ${oldStatus} -> ${newStatus}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">
        Party Status Updated
      </h2>
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <strong>Status changed from <span style="color: #856404;">${oldStatus}</span>
        to <span style="color: #155724;">${newStatus}</span></strong>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Date</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Date'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Event / Host</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Host Name'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Phone</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Phone Number'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Expected Pax</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Expected Pax'] || '-'}</td>
        </tr>
      </table>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        This is an automated notification from AKAN Party Manager.
      </p>
    </div>
  `;

  return sendEmail(to, subject, html);
}

/**
 * Notify about a cancellation with the lost reason.
 * @param {object} partyData - Party data with Lost Reason populated
 */
async function sendCancellationNotification(partyData) {
  // Cancellations → configurable (default: Manager, Admin)
  const emails = await getEmailsByRoles(getRoutingRoles('cancellation'));
  const to = [...new Set(emails)].join(',');
  if (!to) return;

  const subject = `Party Cancelled - ${partyData['Host Name'] || 'N/A'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c0392b; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
        Party Cancelled
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Date</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Date'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Event / Host</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Host Name'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Phone</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Phone Number'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Company</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Company'] || '-'}</td>
        </tr>
      </table>
      <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <strong>Lost Reason:</strong> ${partyData['Lost Reason'] || 'Not specified'}
      </div>
      <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
        <strong>Cancelled Date:</strong> ${partyData['Cancelled Date'] || new Date().toISOString().split('T')[0]}
      </div>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        This is an automated notification from AKAN Party Manager.
      </p>
    </div>
  `;

  return sendEmail(to, subject, html);
}

/**
 * Send the daily summary report.
 * @param {string} reportHtml - Pre-formatted HTML report
 * @param {string} date - Report date
 */
async function sendDailyReport(reportHtml, date, userEmail) {
  let recipients;
  if (userEmail) {
    // Manual send from UI → send only to the requesting user's email
    recipients = [userEmail];
  } else {
    // Automated cron → configurable (default: Manager & Admin)
    const emails = await getEmailsByRoles(getRoutingRoles('dailyReport'));
    recipients = emails.length > 0 ? emails
      : [process.env.MANAGER_EMAIL, process.env.ADMIN_EMAIL].filter(Boolean);
  }

  if (recipients.length === 0) return;

  const subject = `AKAN Party Report - ${date || new Date().toISOString().split('T')[0]}`;
  return sendEmail([...new Set(recipients)].join(','), subject, reportHtml);
}

/**
 * Send stale enquiry alert to Sales & Manager.
 * Triggered when enquiry status hasn't changed within 1 hour.
 * @param {Array} staleParties - Array of party objects needing attention
 */
async function sendStaleEnquiryAlert(staleParties) {
  if (staleParties.length === 0) return;
  // Stale Enquiry alerts → configurable (default: Sales, Manager)
  const emails = await getEmailsByRoles(getRoutingRoles('staleEnquiry'));
  const recipients = emails.length > 0 ? emails
    : [process.env.SALES_EMAIL, process.env.MANAGER_EMAIL].filter(Boolean);

  if (recipients.length === 0) return;

  const rows = staleParties.map((p, i) => {
    const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
    const enquiredAt = p['Enquired At'] ? new Date(p['Enquired At']).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
    const hoursAgo = p._hoursAgo ? `${p._hoursAgo}h ago` : '';
    return `
      <tr style="background: ${bg};">
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Host Name'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Phone Number'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Date'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6; color: #dc3545; font-weight: bold;">${p['Status'] || 'Enquiry'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${enquiredAt}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6; color: #856404;">${hoursAgo}</td>
      </tr>`;
  }).join('');

  const subject = `⚠️ URGENT: ${staleParties.length} Enquir${staleParties.length === 1 ? 'y' : 'ies'} Pending Action - Status Not Updated`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #dc3545; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Stale Enquiry Alert</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">
          ${staleParties.length} enquir${staleParties.length === 1 ? 'y has' : 'ies have'} not been updated for over 1 hour
        </p>
      </div>
      <div style="background: #fff3cd; padding: 12px 20px; border: 1px solid #ffc107;">
        <strong>Action Required:</strong> Please update the status (Confirmed / Tentative / Cancelled) for the following enquiries immediately.
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background: #343a40; color: white;">
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Event / Host</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Phone</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Date</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Status</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Enquired At</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Pending</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        This is an automated alert from AKAN Party Manager. Please log in and update the status of these enquiries.
      </p>
    </div>
  `;

  return sendEmail(recipients.join(','), subject, html);
}

/**
 * Send daily follow-up & payment reminder email to admin/sales team.
 * @param {Array} followUps - Parties needing follow-up
 * @param {Array} pendingPayments - Confirmed parties with pending dues
 * @param {Array} upcomingParties - Parties happening in next 3 days
 */
async function sendDailyFollowUpReminder(followUps, pendingPayments, upcomingParties) {
  // Follow-up & payment alerts → configurable (default: Sales, Manager, Admin)
  const emails = await getEmailsByRoles(getRoutingRoles('dailyFollowUp'));
  const recipients = emails.length > 0 ? emails
    : [process.env.SALES_EMAIL, process.env.MANAGER_EMAIL].filter(Boolean);

  if (recipients.length === 0) return;

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  const followUpRows = followUps.slice(0, 20).map((p, i) => `
    <tr style="background: ${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Host Name'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Phone Number'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Date'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Status'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Last Follow Up Date'] || 'Never'}</td>
    </tr>`).join('');

  const paymentRows = pendingPayments.slice(0, 20).map((p, i) => {
    const due = parseFloat(p['Due Amount']) || 0;
    const total = parseFloat(p['Final Total Amount']) || parseFloat(p['Approx Bill Amount']) || 0;
    const paid = parseFloat(p['Total Amount Paid']) || 0;
    return `
    <tr style="background: ${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Host Name'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Date'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6; text-align: right;">${formatCurrency(total)}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6; text-align: right;">${formatCurrency(paid)}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6; text-align: right; color: #dc3545; font-weight: bold;">${formatCurrency(due)}</td>
    </tr>`;
  }).join('');

  const upcomingRows = upcomingParties.slice(0, 20).map((p, i) => `
    <tr style="background: ${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Host Name'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Phone Number'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Date'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Status'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Expected Pax'] || '-'}</td>
      <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Package Selected'] || '-'}</td>
    </tr>`).join('');

  const totalDues = pendingPayments.reduce((sum, p) => sum + (parseFloat(p['Due Amount']) || 0), 0);

  const subject = `📋 AKAN Daily Follow-Up Report - ${today}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <div style="background: #af4408; color: #fff; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">📋 Daily Follow-Up & Payment Report</h1>
        <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">${today}</p>
      </div>

      <!-- Summary -->
      <div style="display: flex; gap: 10px; padding: 15px 0; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 140px; background: #e67e22; color: #fff; padding: 12px; border-radius: 5px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold;">${followUps.length}</div>
          <div style="font-size: 12px;">Need Follow-Up</div>
        </div>
        <div style="flex: 1; min-width: 140px; background: #dc3545; color: #fff; padding: 12px; border-radius: 5px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold;">${pendingPayments.length}</div>
          <div style="font-size: 12px;">Pending Payments</div>
        </div>
        <div style="flex: 1; min-width: 140px; background: #28a745; color: #fff; padding: 12px; border-radius: 5px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold;">${upcomingParties.length}</div>
          <div style="font-size: 12px;">Upcoming (3 Days)</div>
        </div>
        <div style="flex: 1; min-width: 140px; background: #6c757d; color: #fff; padding: 12px; border-radius: 5px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold;">${formatCurrency(totalDues)}</div>
          <div style="font-size: 12px;">Total Dues</div>
        </div>
      </div>

      ${followUps.length > 0 ? `
      <h3 style="color: #e67e22; margin-top: 20px;">⏰ Needs Follow-Up (${followUps.length})</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead><tr style="background: #343a40; color: #fff;">
          <th style="padding: 8px 10px; text-align: left;">Host</th>
          <th style="padding: 8px 10px; text-align: left;">Phone</th>
          <th style="padding: 8px 10px; text-align: left;">Date</th>
          <th style="padding: 8px 10px; text-align: left;">Status</th>
          <th style="padding: 8px 10px; text-align: left;">Last Follow-Up</th>
        </tr></thead>
        <tbody>${followUpRows}</tbody>
      </table>
      ` : ''}

      ${pendingPayments.length > 0 ? `
      <h3 style="color: #dc3545; margin-top: 20px;">💰 Pending Payments (${pendingPayments.length})</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead><tr style="background: #343a40; color: #fff;">
          <th style="padding: 8px 10px; text-align: left;">Host</th>
          <th style="padding: 8px 10px; text-align: left;">Date</th>
          <th style="padding: 8px 10px; text-align: right;">Total</th>
          <th style="padding: 8px 10px; text-align: right;">Paid</th>
          <th style="padding: 8px 10px; text-align: right;">Due</th>
        </tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>
      ` : ''}

      ${upcomingParties.length > 0 ? `
      <h3 style="color: #28a745; margin-top: 20px;">📅 Upcoming Parties (Next 3 Days)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead><tr style="background: #343a40; color: #fff;">
          <th style="padding: 8px 10px; text-align: left;">Host</th>
          <th style="padding: 8px 10px; text-align: left;">Phone</th>
          <th style="padding: 8px 10px; text-align: left;">Date</th>
          <th style="padding: 8px 10px; text-align: left;">Status</th>
          <th style="padding: 8px 10px; text-align: left;">Pax</th>
          <th style="padding: 8px 10px; text-align: left;">Package</th>
        </tr></thead>
        <tbody>${upcomingRows}</tbody>
      </table>
      ` : ''}

      <div style="border-top: 1px solid #dee2e6; margin-top: 20px; padding-top: 10px;">
        <p style="color: #7f8c8d; font-size: 11px; text-align: center;">
          Automated daily report from AKAN Party Manager | ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </p>
      </div>
    </div>
  `;

  return sendEmail([...new Set(recipients)].join(','), subject, html);
}

/**
 * Helper: format currency for emails.
 */
function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return '\u20B9' + num.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

/**
 * Send payment reminder email to guest on their Balance Payment Date.
 * @param {object} partyData - Party row data from sheets
 */
/**
 * Send payment reminder to guest.
 * @param {object} partyData - Party row data
 * @param {string} reminderType - '2_days_before' | '1_day_before' | 'due_today' | 'manual'
 */
async function sendPaymentReminderToGuest(partyData, reminderType = 'manual', sentBy = 'System') {
  const guestEmail = partyData['Guest Email'];
  if (!guestEmail) return;

  const uniqueId = partyData['Unique ID'] || '';

  // Check if this reminder was already sent today (skip for manual sends)
  if (reminderType !== 'manual') {
    const alreadySent = await getSheetsService().hasReminderBeenSent(uniqueId, reminderType);
    if (alreadySent) {
      console.log(`Payment reminder (${reminderType}) already sent today for ${uniqueId} — skipping.`);
      return { skipped: true };
    }
  }

  // CC to Sales, Manager, Admin
  const ccList = await getEmailsByRoles(['SALES', 'MANAGER', 'ADMIN']);
  const ccEmails = ccList.length > 0 ? [...new Set(ccList)].join(',') : (process.env.SALES_EMAIL || 'sales@akanhyd.com');
  const hostName = partyData['Host Name'] || 'Guest';
  const dueAmount = parseFloat(partyData['Due Amount']) || 0;
  const totalAmount = parseFloat(partyData['Final Total Amount']) || parseFloat(partyData['Approx Bill Amount']) || 0;
  const totalPaid = parseFloat(partyData['Total Amount Paid']) || 0;
  const partyDate = partyData['Date'] || '-';
  const balanceDate = partyData['Balance Payment Date'] || '-';

  // Customize message based on reminder type
  let urgencyBanner = '';
  let reminderMessage = '';
  let subjectPrefix = 'Payment Reminder';

  if (reminderType === '2_days_before') {
    subjectPrefix = 'Upcoming Payment Reminder';
    reminderMessage = `Your payment of <strong>${formatCurrency(dueAmount)}</strong> is scheduled for <strong>${balanceDate}</strong> (2 days from now). Please ensure the payment is made on time to avoid any inconvenience.`;
    urgencyBanner = `<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 15px 0; text-align: center;">
      <span style="font-size: 14px; color: #856404; font-weight: 600;">⏰ Payment due in 2 days — ${balanceDate}</span>
    </div>`;
  } else if (reminderType === '1_day_before') {
    subjectPrefix = 'Payment Due Tomorrow';
    reminderMessage = `Your payment of <strong>${formatCurrency(dueAmount)}</strong> is scheduled for <strong>tomorrow (${balanceDate})</strong>. Please make the payment on time.`;
    urgencyBanner = `<div style="background: #ffe0b2; border: 1px solid #ff9800; border-radius: 6px; padding: 12px 16px; margin: 15px 0; text-align: center;">
      <span style="font-size: 14px; color: #e65100; font-weight: 600;">⚠️ Payment due TOMORROW — ${balanceDate}</span>
    </div>`;
  } else if (reminderType === 'due_today') {
    subjectPrefix = 'Payment Due Today';
    reminderMessage = `Your payment of <strong>${formatCurrency(dueAmount)}</strong> is due <strong>TODAY (${balanceDate})</strong>. Please arrange the payment at the earliest to avoid any delays.`;
    urgencyBanner = `<div style="background: #ffcdd2; border: 1px solid #f44336; border-radius: 6px; padding: 12px 16px; margin: 15px 0; text-align: center;">
      <span style="font-size: 14px; color: #b71c1c; font-weight: 600;">🔴 Payment due TODAY — ${balanceDate}</span>
    </div>`;
  } else {
    // Manual send
    reminderMessage = balanceDate !== '-'
      ? `Your payment of <strong>${formatCurrency(dueAmount)}</strong> was scheduled for <strong>${balanceDate}</strong>. Please try to make the payment on time.`
      : `This is a gentle reminder regarding the pending payment of <strong>${formatCurrency(dueAmount)}</strong> for your party booking at AKAN.`;
    if (balanceDate !== '-') {
      urgencyBanner = `<div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 6px; padding: 12px 16px; margin: 15px 0; text-align: center;">
        <span style="font-size: 14px; color: #0d47a1; font-weight: 600;">📅 Payment scheduled for ${balanceDate}</span>
      </div>`;
    }
  }

  const subject = `${subjectPrefix} - AKAN Party Booking (${partyDate})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #af4408; color: #fff; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">AKAN</h1>
        <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">${subjectPrefix}</p>
      </div>

      <div style="padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; color: #333;">Dear <strong>${hostName}</strong>,</p>

        ${urgencyBanner}

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          ${reminderMessage}
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px 15px; font-weight: bold; border: 1px solid #dee2e6;">Party Date</td>
            <td style="padding: 10px 15px; border: 1px solid #dee2e6;">${partyDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px 15px; font-weight: bold; border: 1px solid #dee2e6;">Total Bill Amount</td>
            <td style="padding: 10px 15px; border: 1px solid #dee2e6;">${formatCurrency(totalAmount)}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px 15px; font-weight: bold; border: 1px solid #dee2e6;">Amount Paid</td>
            <td style="padding: 10px 15px; border: 1px solid #dee2e6;">${formatCurrency(totalPaid)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 15px; font-weight: bold; border: 1px solid #dee2e6; color: #dc3545;">Balance Due</td>
            <td style="padding: 10px 15px; border: 1px solid #dee2e6; color: #dc3545; font-weight: bold; font-size: 16px;">${formatCurrency(dueAmount)}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px 15px; font-weight: bold; border: 1px solid #dee2e6;">Payment Due Date</td>
            <td style="padding: 10px 15px; border: 1px solid #dee2e6; font-weight: bold;">${balanceDate}</td>
          </tr>
        </table>

        <p style="font-size: 14px; color: #555; line-height: 1.6;">
          For any queries, please feel free to contact us.
        </p>

        <p style="font-size: 14px; color: #333; margin-top: 20px;">
          Warm regards,<br/>
          <strong>AKAN Team</strong><br/>
          <span style="font-size: 12px; color: #888;">sales@akanhyd.com</span>
        </p>
      </div>

      <div style="text-align: center; margin-top: 10px;">
        <p style="color: #7f8c8d; font-size: 11px;">
          This is an automated reminder from AKAN Party Manager.
        </p>
      </div>
    </div>
  `;

  const transporter = createTransporter();
  const mailOptions = {
    from: `"AKAN Party Manager" <${process.env.SMTP_USER}>`,
    to: guestEmail,
    cc: ccEmails,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Payment reminder (${reminderType}) sent to ${guestEmail} (CC: ${ccEmails}): ${info.messageId}`);

    // Log the sent reminder to Google Sheets
    await getSheetsService().logPaymentReminder({
      uniqueId,
      hostName,
      guestEmail,
      reminderType,
      dueAmount: dueAmount.toString(),
      balancePaymentDate: partyData['Balance Payment Date'] || '',
      sentBy,
    });

    return info;
  } catch (err) {
    console.error(`Failed to send payment reminder to ${guestEmail}:`, err.message);
    throw err;
  }
}

/**
 * Notify Manager & Admin when Cashier updates billing.
 * @param {object} partyData - Party data
 * @param {object} paymentEntry - New payment entry
 */
async function sendBillingUpdateNotification(partyData, paymentEntry) {
  // Cashier billing update → configurable (default: Manager & Admin)
  const emails = await getEmailsByRoles(getRoutingRoles('billingUpdate'));
  const to = [...new Set(emails)].join(',');
  if (!to) return;

  const subject = `Billing Updated - ${partyData['Host Name'] || 'Party'} (${paymentEntry.type === 'advance' ? 'Advance' : 'Payment'}: ${formatCurrency(paymentEntry.amount)})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">
        Billing Updated by ${paymentEntry.recordedBy || 'Cashier'}
      </h2>
      <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <strong>${paymentEntry.type === 'advance' ? 'Advance' : 'Payment'} of ${formatCurrency(paymentEntry.amount)} recorded</strong>
        ${paymentEntry.method ? ` via ${paymentEntry.method}` : ''}
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Date</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Date'] || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Host</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${partyData['Host Name'] || '-'}</td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Total Bill</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${formatCurrency(partyData['Final Total Amount'])}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #dee2e6;">Due Amount</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6; color: #dc3545;">${formatCurrency(partyData['Due Amount'])}</td>
        </tr>
      </table>
      ${paymentEntry.note ? `<p style="margin-top: 10px;"><strong>Note:</strong> ${paymentEntry.note}</p>` : ''}
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        This is an automated notification from AKAN Party Manager.
      </p>
    </div>
  `;

  return sendEmail(to, subject, html);
}

/**
 * Send critical alert to Admin ONLY when enquiries have no update for 1+ hours.
 * Separate from stale enquiry alert (which goes to Sales, Manager).
 * @param {Array} criticalParties - Parties with no status update for 1+ hours
 */
async function sendCriticalAlert(criticalParties) {
  if (criticalParties.length === 0) return;
  // Critical alerts → configurable (default: Admin only)
  const emails = await getEmailsByRoles(getRoutingRoles('criticalAlert'));
  const recipients = emails.length > 0 ? emails
    : [process.env.ADMIN_EMAIL].filter(Boolean);

  if (recipients.length === 0) return;

  const rows = criticalParties.map((p, i) => {
    const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
    const enquiredAt = p['Enquired At'] ? new Date(p['Enquired At']).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
    const hoursAgo = p._hoursAgo ? `${p._hoursAgo}h ago` : '';
    return `
      <tr style="background: ${bg};">
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Host Name'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Phone Number'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Date'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${p['Handled By'] || '-'}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${enquiredAt}</td>
        <td style="padding: 8px 12px; border: 1px solid #dee2e6; color: #dc3545; font-weight: bold;">${hoursAgo}</td>
      </tr>`;
  }).join('');

  const subject = `🚨 CRITICAL: ${criticalParties.length} Enquir${criticalParties.length === 1 ? 'y' : 'ies'} Unattended for 1+ Hour`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: #7b1fa2; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🚨 Critical Alert — Admin</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">
          ${criticalParties.length} enquir${criticalParties.length === 1 ? 'y has' : 'ies have'} been unattended for over 1 hour
        </p>
      </div>
      <div style="background: #f3e5f5; padding: 12px 20px; border: 1px solid #ce93d8;">
        <strong>Immediate Escalation Required:</strong> The following enquiries have not been acted upon. Please follow up with the assigned team member.
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background: #343a40; color: white;">
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Event / Host</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Phone</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Date</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Handled By</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Enquired At</th>
            <th style="padding: 10px 12px; text-align: left; border: 1px solid #dee2e6;">Pending</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        This is an automated critical alert from AKAN Party Manager — sent only to Admin.
      </p>
    </div>
  `;

  return sendEmail(recipients.join(','), subject, html);
}

module.exports = {
  sendEmail,
  sendNewPartyNotification,
  sendStatusChangeNotification,
  sendCancellationNotification,
  sendDailyReport,
  sendStaleEnquiryAlert,
  sendCriticalAlert,
  sendDailyFollowUpReminder,
  sendPaymentReminderToGuest,
  sendBillingUpdateNotification,
  getEmailsByRoles,
};
