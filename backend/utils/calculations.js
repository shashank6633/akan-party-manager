/**
 * Auto-calculation utilities for party booking fields.
 * All functions handle null/undefined/NaN inputs gracefully, returning 0.
 */

/**
 * Parse Expected Pax which may be a range like "40-60" → avg 50, or a plain number.
 */
/**
 * Parse Expected Pax - for ranges like "40-60", returns the MINIMUM (40) as minimum guarantee.
 */
function parseExpectedPax(val) {
  if (!val) return 0;
  const rangeMatch = val.toString().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) return parseInt(rangeMatch[1]); // minimum guarantee
  return parseFloat(val) || 0;
}

/**
 * Calculate Final Total Amount: Confirmed Pax × Final Rate
 * @param {number|string} confirmedPax
 * @param {number|string} finalRate
 * @returns {number}
 */
function calculateFinalTotal(confirmedPax, finalRate) {
  const pax = parseFloat(confirmedPax) || 0;
  const rate = parseFloat(finalRate) || 0;
  if (pax === 0 || rate === 0) return 0;
  return pax * rate;
}

/**
 * Parse Payment Log JSON string and calculate totals.
 * Payment Log is a JSON array: [{ amount, type, method, note, date, recordedBy }, ...]
 * type can be "advance" or "payment"
 * @param {string} paymentLogStr - JSON string of payment entries
 * @returns {{ totalAdvancePaid: number, totalPaid: number, totalAmountPaid: number }}
 */
function calculatePaymentTotals(paymentLogStr) {
  let entries = [];
  try {
    if (paymentLogStr && typeof paymentLogStr === 'string') {
      entries = JSON.parse(paymentLogStr);
    }
    if (!Array.isArray(entries)) entries = [];
  } catch {
    entries = [];
  }

  let totalAdvancePaid = 0;
  let totalPaid = 0;

  for (const entry of entries) {
    const amount = parseFloat(entry.amount) || 0;
    if (entry.type === 'advance') {
      totalAdvancePaid += amount;
    } else {
      totalPaid += amount;
    }
  }

  return {
    totalAdvancePaid,
    totalPaid,
    totalAmountPaid: totalAdvancePaid + totalPaid,
  };
}

/**
 * Apply all auto-calculations to a party data object (mutates and returns).
 * @param {object} data - Party data keyed by column name
 * @returns {object} data with calculated fields filled in
 */
function applyAutoCalculations(data, changedFields) {
  // Final Total Amount = Confirmed Pax × Final Rate
  // Only auto-calc when Confirmed Pax or Final Rate is explicitly being changed
  // If Final Total Amount is explicitly provided, respect it (e.g. includes activities)
  const finalTotalExplicit = changedFields && changedFields['Final Total Amount'] !== undefined;
  if (!finalTotalExplicit) {
    const cfChanged = changedFields
      ? (changedFields['Confirmed Pax'] !== undefined || changedFields['Final Rate'] !== undefined)
      : (data['Confirmed Pax'] !== undefined || data['Final Rate'] !== undefined);
    if (cfChanged) {
      const total = calculateFinalTotal(data['Confirmed Pax'], data['Final Rate']);
      if (total > 0) {
        data['Final Total Amount'] = total;
      }
    }
  }

  // Payment totals from Payment Log (only if Payment Log has entries)
  const paymentLogStr = data['Payment Log'];
  const hasPaymentLog = paymentLogStr && typeof paymentLogStr === 'string' && paymentLogStr.trim() !== '' && paymentLogStr.trim() !== '[]';

  if (hasPaymentLog) {
    const totals = calculatePaymentTotals(paymentLogStr);
    data['Total Advance Paid'] = totals.totalAdvancePaid;
    data['Total Paid'] = totals.totalPaid;
    data['Total Amount Paid'] = totals.totalAmountPaid;
  } else {
    // Use directly provided values (e.g. from Cashier Billing form)
    const advance = parseFloat(data['Total Advance Paid']) || 0;
    const paid = parseFloat(data['Total Paid']) || 0;
    data['Total Amount Paid'] = advance + paid;
  }

  // Due Amount = Final Total Amount - Total Amount Paid
  {
    const finalTotal = parseFloat(data['Final Total Amount']) || 0;
    const totalAmountPaid = parseFloat(data['Total Amount Paid']) || 0;
    data['Due Amount'] = Math.max(0, finalTotal - totalAmountPaid);
  }

  // Auto-calculate Approx Bill Amount = least Expected Pax × Confirmed Final Rate
  if (data['Confirmed Final Rate'] !== undefined || data['Expected Pax'] !== undefined) {
    const rateStr = data['Confirmed Final Rate'] || '';
    const paxStr = data['Expected Pax'] || '';
    const rate = parseFloat(rateStr) || 0;
    // Parse least pax from ranges like "100-150" or "80"
    const paxParts = String(paxStr).split(/[-–\/]/).map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
    const leastPax = paxParts.length > 0 ? Math.min(...paxParts) : 0;
    if (rate > 0 && leastPax > 0) {
      data['Approx Bill Amount'] = Math.round(leastPax * rate);
    }
  }

  return data;
}

/**
 * Convert a sheet column name to camelCase for the frontend.
 * e.g. "Host Name" -> "hostName"
 *      "Expected Pax" -> "expectedPax"
 *      "_rowIndex" stays as is
 */
function columnToCamel(col) {
  if (col.startsWith('_')) return col;
  return col
    .split(/[\s\-]+/)
    .map((word, i) =>
      i === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}

/**
 * Convert camelCase field name back to sheet column name.
 * Uses the provided COLUMNS array for lookup.
 */
function camelToColumn(camelKey, columns) {
  // Build reverse map (rebuilt each call to handle column changes)
  if (!camelToColumn._cache || camelToColumn._columns !== columns) {
    camelToColumn._cache = {};
    camelToColumn._columns = columns;
    columns.forEach((col) => {
      camelToColumn._cache[columnToCamel(col)] = col;
    });
  }
  return camelToColumn._cache[camelKey] || camelKey;
}

/**
 * Convert a sheet-keyed object to camelCase-keyed object for the API response.
 */
function toCamelCase(obj) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key === '_rowIndex' ? 'rowIndex' : columnToCamel(key)] = val;
  }
  return result;
}

/**
 * Convert a camelCase-keyed object to sheet column-keyed object for writing.
 */
function toSheetFormat(obj, columns) {
  if (!obj) return obj;
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const col = camelToColumn(key, columns);
    result[col] = val;
  }
  return result;
}

module.exports = {
  calculateFinalTotal,
  calculatePaymentTotals,
  applyAutoCalculations,
  toCamelCase,
  toSheetFormat,
  columnToCamel,
  camelToColumn,
  parseExpectedPax,
};
