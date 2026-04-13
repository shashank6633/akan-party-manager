/**
 * Email Service for Guest Check-in Invites.
 * Uses existing SMTP configuration (Gmail).
 */

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[Email] SMTP transport configured for invites.');
  } else {
    console.warn('[Email] No SMTP configured for check-in invites.');
    return null;
  }

  return _transporter;
}

/**
 * Send an e-invite email with QR code.
 */
async function sendInviteEmail(opts) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }

  const fromEmail = process.env.INVITE_FROM_EMAIL || process.env.SMTP_USER || 'noreply@akanhyd.com';
  const fromName = process.env.INVITE_FROM_NAME || 'AKAN Hospitality';

  // Extract base64 from data URL for embedding as CID attachment
  const base64Data = opts.qrDataUrl.replace(/^data:image\/png;base64,/, '');

  const html = buildInviteHtml(opts);

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: opts.to,
    subject: `You're Invited! ${opts.occasion || 'Event'} at AKAN${opts.eventDate ? ` - ${opts.eventDate}` : ''}`,
    html,
    attachments: [
      {
        filename: 'qr-checkin.png',
        content: Buffer.from(base64Data, 'base64'),
        cid: 'qrcode@akan',
        contentType: 'image/png',
      },
    ],
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}

function buildInviteHtml(opts) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8f4f0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#af4408;padding:28px 24px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">AKAN</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">Hospitality & Events</p>
    </div>

    <!-- Content -->
    <div style="padding:28px 24px;">
      <p style="margin:0 0 16px;color:#333;font-size:16px;">
        Dear <strong>${opts.guestName || 'Guest'}</strong>,
      </p>
      <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.6;">
        You are cordially invited to ${opts.occasion ? `a <strong>${opts.occasion}</strong>` : 'an event'}${opts.hostName ? ` hosted by <strong>${opts.hostName}</strong>` : ''}${opts.company ? ` (${opts.company})` : ''}.
      </p>

      <!-- Event Details -->
      <div style="background:#fef7f2;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          ${opts.eventDate ? `<tr><td style="padding:4px 0;color:#888;font-size:13px;width:80px;">Date</td><td style="padding:4px 0;color:#333;font-size:14px;font-weight:600;">${opts.eventDate}</td></tr>` : ''}
          ${opts.eventTime ? `<tr><td style="padding:4px 0;color:#888;font-size:13px;">Time</td><td style="padding:4px 0;color:#333;font-size:14px;font-weight:600;">${opts.eventTime}</td></tr>` : ''}
          ${opts.venue ? `<tr><td style="padding:4px 0;color:#888;font-size:13px;">Venue</td><td style="padding:4px 0;color:#333;font-size:14px;font-weight:600;">${opts.venue}</td></tr>` : ''}
        </table>
      </div>

      <!-- QR Code -->
      <div style="text-align:center;margin:24px 0;">
        <p style="margin:0 0 12px;color:#666;font-size:13px;">Your Check-in QR Code</p>
        <img src="cid:qrcode@akan" alt="Check-in QR Code" width="200" height="200" style="border:1px solid #eee;border-radius:12px;padding:8px;background:#fff;" />
        <p style="margin:12px 0 0;color:#999;font-size:11px;">Present this QR code at the entrance for quick check-in</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8f4f0;padding:16px 24px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;color:#999;font-size:11px;">AKAN Hospitality, Hyderabad</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  sendInviteEmail,
};
