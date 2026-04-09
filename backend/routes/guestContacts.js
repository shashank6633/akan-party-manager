const express = require('express');
const authenticate = require('../middleware/auth');
const { roleCheck, ROLES } = require('../middleware/roleCheck');
const sheetsService = require('../services/sheetsService');
const { columnToCamel, toCamelCase } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

// Helper: convert sheet-keyed object to camelCase
function contactToCamel(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key === '_rowIndex' ? 'rowIndex' : columnToCamel(key)] = val;
  }
  return result;
}

// Helper: normalize date to YYYY-MM-DD
function normalizeDate(d) {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(d);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  return d;
}

// Helper: auto-check if contacts task is completed (>= 50% of confirmed pax)
async function checkAndUpdateTaskStatus(partyUniqueId) {
  try {
    // Get party details
    const allParties = await sheetsService.getAllRows();
    const party = allParties.find((p) => p['Unique ID'] === partyUniqueId);
    if (!party) return;

    const currentStatus = (party['Guest Contacts Status'] || '').trim();
    // Don't override if already completed or admin-approved
    if (currentStatus === 'Completed' || currentStatus === 'No Contacts Approved') return;

    const confirmedPax = parseInt(party['Confirmed Pax']) || parseInt(party['Expected Pax']) || 0;
    if (confirmedPax === 0) return;

    // Count contacts for this party
    await sheetsService.ensureGuestContactsSheet();
    const contacts = await sheetsService.getAllGuestContactRows();
    const partyContacts = contacts.filter((c) => c['Party Unique ID'] === partyUniqueId);

    // 50% threshold
    const threshold = Math.ceil(confirmedPax * 0.5);
    if (partyContacts.length >= threshold) {
      await sheetsService.updateRow(party._rowIndex, { 'Guest Contacts Status': 'Completed' });
      console.log(`Guest Contacts: Auto-completed for ${partyUniqueId} (${partyContacts.length}/${confirmedPax} = ${Math.round(partyContacts.length / confirmedPax * 100)}%)`);
    }
  } catch (err) {
    console.error('Check task status error:', err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/guest-contacts/tasks - Get pending guest contact tasks for GRE
// Shows Confirmed parties from event date onwards that need contacts
// ---------------------------------------------------------------------------
router.get('/tasks', async (req, res) => {
  try {
    const allParties = await sheetsService.getAllRows();
    const today = new Date().toISOString().split('T')[0];

    // Get all guest contacts to count per party
    await sheetsService.ensureGuestContactsSheet();
    const allContacts = await sheetsService.getAllGuestContactRows();
    const contactCountMap = {};
    allContacts.forEach((c) => {
      const pid = c['Party Unique ID'];
      if (pid) contactCountMap[pid] = (contactCountMap[pid] || 0) + 1;
    });

    // Filter: Confirmed parties where date >= today (or event date has passed)
    const tasks = allParties.filter((p) => {
      if (p['Status'] !== 'Confirmed') return false;
      const partyDate = normalizeDate(p['Date']);
      if (!partyDate || partyDate === 'TBC') return false;
      // Show from event date onwards
      if (partyDate > today) return false;
      // Skip if already completed or approved
      const gcStatus = (p['Guest Contacts Status'] || '').trim();
      if (gcStatus === 'Completed' || gcStatus === 'No Contacts Approved') return false;
      return true;
    }).map((p) => {
      const uniqueId = p['Unique ID'];
      const confirmedPax = parseInt(p['Confirmed Pax']) || parseInt(p['Expected Pax']) || 0;
      const contactsEntered = contactCountMap[uniqueId] || 0;
      const threshold = Math.ceil(confirmedPax * 0.5);
      const percentDone = confirmedPax > 0 ? Math.round((contactsEntered / confirmedPax) * 100) : 0;
      return {
        ...toCamelCase(p),
        contactsEntered,
        confirmedPax,
        threshold,
        percentDone,
        gcStatus: (p['Guest Contacts Status'] || 'Pending').trim(),
      };
    });

    // Sort: oldest first (most urgent)
    tasks.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    res.json({
      success: true,
      tasks,
      total: tasks.length,
    });
  } catch (err) {
    console.error('Guest contact tasks error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/guest-contacts/admin-requests - Pending "No Contacts" requests for Admin
// ---------------------------------------------------------------------------
router.get('/admin-requests', roleCheck(ROLES.MANAGER), async (req, res) => {
  try {
    const allParties = await sheetsService.getAllRows();
    const requests = allParties
      .filter((p) => (p['Guest Contacts Status'] || '').trim() === 'No Contacts Requested')
      .map((p) => toCamelCase(p));

    res.json({ success: true, requests, total: requests.length });
  } catch (err) {
    console.error('Admin requests error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests.' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/guest-contacts/no-contacts/:rowIndex - GRE requests "No Contacts"
// ---------------------------------------------------------------------------
router.put(
  '/no-contacts/:rowIndex',
  roleCheck(ROLES.GRE),
  async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 2) {
        return res.status(400).json({ success: false, message: 'Invalid row index.' });
      }
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Reason is required.' });
      }

      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) return res.status(404).json({ success: false, message: 'Party not found.' });

      const currentStatus = (existing['Guest Contacts Status'] || '').trim();
      if (currentStatus === 'Completed' || currentStatus === 'No Contacts Approved') {
        return res.status(400).json({ success: false, message: 'Task is already completed.' });
      }

      const userName = req.user.name || req.user.username;
      const remarks = existing['Remarks'] || '';
      const newRemarks = remarks
        ? `${remarks} | No Contacts: ${reason} (by ${userName})`
        : `No Contacts: ${reason} (by ${userName})`;

      await sheetsService.updateRow(rowIndex, {
        'Guest Contacts Status': 'No Contacts Requested',
        'Remarks': newRemarks,
      });

      res.json({ success: true, message: 'No contacts request sent to Admin for approval.' });
    } catch (err) {
      console.error('No contacts request error:', err);
      res.status(500).json({ success: false, message: 'Failed to submit request.' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /api/guest-contacts/approve-no-contacts/:rowIndex - Admin approves "No Contacts"
// ---------------------------------------------------------------------------
router.put(
  '/approve-no-contacts/:rowIndex',
  roleCheck(ROLES.MANAGER),
  async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 2) {
        return res.status(400).json({ success: false, message: 'Invalid row index.' });
      }

      const existing = await sheetsService.getRow(rowIndex);
      if (!existing) return res.status(404).json({ success: false, message: 'Party not found.' });

      if ((existing['Guest Contacts Status'] || '').trim() !== 'No Contacts Requested') {
        return res.status(400).json({ success: false, message: 'No pending request for this party.' });
      }

      await sheetsService.updateRow(rowIndex, {
        'Guest Contacts Status': 'No Contacts Approved',
      });

      res.json({ success: true, message: 'Approved. Task marked as completed (No Contacts).' });
    } catch (err) {
      console.error('Approve no contacts error:', err);
      res.status(500).json({ success: false, message: 'Failed to approve.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/guest-contacts - List all guest contacts
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    await sheetsService.ensureGuestContactsSheet();
    const rows = await sheetsService.getAllGuestContactRows();
    const { partyId, search, date } = req.query;

    let filtered = rows;
    if (partyId) {
      filtered = filtered.filter((r) => r['Party Unique ID'] === partyId);
    }
    if (date) {
      filtered = filtered.filter((r) => r['Party Date'] === date);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter((r) =>
        (r['Guest Name'] || '').toLowerCase().includes(s) ||
        (r['Guest Phone'] || '').includes(s) ||
        (r['Company'] || '').toLowerCase().includes(s) ||
        (r['Host Name'] || '').toLowerCase().includes(s) ||
        (r['Party Unique ID'] || '').toLowerCase().includes(s)
      );
    }

    // Sort newest first
    filtered.reverse();

    res.json({
      success: true,
      data: filtered.map(contactToCamel),
      total: filtered.length,
    });
  } catch (err) {
    console.error('Guest contacts list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch guest contacts.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/guest-contacts - Add guest contacts (batch: array of contacts)
// ---------------------------------------------------------------------------
router.post(
  '/',
  roleCheck(ROLES.GRE, ROLES.SALES, ROLES.MANAGER),
  async (req, res) => {
    try {
      const { partyUniqueId, partyDate, hostName, company, contacts } = req.body;

      if (!partyUniqueId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ success: false, message: 'Party ID and at least one contact are required.' });
      }

      await sheetsService.ensureGuestContactsSheet();

      const enteredBy = req.user.name || req.user.username;
      const enteredAt = new Date().toISOString();
      let added = 0;

      for (const contact of contacts) {
        if (!contact.guestName && !contact.guestPhone) continue;

        const data = {
          'Party Unique ID': partyUniqueId,
          'Party Date': partyDate || '',
          'Host Name': hostName || '',
          'Company': company || '',
          'Guest Name': contact.guestName || '',
          'Guest Phone': contact.guestPhone || '',
          'Entered By': enteredBy,
          'Entered At': enteredAt,
        };

        await sheetsService.appendGuestContactRow(data);
        added++;
      }

      // Auto-check if task is completed (>= 50% of pax)
      checkAndUpdateTaskStatus(partyUniqueId);

      res.json({
        success: true,
        message: `${added} contact(s) added successfully.`,
        added,
      });
    } catch (err) {
      console.error('Guest contact add error:', err);
      res.status(500).json({ success: false, message: 'Failed to add guest contacts.' });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/guest-contacts/:rowIndex - Delete a guest contact
// ---------------------------------------------------------------------------
router.delete(
  '/:rowIndex',
  roleCheck(ROLES.ADMIN),
  async (req, res) => {
    try {
      const rowIndex = parseInt(req.params.rowIndex);
      if (isNaN(rowIndex) || rowIndex < 2) {
        return res.status(400).json({ success: false, message: 'Invalid row index.' });
      }
      await sheetsService.ensureGuestContactsSheet();
      await sheetsService.deleteGuestContactRow(rowIndex);
      res.json({ success: true, message: 'Contact deleted.' });
    } catch (err) {
      console.error('Guest contact delete error:', err);
      res.status(500).json({ success: false, message: 'Failed to delete contact.' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/guest-contacts/stats - Contact stats
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    await sheetsService.ensureGuestContactsSheet();
    const rows = await sheetsService.getAllGuestContactRows();
    const totalContacts = rows.length;
    const uniquePhones = new Set(rows.map((r) => r['Guest Phone']).filter(Boolean)).size;
    const partiesWithContacts = new Set(rows.map((r) => r['Party Unique ID']).filter(Boolean)).size;

    res.json({
      success: true,
      stats: { totalContacts, uniquePhones, partiesWithContacts },
    });
  } catch (err) {
    console.error('Guest contact stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

module.exports = router;
