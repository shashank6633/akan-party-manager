/**
 * Firebase Admin SDK Service
 * Manages Firestore for real-time guest check-in data.
 *
 * Firestore structure:
 *   parties/{partyUniqueId}/guests/{guestDocId}
 *     - name, phone, email, plusOnes, notes
 *     - inviteSent, inviteSentAt
 *     - checkedIn, checkedInAt, checkedInBy
 *     - qrToken
 */

const admin = require('firebase-admin');

let _db = null;
let _initialized = false;

function initFirebase() {
  if (_initialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[Firebase] Missing credentials — check-in module will be unavailable.');
    _initialized = true;
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    _db = admin.firestore();
    console.log('[Firebase] Initialized successfully.');
  } catch (err) {
    console.error('[Firebase] Init error:', err.message);
  }
  _initialized = true;
}

function getDb() {
  if (!_initialized) initFirebase();
  if (!_db) throw new Error('Firebase not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env');
  return _db;
}

function isAvailable() {
  if (!_initialized) initFirebase();
  return !!_db;
}

// ---------------------------------------------------------------------------
// Guest CRUD
// ---------------------------------------------------------------------------

async function getGuests(partyUniqueId) {
  const snap = await getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests')
    .orderBy('createdAt', 'asc')
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getGuest(partyUniqueId, guestId) {
  const doc = await getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests')
    .doc(guestId)
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function addGuest(partyUniqueId, guestData) {
  const ref = getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests');

  const doc = await ref.add({
    ...guestData,
    inviteSent: false,
    inviteSentAt: null,
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: null,
    qrToken: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: doc.id, ...guestData };
}

async function updateGuest(partyUniqueId, guestId, updates) {
  const ref = getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests')
    .doc(guestId);

  await ref.update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

async function deleteGuest(partyUniqueId, guestId) {
  await getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests')
    .doc(guestId)
    .delete();
}

// ---------------------------------------------------------------------------
// Check-in operations
// ---------------------------------------------------------------------------

async function checkInGuest(partyUniqueId, guestId, checkedInBy, actualPlusOnes) {
  const ref = getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests')
    .doc(guestId);

  const doc = await ref.get();
  if (!doc.exists) throw new Error('Guest not found');
  if (doc.data().checkedIn) throw new Error('Guest already checked in');

  const updateData = {
    checkedIn: true,
    checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
    checkedInBy,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If actualPlusOnes provided, store it (how many plus-ones actually arrived)
  if (actualPlusOnes !== undefined && actualPlusOnes !== null) {
    updateData.actualPlusOnes = parseInt(actualPlusOnes) || 0;
  }

  await ref.update(updateData);

  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

async function undoCheckIn(partyUniqueId, guestId) {
  const ref = getDb()
    .collection('parties')
    .doc(partyUniqueId)
    .collection('guests')
    .doc(guestId);

  await ref.update({
    checkedIn: false,
    checkedInAt: null,
    checkedInBy: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

async function getCheckinStats(partyUniqueId) {
  const guests = await getGuests(partyUniqueId);
  const totalGuests = guests.length;
  const checkedIn = guests.filter((g) => g.checkedIn).length;
  const pending = totalGuests - checkedIn;
  const invitesSent = guests.filter((g) => g.inviteSent).length;
  const totalPlusOnes = guests.reduce((sum, g) => sum + (parseInt(g.plusOnes) || 0), 0);
  // Use actualPlusOnes (real arrivals) when available, fallback to expected plusOnes
  const checkedInPlusOnes = guests.filter((g) => g.checkedIn).reduce((sum, g) => {
    const actual = g.actualPlusOnes !== undefined && g.actualPlusOnes !== null ? parseInt(g.actualPlusOnes) : parseInt(g.plusOnes) || 0;
    return sum + actual;
  }, 0);
  const totalExpected = totalGuests + totalPlusOnes;
  const totalArrived = checkedIn + checkedInPlusOnes;

  return {
    totalGuests,
    checkedIn,
    pending,
    invitesSent,
    totalPlusOnes,
    checkedInPlusOnes,
    totalExpected,
    totalArrived,
    arrivalPercentage: totalExpected > 0 ? Math.round((totalArrived / totalExpected) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Find guest by QR token (for scanning)
// ---------------------------------------------------------------------------

async function findGuestByQrToken(qrToken) {
  // We need to search across all parties — use collectionGroup
  const snap = await getDb()
    .collectionGroup('guests')
    .where('qrToken', '==', qrToken)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  // Extract partyUniqueId from the path: parties/{partyId}/guests/{guestId}
  const partyUniqueId = doc.ref.parent.parent.id;

  return {
    id: doc.id,
    partyUniqueId,
    ...doc.data(),
  };
}

module.exports = {
  initFirebase,
  isAvailable,
  getGuests,
  getGuest,
  addGuest,
  updateGuest,
  deleteGuest,
  checkInGuest,
  undoCheckIn,
  getCheckinStats,
  findGuestByQrToken,
};
