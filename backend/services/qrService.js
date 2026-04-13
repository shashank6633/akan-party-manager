/**
 * QR Code Generation Service
 * Generates JWT-signed QR codes for guest check-in.
 * Each QR encodes a signed token that verifies guest identity.
 */

const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const QR_SECRET = () => process.env.QR_JWT_SECRET || process.env.JWT_SECRET;

/**
 * Generate a signed QR token for a guest.
 * Payload: { partyId, guestId, guestName, iat }
 * No expiry — valid until event is over (controlled by backend check).
 */
function generateQrToken(partyUniqueId, guestId, guestName) {
  const payload = {
    pid: partyUniqueId,
    gid: guestId,
    name: guestName,
    type: 'checkin',
  };
  return jwt.sign(payload, QR_SECRET(), { algorithm: 'HS256' });
}

/**
 * Verify and decode a QR token.
 * Returns decoded payload or throws.
 */
function verifyQrToken(token) {
  return jwt.verify(token, QR_SECRET(), { algorithms: ['HS256'] });
}

/**
 * Generate QR code as a data URL (base64 PNG).
 * The QR encodes the signed JWT token.
 */
async function generateQrDataUrl(token, options = {}) {
  const { width = 300, margin = 2, color } = options;
  return QRCode.toDataURL(token, {
    width,
    margin,
    color: color || { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generate QR code as a Buffer (PNG).
 * Useful for embedding in PDFs or emails.
 */
async function generateQrBuffer(token, options = {}) {
  const { width = 300, margin = 2 } = options;
  return QRCode.toBuffer(token, {
    width,
    margin,
    type: 'png',
    errorCorrectionLevel: 'M',
  });
}

module.exports = {
  generateQrToken,
  verifyQrToken,
  generateQrDataUrl,
  generateQrBuffer,
};
