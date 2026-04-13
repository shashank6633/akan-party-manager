/**
 * Firebase Client SDK for real-time Firestore listeners.
 * Used on the frontend for live check-in updates.
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';

let _app = null;
let _db = null;

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return !!(config.apiKey && config.projectId);
}

export function getFirestoreDb() {
  if (_db) return _db;

  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    console.warn('[Firebase] Not configured — real-time features disabled.');
    return null;
  }

  _app = initializeApp(config);
  _db = getFirestore(_app);
  return _db;
}

/**
 * Subscribe to real-time guest list updates for a party.
 * @param {string} partyUniqueId
 * @param {function} callback - Called with array of guest objects
 * @returns {function} Unsubscribe function
 */
export function subscribeToGuests(partyUniqueId, callback) {
  const db = getFirestoreDb();
  if (!db) {
    console.warn('[Firebase] Cannot subscribe — not configured.');
    return () => {};
  }

  const guestsRef = collection(db, 'parties', partyUniqueId, 'guests');
  const q = query(guestsRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const guests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(guests);
    },
    (error) => {
      console.error('[Firebase] Snapshot error:', error);
    }
  );
}

/**
 * Subscribe to real-time stats changes (by listening to all guests).
 * Computes stats client-side from the guest list.
 * @param {string} partyUniqueId
 * @param {function} callback - Called with stats object
 * @returns {function} Unsubscribe function
 */
export function subscribeToStats(partyUniqueId, callback) {
  return subscribeToGuests(partyUniqueId, (guests) => {
    const totalGuests = guests.length;
    const checkedIn = guests.filter((g) => g.checkedIn).length;
    const invitesSent = guests.filter((g) => g.inviteSent).length;
    const totalPlusOnes = guests.reduce((s, g) => s + (parseInt(g.plusOnes) || 0), 0);
    const checkedInPlusOnes = guests
      .filter((g) => g.checkedIn)
      .reduce((s, g) => s + (parseInt(g.plusOnes) || 0), 0);
    const totalExpected = totalGuests + totalPlusOnes;
    const totalArrived = checkedIn + checkedInPlusOnes;

    callback({
      totalGuests,
      checkedIn,
      pending: totalGuests - checkedIn,
      invitesSent,
      totalPlusOnes,
      checkedInPlusOnes,
      totalExpected,
      totalArrived,
      arrivalPercentage: totalExpected > 0 ? Math.round((totalArrived / totalExpected) * 100) : 0,
    });
  });
}
