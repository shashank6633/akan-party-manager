import { useState, useEffect, useRef } from 'react';
import { subscribeToGuests, subscribeToStats, isFirebaseConfigured } from '../services/firebaseClient';

/**
 * Hook for real-time guest list updates via Firestore.
 * Falls back to polling via REST API if Firebase isn't configured.
 */
export function useCheckinGuests(partyUniqueId, { fallbackFetch, pollInterval = 10000 } = {}) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRealtime, setIsRealtime] = useState(false);

  useEffect(() => {
    if (!partyUniqueId) return;

    setLoading(true);

    if (isFirebaseConfigured()) {
      // Real-time via Firestore
      setIsRealtime(true);
      const unsub = subscribeToGuests(partyUniqueId, (guestList) => {
        setGuests(guestList);
        setLoading(false);
      });
      return () => unsub();
    } else if (fallbackFetch) {
      // Polling fallback
      setIsRealtime(false);
      let active = true;

      const poll = async () => {
        try {
          const data = await fallbackFetch(partyUniqueId);
          if (active) {
            setGuests(data);
            setLoading(false);
          }
        } catch (err) {
          console.error('Guest poll error:', err);
          if (active) setLoading(false);
        }
      };

      poll();
      const interval = setInterval(poll, pollInterval);
      return () => {
        active = false;
        clearInterval(interval);
      };
    } else {
      setLoading(false);
    }
  }, [partyUniqueId]);

  return { guests, loading, isRealtime, setGuests };
}

/**
 * Hook for real-time check-in stats.
 */
export function useCheckinStats(partyUniqueId) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partyUniqueId) return;

    setLoading(true);

    if (isFirebaseConfigured()) {
      const unsub = subscribeToStats(partyUniqueId, (s) => {
        setStats(s);
        setLoading(false);
      });
      return () => unsub();
    } else {
      setLoading(false);
    }
  }, [partyUniqueId]);

  return { stats, loading };
}
