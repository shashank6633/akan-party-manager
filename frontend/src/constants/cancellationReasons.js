/**
 * Categorized reasons for party cancellations.
 *
 * Captured at cancel-time so the team can later analyse where deals are
 * being lost. Stored alongside the free-text Lost Reason in the existing
 * `lostReason` sheet column using the format:
 *
 *   [Category > Sub-Reason] free-text detail
 *
 * Reports can pull category counts by parsing the `[ ... ]` prefix.
 */

export const CANCEL_CATEGORIES = [
  {
    label: 'Client-side',
    reasons: [
      'No response / unreachable',
      'Budget mismatch',
      'Plan changed (celebrating at home / shifted city)',
      'Personal reasons (illness, family emergency)',
      'Travel disruption',
      'Pending internal approvals',
      'Headcount dropped / group too small',
      'Postponed (date TBD)',
    ],
  },
  {
    label: 'Venue / Offer mismatch',
    reasons: [
      'Menu options insufficient for budget',
      'Music / entertainment not available (DJ, Bollywood, live)',
      'Ambience / lighting not suitable',
      'Exclusivity not possible (rooftop / dedicated floor)',
    ],
  },
  {
    label: 'Competitor',
    reasons: [
      'Better price elsewhere',
      'More inclusions in same budget',
      'Closer to home / office',
      'Prior relationship with another venue',
      'Chose alternate format (farmhouse, banquet hall, club house, café, à la carte)',
    ],
  },
  {
    label: 'Internal (Akan-side)',
    reasons: [
      'Overbooked / clashing event (e.g. Sundowner)',
      'Date unavailable',
      'Could not match special request',
    ],
  },
  {
    label: 'External',
    reasons: [
      'Geopolitical / leadership travel (e.g. Middle East, war)',
      'Force majeure',
    ],
  },
  {
    label: 'Other',
    reasons: ['Other (specify in detail below)'],
  },
];

/**
 * Build the "Category > Reason" string used as the dropdown value and
 * stored prefix in the lostReason field.
 */
export function makeReasonValue(category, reason) {
  return `${category} > ${reason}`;
}

/**
 * Combine a selected category/reason with free-text into the final
 * lostReason string saved to the sheet.
 */
export function buildLostReason(categoryReason, freeText) {
  const detail = (freeText || '').trim();
  if (!categoryReason) return detail;
  const tag = `[${categoryReason}]`;
  return detail ? `${tag} ${detail}` : tag;
}

/**
 * Parse a stored lostReason back into { category, reason, detail }.
 * Reports can use this to count cancellations by category.
 *
 * Examples:
 *   "[Competitor > Better price elsewhere] Marriott quoted 15% lower"
 *     → { category: 'Competitor', reason: 'Better price elsewhere',
 *         detail: 'Marriott quoted 15% lower' }
 *   "Just changed their mind"
 *     → { category: null, reason: null, detail: 'Just changed their mind' }
 */
export function parseLostReason(text) {
  if (!text) return { category: null, reason: null, detail: '' };
  const m = String(text).match(/^\[([^\]>]+?)\s*>\s*([^\]]+?)\]\s*(.*)$/);
  if (!m) return { category: null, reason: null, detail: String(text).trim() };
  return { category: m[1].trim(), reason: m[2].trim(), detail: m[3].trim() };
}
