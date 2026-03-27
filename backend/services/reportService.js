const sheetsService = require('./sheetsService');
const { parseExpectedPax } = require('../utils/calculations');

/**
 * Generate a daily report for a specific date.
 * @param {string} date - Date string (YYYY-MM-DD or any parseable format)
 * @returns {object} Report data with stats and party lists
 */
async function generateDailyReport(date) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const rows = await sheetsService.getAllRows();

  // Filter rows for the target date
  const dailyParties = rows.filter((row) => {
    const rowDate = normalizeDate(row['Date']);
    return rowDate === normalizeDate(targetDate);
  });

  const allStatuses = rows.map((r) => r['Status']);

  const stats = {
    date: targetDate,
    totalEnquiries: dailyParties.length,
    confirmed: dailyParties.filter((r) => (r['Status'] || '').trim() === 'Confirmed').length,
    tentative: dailyParties.filter((r) => (r['Status'] || '').trim() === 'Tentative').length,
    cancelled: dailyParties.filter((r) => (r['Status'] || '').trim() === 'Cancelled').length,
    enquiry: dailyParties.filter((r) => (r['Status'] || '').trim() === 'Enquiry').length,
    contacted: dailyParties.filter((r) => (r['Status'] || '').trim() === 'Contacted').length,
    totalRevenue: dailyParties.reduce(
      (sum, r) => sum + (parseFloat(r['Final Total Amount']) || 0),
      0
    ),
    totalAdvance: dailyParties.reduce(
      (sum, r) => sum + (parseFloat(r['Total Advance Paid']) || 0),
      0
    ),
    totalDue: dailyParties.reduce(
      (sum, r) => sum + (parseFloat(r['Due Amount']) || 0),
      0
    ),
    totalPax: dailyParties.reduce(
      (sum, r) => sum + (parseExpectedPax(r['Expected Pax']) || 0),
      0
    ),
    // Overall stats (all time)
    overallTotal: rows.length,
    overallConfirmed: allStatuses.filter((s) => s === 'Confirmed').length,
    overallCancelled: allStatuses.filter((s) => s === 'Cancelled').length,
  };

  return {
    stats,
    parties: dailyParties.map(sanitizeForReport),
  };
}

/**
 * Generate a report for a date range.
 * @param {string} fromDate - Start date
 * @param {string} toDate - End date
 * @returns {object} Report data
 */
async function generateRangeReport(fromDate, toDate) {
  const rows = await sheetsService.getAllRows();

  const from = normalizeDate(fromDate);
  const to = normalizeDate(toDate);

  const filtered = rows.filter((row) => {
    const rowDate = normalizeDate(row['Date']);
    if (!rowDate) return false;
    return rowDate >= from && rowDate <= to;
  });

  const knownStatuses = ['Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'];
  const stats = {
    fromDate: from,
    toDate: to,
    total: filtered.length,
    totalEnquiries: filtered.length,
    confirmed: filtered.filter((r) => (r['Status'] || '').trim() === 'Confirmed').length,
    tentative: filtered.filter((r) => (r['Status'] || '').trim() === 'Tentative').length,
    cancelled: filtered.filter((r) => (r['Status'] || '').trim() === 'Cancelled').length,
    enquiry: filtered.filter((r) => (r['Status'] || '').trim() === 'Enquiry').length,
    enquiries: filtered.filter((r) => (r['Status'] || '').trim() === 'Enquiry').length,
    contacted: filtered.filter((r) => (r['Status'] || '').trim() === 'Contacted').length,
    unknown: filtered.filter((r) => {
      const s = (r['Status'] || '').trim();
      return !s || !knownStatuses.includes(s);
    }).length,
    totalRevenue: filtered.reduce(
      (sum, r) => sum + (parseFloat(r['Final Total Amount']) || 0),
      0
    ),
    totalAdvance: filtered.reduce(
      (sum, r) => sum + (parseFloat(r['Total Advance Paid']) || 0),
      0
    ),
    pendingDues: filtered.reduce(
      (sum, r) => sum + (parseFloat(r['Due Amount']) || 0),
      0
    ),
    amountPaid: filtered.reduce(
      (sum, r) => sum + (parseFloat(r['Total Paid']) || 0),
      0
    ),
    totalDue: filtered.reduce(
      (sum, r) => sum + (parseFloat(r['Due Amount']) || 0),
      0
    ),
    totalPax: filtered.reduce(
      (sum, r) => sum + (parseExpectedPax(r['Expected Pax']) || 0),
      0
    ),
    totalEstimatedRevenue: filtered.reduce(
      (sum, r) => sum + (parseFloat(r['Final Total Amount']) || 0),
      0
    ),
  };

  return {
    stats,
    parties: filtered.map(sanitizeForReport),
  };
}

/**
 * Format report data into a styled HTML email template.
 * @param {object} reportData - Output from generateDailyReport or generateRangeReport
 * @returns {string} HTML string
 */
