// ============================================================================
// Place / Floor Conflict Detection
// ----------------------------------------------------------------------------
// Each PLACE is mapped to a set of "zones" it physically occupies.
// Two bookings conflict if their zone sets intersect, OR if one is a
// floor-wide "Exclusive" booking (zone ending in ":*") on the same floor.
// ============================================================================

// Floor wildcards: '1F:*' means the entire 1st floor is occupied
export const PLACE_ZONES = {
 // ───── 1st Floor ─────
 '1st Floor Exclusive':       ['1F:*'],
 '1st Floor FA Area Full':    ['1F:FA-Full', '1F:FA-Corner', '1F:FA-Entrance'],
 '1st Floor FA Corner':       ['1F:FA-Corner'],
 '1st Floor FA Entrance':     ['1F:FA-Entrance'],
 '1st Floor FB Area Full':    ['1F:FB-Full', '1F:FB-Front', '1F:FB-Back'],
 '1st Floor FB Front':        ['1F:FB-Front'],
 '1st Floor FB Back':         ['1F:FB-Back'],
 '1st Floor FBR Area Full':   ['1F:FBR'],

 // ───── 2nd Floor ─────
 '2nd Floor Exclusive':            ['2F:*'],
 '2nd Floor Indoor Exclusive':     ['2F:Indoor', '2F:SA', '2F:SB'],
 '2nd Floor Outdoor':              ['2F:Outdoor'],
 '2nd Floor SA Full':              ['2F:SA'],
 '2nd Floor SB Full':              ['2F:SB'],

 // ───── 3rd Floor ─────
 '3rd Floor Rooftop Exclusive':    ['3F:*'],
 '3rd Floor Lake View':            ['3F:LakeView'],
 '3rd Floor Stage Side':           ['3F:StageSide'],
 '3rd Floor Bar Side':             ['3F:BarSide'],
};

// Extract floor from any place string ("1st Floor FA Area Full" → "1st Floor")
export function extractFloor(place) {
 if (!place) return '';
 const m = place.match(/^(1st|2nd|3rd)\s+Floor/i);
 return m ? `${m[1]} Floor` : '';
}

// Map "1st Floor" → "1F", "2nd Floor" → "2F", "3rd Floor" → "3F"
function floorPrefix(floor) {
 const m = floor.match(/^(1st|2nd|3rd)/i);
 if (!m) return '';
 return m[1].charAt(0) + 'F';
}

// Get zones for a place. Unknown/custom places fall back to floor-level only.
function getZones(place) {
 if (!place) return [];
 if (PLACE_ZONES[place]) return PLACE_ZONES[place];
 // Custom place: treat as occupying the whole floor (conservative — better to warn)
 const floor = extractFloor(place);
 if (!floor) return [];
 return [`${floorPrefix(floor)}:custom`];
}

// True if booking placeA conflicts with booking placeB
export function conflictsWith(placeA, placeB) {
 if (!placeA || !placeB) return false;
 if (placeA === placeB) return true;

 const fa = extractFloor(placeA);
 const fb = extractFloor(placeB);
 if (!fa || !fb || fa !== fb) return false; // different floors → no conflict

 const za = getZones(placeA);
 const zb = getZones(placeB);
 const fp = floorPrefix(fa);

 // Wildcard: Floor Exclusive conflicts with everything on that floor
 if (za.includes(`${fp}:*`) || zb.includes(`${fp}:*`)) return true;

 // Custom (unknown) place on same floor → flag conservatively
 if (za.includes(`${fp}:custom`) || zb.includes(`${fp}:custom`)) return true;

 // Otherwise zones must intersect
 return za.some((z) => zb.includes(z));
}

// Filter list of parties → only those that conflict with the given place,
// have status Confirmed/Tentative, and are not the excluded party.
export function findPlaceConflicts(parties, place, excludeUniqueId) {
 if (!place) return [];
 return parties.filter((p) => {
  if (excludeUniqueId && p.uniqueId === excludeUniqueId) return false;
  if (!['Confirmed', 'Tentative'].includes(p.status)) return false;
  return conflictsWith(place, p.place);
 });
}
