export const formatCurrency = (amount) => {
 if (!amount && amount !== 0) return '-';
 return new Intl.NumberFormat('en-IN', {
 style: 'currency',
 currency: 'INR',
 maximumFractionDigits: 0,
 }).format(amount);
};

export const formatDate = (dateStr) => {
 if (!dateStr) return '-';
 // Handle "TBC: Month Year" format
 if (dateStr.toString().startsWith('TBC:')) {
 return dateStr; // Show as-is e.g. "TBC: March 2026"
 }
 const d = new Date(dateStr);
 if (isNaN(d.getTime())) return dateStr;
 return d.toLocaleDateString('en-IN', {
 day: '2-digit',
 month: 'short',
 year: 'numeric',
 });
};

export const isTBCDate = (dateStr) => {
 return dateStr && dateStr.toString().startsWith('TBC:');
};

export const getStatusColor = (status) => {
 const colors = {
 Enquiry: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
 Contacted: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
 Tentative: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
 Confirmed: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
 Cancelled: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
 };
 return colors[status] || colors.Enquiry;
};

export const getPaymentStatus = (bill, totalPaid) => {
 if (!bill) return { label: 'No Bill', color: 'text-gray-500' };
 if (!totalPaid || totalPaid === 0) return { label: 'Unpaid', color: 'text-red-500' };
 if (totalPaid >= bill) return { label: 'Paid', color: 'text-green-500' };
 return { label: 'Partial', color: 'text-orange-500' };
};

/**
 * Generate WhatsApp-friendly text template for sharing party details.
 */
/**
 * Ensure phone number has "+" prefix for display.
 */
export const formatPhoneDisplay = (phone) => {
 if (!phone) return '-';
 const cleaned = phone.toString().trim();
 if (cleaned.startsWith('+')) return cleaned;
 if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
 if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
 return `+${cleaned}`;
};

/**
 * Generate WhatsApp-friendly text template for sharing party details.
 * @param {object} party - Party data
 * @param {string} [userName] - Name of the user sending the message
 */
export const generateWhatsAppMessage = (party, userName, { isNew = false, greName = '' } = {}) => {
 const phone = formatPhoneDisplay(party.phoneNumber);
 const heading = isNew ? '🎉 *New Party Enquiry*' : '📋 *Enquired Party Details*';
 const lines = [
 heading,
 ``,
 `📋 *ID:* ${party.uniqueId || '-'}`,
 `📅 *Date:* ${party.date || '-'}`,
 `👤 *Host:* ${party.hostName || '-'}`,
 `📞 *Phone:* ${phone}`,
 `🏢 *Company:* ${party.company || '-'}`,
 `📍 *Place:* ${party.place || '-'}`,
 ];
 if (party.altContact) lines.push(`📞 *Alt Contact:* ${party.altContact}`);
 if (party.occasionType) lines.push(`🎊 *Occasion:* ${party.occasionType}`);
 if (party.mealType) lines.push(`🍽️ *Meal:* ${party.mealType}`);
 if (party.expectedPax) lines.push(`👥 *Expected Pax:* ${party.expectedPax}`);
 if (party.packageSelected) lines.push(`📦 *Package:* ${party.packageSelected}`);
 if (party.specialRequirements) lines.push(`⚡ *Special Requirements:* ${party.specialRequirements}`);
 if (party.remarks) lines.push(`📝 *Remarks:* ${party.remarks}`);
 if (greName) lines.push(`🧑‍💼 *Enquiry Taken By:* ${greName}`);
 lines.push(``, `🔖 *Status:* ${party.status || 'Enquiry'}`);

 // Follow-up Tracking Info
 if (party.followUpNotes) {
  lines.push(``, `📌 *Follow-Up Notes:*`);
  const notes = party.followUpNotes.split('\n').filter(Boolean);
  notes.slice(0, 5).forEach((note) => lines.push(`  ${note}`));
  if (notes.length > 5) lines.push(`  _...and ${notes.length - 5} more_`);
 }
 if (party.lastFollowUpDate) lines.push(`📅 *Last Follow-Up:* ${party.lastFollowUpDate}`);

 // Payment Info
 if (party.dueAmount && parseFloat(party.dueAmount) > 0) {
  lines.push(``, `💰 *Due Amount:* ₹${parseFloat(party.dueAmount).toLocaleString('en-IN')}`);
  if (party.balancePaymentDate) lines.push(`📅 *Balance Payment Date:* ${party.balancePaymentDate}`);
 }

 const sentBy = userName ? `_Sent by ${userName} | AKAN Party Manager_` : `_Sent from AKAN Party Manager_`;
 lines.push(``, sentBy);
 return lines.join('\n');
};

export const copyToClipboard = async (text) => {
 try {
 await navigator.clipboard.writeText(text);
 return true;
 } catch {
 // Fallback for older browsers
 const textarea = document.createElement('textarea');
 textarea.value = text;
 document.body.appendChild(textarea);
 textarea.select();
 document.execCommand('copy');
 document.body.removeChild(textarea);
 return true;
 }
};

export const exportToExcel = (data, filename = 'export') => {
 const csv = [
 Object.keys(data[0]).join(','),
 ...data.map((row) => Object.values(row).map((v) => `"${v ?? ''}"`).join(',')),
 ].join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${filename}.csv`;
 a.click();
 URL.revokeObjectURL(url);
};

export const exportToPDF = async (data, filename = 'export') => {
 // Placeholder - would use jsPDF or similar
 console.log('PDF export', data, filename);
};

export const validatePhone = (phone) => {
 const cleaned = phone.replace(/[\s-]/g, '');
 return /^(\+?91)?[6-9]\d{9}$/.test(cleaned);
};

export const debounce = (fn, ms = 300) => {
 let timer;
 return (...args) => {
 clearTimeout(timer);
 timer = setTimeout(() => fn(...args), ms);
 };
};