function formatReportHTML(reportData) {
  const { stats, parties } = reportData;
  const dateLabel = stats.fromDate
    ? `${stats.fromDate} to ${stats.toDate}`
    : stats.date;

  const partyRows = parties
    .map(
      (p, i) => `
      <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
        <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Date']}</td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Host Name']}</td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Phone Number']}</td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Status']}</td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Expected Pax']}</td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6;">${p['Package Selected']}</td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6; text-align: right;">
          ${formatCurrency(p['Final Total Amount'] || p['Approx Bill Amount'])}
        </td>
        <td style="padding: 6px 10px; border: 1px solid #dee2e6; text-align: right;">
          ${formatCurrency(p['Due Amount'])}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <div style="background: #2c3e50; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">AKAN Party Manager</h1>
        <p style="margin: 5px 0 0; opacity: 0.8;">Daily Report - ${dateLabel}</p>
      </div>

      <!-- Stats Cards -->
      <div style="display: flex; flex-wrap: wrap; gap: 10px; padding: 20px 0;">
        ${statCard('Total Enquiries', stats.totalEnquiries, '#3498db')}
        ${statCard('Confirmed', stats.confirmed, '#27ae60')}
        ${statCard('Tentative', stats.tentative, '#f39c12')}
        ${statCard('Cancelled', stats.cancelled, '#e74c3c')}
        ${statCard('Enquiry', stats.enquiry, '#9b59b6')}
      </div>

      <!-- Financial Summary -->
      <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 10px 0;">
        <h3 style="margin: 0 0 10px; color: #2c3e50;">Financial Summary</h3>
        <table style="width: 100%;">
          <tr>
            <td><strong>Total Revenue:</strong></td>
            <td style="text-align: right;">${formatCurrency(stats.totalRevenue)}</td>
          </tr>
          <tr>
            <td><strong>Total Advance Collected:</strong></td>
            <td style="text-align: right;">${formatCurrency(stats.totalAdvance)}</td>
          </tr>
          <tr>
            <td><strong>Total Dues Pending:</strong></td>
            <td style="text-align: right; color: #e74c3c;">${formatCurrency(stats.totalDue)}</td>
          </tr>
          <tr>
            <td><strong>Total Pax:</strong></td>
            <td style="text-align: right;">${stats.totalPax}</td>
          </tr>
        </table>
      </div>

      <!-- Party Details Table -->
      ${
        parties.length > 0
          ? `
        <h3 style="color: #2c3e50; margin-top: 20px;">Party Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #2c3e50; color: #ffffff;">
              <th style="padding: 8px 10px; text-align: left;">Date</th>
              <th style="padding: 8px 10px; text-align: left;">Event/Host</th>
              <th style="padding: 8px 10px; text-align: left;">Phone</th>
              <th style="padding: 8px 10px; text-align: left;">Status</th>
              <th style="padding: 8px 10px; text-align: left;">Pax</th>
              <th style="padding: 8px 10px; text-align: left;">Package</th>
              <th style="padding: 8px 10px; text-align: right;">Bill</th>
              <th style="padding: 8px 10px; text-align: right;">Due</th>
            </tr>
          </thead>
          <tbody>${partyRows}</tbody>
        </table>
      `
          : '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No parties found for this period.</p>'
      }

      <div style="border-top: 1px solid #dee2e6; margin-top: 20px; padding-top: 10px;">
        <p style="color: #7f8c8d; font-size: 11px; text-align: center;">
          Generated on ${new Date().toLocaleString()} | AKAN Party Manager
        </p>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statCard(label, value, color) {
  return `
    <div style="flex: 1; min-width: 120px; background: ${color}; color: #fff;
                padding: 15px; border-radius: 5px; text-align: center;">
      <div style="font-size: 28px; font-weight: bold;">${value}</div>
      <div style="font-size: 12px; opacity: 0.9;">${label}</div>
    </div>
  `;
}

function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return '\u20B9' + num.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

/**
 * Normalize a date string to YYYY-MM-DD for consistent comparison.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = dateStr.toString().trim();
  // Parse TBC dates like "TBC: April 2026" → first day of that month
  if (trimmed.toUpperCase().startsWith('TBC')) {
    const match = trimmed.match(/TBC:\s*(\w+)\s+(\d{4})/i);
    if (match) {
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const mIdx = months.indexOf(match[1].toLowerCase());
      if (mIdx !== -1) {
        return `${match[2]}-${String(mIdx + 1).padStart(2, '0')}-15`;
      }
    }
    return '';
  }
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Try parsing
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

/**
 * Strip internal fields from a row for report output.
 */
function sanitizeForReport(row) {
  const { _rowIndex, ...clean } = row;
  return clean;
}

module.exports = {
  generateDailyReport,
  generateRangeReport,
  formatReportHTML,
};
