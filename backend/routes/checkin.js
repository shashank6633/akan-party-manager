const express = require('express');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const firebaseService = require('../services/firebaseService');
const qrService = require('../services/qrService');
const sesService = require('../services/sesService');
const sheetsService = require('../services/sheetsService');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// Helper: Auto-sync attendance to Google Sheets (called after each check-in)
// ---------------------------------------------------------------------------
async function syncAttendanceToSheets(partyUniqueId) {
  try {
    const guests = await firebaseService.getGuests(partyUniqueId);
    const stats = await firebaseService.getCheckinStats(partyUniqueId);
    const allRows = await sheetsService.getAllRows();
    const partyRow = allRows.find((r) => r['Unique ID'] === partyUniqueId);
    if (!partyRow) return;

    const attendanceCount = `${stats.totalArrived}/${stats.totalExpected} (${stats.arrivalPercentage}%)`;

    // Update main sheet with just the count
    await sheetsService.updateRow(partyRow._rowIndex, {
      'Attendance Count': attendanceCount,
    });

    // Sync full guest log to separate Attendance Log sheet
    await sheetsService.syncAttendanceLog(partyUniqueId, {
      eventDate: partyRow['Date'] || '',
      hostName: partyRow['Host Name'] || '',
      company: partyRow['Company'] || '',
    }, guests);

    console.log(`[Checkin] Auto-synced attendance for ${partyUniqueId}: ${stats.totalArrived}/${stats.totalExpected}`);
  } catch (err) {
    console.error(`[Checkin] Auto-sync failed for ${partyUniqueId}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Middleware: check Firebase availability
// ---------------------------------------------------------------------------
function requireFirebase(req, res, next) {
  if (!firebaseService.isAvailable()) {
    return res.status(503).json({
      success: false,
      message: 'Check-in module not available. Firebase not configured.',
    });
  }
  next();
}

router.use(requireFirebase);

// ---------------------------------------------------------------------------
// GET /api/checkin/:partyId/guests - List all guests for a party
// ---------------------------------------------------------------------------
router.get('/:partyId/guests', async (req, res) => {
  try {
    const guests = await firebaseService.getGuests(req.params.partyId);
    res.json({ success: true, guests });
  } catch (err) {
    console.error('Checkin guests list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch guests.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/checkin/:partyId/stats - Get check-in statistics
// ---------------------------------------------------------------------------
router.get('/:partyId/stats', async (req, res) => {
  try {
    const stats = await firebaseService.getCheckinStats(req.params.partyId);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Checkin stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/guests - Add a guest
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/guests',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { name, phone, email, plusOnes, notes } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Guest name is required.' });
      }

      const guest = await firebaseService.addGuest(req.params.partyId, {
        name: name.trim(),
        phone: phone?.trim() || '',
        email: email?.trim() || '',
        plusOnes: parseInt(plusOnes) || 0,
        notes: notes?.trim() || '',
      });

      res.status(201).json({ success: true, guest });
    } catch (err) {
      console.error('Add guest error:', err);
      res.status(500).json({ success: false, message: 'Failed to add guest.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/guests/bulk - Add multiple guests at once
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/guests/bulk',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { guests: guestList } = req.body;
      if (!Array.isArray(guestList) || guestList.length === 0) {
        return res.status(400).json({ success: false, message: 'Guest list is required.' });
      }

      const results = [];
      for (const g of guestList) {
        if (!g.name?.trim()) continue;
        const guest = await firebaseService.addGuest(req.params.partyId, {
          name: g.name.trim(),
          phone: g.phone?.trim() || '',
          email: g.email?.trim() || '',
          plusOnes: parseInt(g.plusOnes) || 0,
          notes: g.notes?.trim() || '',
        });
        results.push(guest);
      }

      res.status(201).json({ success: true, guests: results, count: results.length });
    } catch (err) {
      console.error('Bulk add guests error:', err);
      res.status(500).json({ success: false, message: 'Failed to add guests.' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/checkin/:partyId/guests/:guestId - Update a guest
// ---------------------------------------------------------------------------
router.put(
  '/:partyId/guests/:guestId',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { name, phone, email, plusOnes, notes } = req.body;
      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (phone !== undefined) updates.phone = phone.trim();
      if (email !== undefined) updates.email = email.trim();
      if (plusOnes !== undefined) updates.plusOnes = parseInt(plusOnes) || 0;
      if (notes !== undefined) updates.notes = notes.trim();

      const guest = await firebaseService.updateGuest(req.params.partyId, req.params.guestId, updates);
      res.json({ success: true, guest });
    } catch (err) {
      console.error('Update guest error:', err);
      res.status(500).json({ success: false, message: 'Failed to update guest.' });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/checkin/:partyId/guests/:guestId - Remove a guest
// ---------------------------------------------------------------------------
router.delete(
  '/:partyId/guests/:guestId',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      await firebaseService.deleteGuest(req.params.partyId, req.params.guestId);
      res.json({ success: true, message: 'Guest removed.' });
    } catch (err) {
      console.error('Delete guest error:', err);
      res.status(500).json({ success: false, message: 'Failed to remove guest.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/guests/:guestId/generate-qr - Generate QR code
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/guests/:guestId/generate-qr',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { partyId, guestId } = req.params;
      const guest = await firebaseService.getGuest(partyId, guestId);
      if (!guest) return res.status(404).json({ success: false, message: 'Guest not found.' });

      // Generate JWT token
      const qrToken = qrService.generateQrToken(partyId, guestId, guest.name);

      // Generate QR data URL
      const qrDataUrl = await qrService.generateQrDataUrl(qrToken);

      // Save token to guest record
      await firebaseService.updateGuest(partyId, guestId, { qrToken });

      res.json({ success: true, qrToken, qrDataUrl });
    } catch (err) {
      console.error('Generate QR error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate QR code.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/guests/:guestId/send-invite - Send e-invite
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/guests/:guestId/send-invite',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { partyId, guestId } = req.params;
      const guest = await firebaseService.getGuest(partyId, guestId);
      if (!guest) return res.status(404).json({ success: false, message: 'Guest not found.' });
      if (!guest.email) return res.status(400).json({ success: false, message: 'Guest has no email address.' });

      // Generate QR if not exists
      let qrToken = guest.qrToken;
      if (!qrToken) {
        qrToken = qrService.generateQrToken(partyId, guestId, guest.name);
        await firebaseService.updateGuest(partyId, guestId, { qrToken });
      }

      const qrDataUrl = await qrService.generateQrDataUrl(qrToken);

      // Get party details from the request body or lookup
      const { hostName, eventDate, eventTime, venue, occasion, company } = req.body;

      await sesService.sendInviteEmail({
        to: guest.email,
        guestName: guest.name,
        hostName: hostName || '',
        eventDate: eventDate || '',
        eventTime: eventTime || '',
        venue: venue || '',
        occasion: occasion || '',
        company: company || '',
        qrDataUrl,
      });

      // Mark invite as sent
      await firebaseService.updateGuest(partyId, guestId, {
        inviteSent: true,
        inviteSentAt: new Date().toISOString(),
      });

      res.json({ success: true, message: `Invite sent to ${guest.email}` });
    } catch (err) {
      console.error('Send invite error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to send invite.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/bulk-invite - Send invites to all uninvited guests
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/bulk-invite',
  roleCheck(ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { partyId } = req.params;
      const guests = await firebaseService.getGuests(partyId);
      const { hostName, eventDate, eventTime, venue, occasion, company } = req.body;

      const uninvited = guests.filter((g) => !g.inviteSent && g.email);
      let sent = 0;
      let failed = 0;
      const errors = [];

      for (const guest of uninvited) {
        try {
          let qrToken = guest.qrToken;
          if (!qrToken) {
            qrToken = qrService.generateQrToken(partyId, guest.id, guest.name);
            await firebaseService.updateGuest(partyId, guest.id, { qrToken });
          }

          const qrDataUrl = await qrService.generateQrDataUrl(qrToken);

          await sesService.sendInviteEmail({
            to: guest.email,
            guestName: guest.name,
            hostName, eventDate, eventTime, venue, occasion, company,
            qrDataUrl,
          });

          await firebaseService.updateGuest(partyId, guest.id, {
            inviteSent: true,
            inviteSentAt: new Date().toISOString(),
          });
          sent++;
        } catch (err) {
          failed++;
          errors.push({ guestId: guest.id, name: guest.name, error: err.message });
        }
      }

      res.json({
        success: true,
        message: `Sent ${sent} invites. ${failed} failed.`,
        sent,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error('Bulk invite error:', err);
      res.status(500).json({ success: false, message: 'Failed to send bulk invites.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/scan - Scan QR code and check in
// ---------------------------------------------------------------------------
router.post(
  '/scan',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { qrToken } = req.body;
      if (!qrToken) {
        return res.status(400).json({ success: false, message: 'QR token is required.' });
      }

      // Verify JWT
      let decoded;
      try {
        decoded = qrService.verifyQrToken(qrToken);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid or expired QR code.' });
      }

      if (decoded.type !== 'checkin') {
        return res.status(400).json({ success: false, message: 'Invalid QR code type.' });
      }

      // Find guest and check in
      const guest = await firebaseService.getGuest(decoded.pid, decoded.gid);
      if (!guest) {
        return res.status(404).json({ success: false, message: 'Guest not found.' });
      }

      if (guest.checkedIn) {
        return res.json({
          success: false,
          alreadyCheckedIn: true,
          message: `${guest.name} is already checked in.`,
          guest: { id: guest.id, name: guest.name, checkedInAt: guest.checkedInAt },
        });
      }

      const updatedGuest = await firebaseService.checkInGuest(
        decoded.pid,
        decoded.gid,
        req.user.name || req.user.username,
        req.body.actualPlusOnes
      );

      res.json({
        success: true,
        message: `${guest.name} checked in successfully!`,
        guest: updatedGuest,
        partyId: decoded.pid,
      });

      // Auto-sync to Google Sheets (non-blocking)
      syncAttendanceToSheets(decoded.pid).catch(() => {});
    } catch (err) {
      console.error('QR scan error:', err);
      res.status(500).json({ success: false, message: 'Check-in failed.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/manual-checkin/:guestId - Manual check-in (no QR)
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/manual-checkin/:guestId',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { partyId, guestId } = req.params;
      const { actualPlusOnes } = req.body || {};
      const guest = await firebaseService.checkInGuest(partyId, guestId, req.user.name || req.user.username, actualPlusOnes);
      res.json({ success: true, message: `${guest.name} checked in manually.`, guest });

      // Auto-sync to Google Sheets (non-blocking)
      syncAttendanceToSheets(partyId).catch(() => {});
    } catch (err) {
      if (err.message === 'Guest already checked in') {
        return res.json({ success: false, alreadyCheckedIn: true, message: err.message });
      }
      console.error('Manual checkin error:', err);
      res.status(500).json({ success: false, message: 'Check-in failed.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/undo-checkin/:guestId - Undo check-in
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/undo-checkin/:guestId',
  roleCheck(ROLES.MANAGER),
  async (req, res) => {
    try {
      await firebaseService.undoCheckIn(req.params.partyId, req.params.guestId);
      res.json({ success: true, message: 'Check-in undone.' });
    } catch (err) {
      console.error('Undo checkin error:', err);
      res.status(500).json({ success: false, message: 'Failed to undo check-in.' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/checkin/:partyId/sync-sheets - Writeback attendance to Google Sheets
// ---------------------------------------------------------------------------
router.post(
  '/:partyId/sync-sheets',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const guests = await firebaseService.getGuests(req.params.partyId);
      const stats = await firebaseService.getCheckinStats(req.params.partyId);

      // Find the party row in Google Sheets
      const allRows = await sheetsService.getAllRows();
      const partyRow = allRows.find((r) => r['Unique ID'] === req.params.partyId);

      if (!partyRow) {
        return res.status(404).json({ success: false, message: 'Party not found in Google Sheets.' });
      }

      const attendanceCount = `${stats.totalArrived}/${stats.totalExpected} (${stats.arrivalPercentage}%)`;

      // Update main sheet with just the count
      await sheetsService.updateRow(partyRow._rowIndex, {
        'Attendance Count': attendanceCount,
      });

      // Sync full guest log to separate Attendance Log sheet
      await sheetsService.syncAttendanceLog(req.params.partyId, {
        eventDate: partyRow['Date'] || '',
        hostName: partyRow['Host Name'] || '',
        company: partyRow['Company'] || '',
      }, guests);

      res.json({
        success: true,
        message: `Attendance synced to Google Sheets: ${stats.totalArrived}/${stats.totalExpected}`,
        stats,
      });
    } catch (err) {
      console.error('Sync sheets error:', err);
      res.status(500).json({ success: false, message: 'Failed to sync to Google Sheets.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/checkin/status - Check if module is available
// ---------------------------------------------------------------------------
router.get('/status', (req, res) => {
  res.json({ success: true, available: firebaseService.isAvailable() });
});

module.exports = router;
