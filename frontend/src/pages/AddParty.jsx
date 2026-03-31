import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 Save,
 Loader2,
 AlertTriangle,
 CheckCircle,
 Zap,
 ChevronDown,
 ChevronUp,
 Copy,
 Share2,
} from 'lucide-react';
import { partyAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { validatePhone, formatCurrency, generateWhatsAppMessage, copyToClipboard } from '../utils/helpers';

// GRE can only fill these fields for new enquiry
const GRE_FIELDS = [
 'date', 'hostName', 'phoneNumber', 'altContact', 'company',
 'guestVisited', 'status', 'place', 'mealType',
 'expectedPax', 'remarks', 'occasionType', 'specialRequirements',
 'handledBy',
];

const MONTHS = [
 'January', 'February', 'March', 'April', 'May', 'June',
 'July', 'August', 'September', 'October', 'November', 'December',
];

const EMPTY_FORM = {
 date: new Date().toISOString().split('T')[0],
 dateNotConfirmed: false,
 tentativeMonth: '',
 tentativeYear: new Date().getFullYear().toString(),
 hostName: '',
 phoneNumber: '',
 altContact: '',
 company: '',
 guestVisited: '',
 status: 'Enquiry',
 place: '',
 mealType: '',
 expectedPax: '',
 packageSelected: '',
 remarks: '',
 lostReason: '',
 fpIssued: '',
 specialRequirements: '',
 occasionType: '',
 guestEmail: '',
 approxBillAmount: '',
 confirmedPax: '',
 finalRate: '',
 finalTotalAmount: '',
 handledBy: '',
};

const DRAFT_KEY = 'akan_party_draft_v2';

export default function AddParty() {
 const navigate = useNavigate();
 const { user } = useAuth();
 const isGRE = user?.role === 'GRE';
 const [form, setForm] = useState(() => {
 const draft = localStorage.getItem(DRAFT_KEY);
 return draft ? { ...EMPTY_FORM, ...JSON.parse(draft) } : { ...EMPTY_FORM };
 });
 const [quickMode, setQuickMode] = useState(false);
 const [loading, setLoading] = useState(false);
 const [success, setSuccess] = useState(false);
 const [createdParty, setCreatedParty] = useState(null);
 const [copied, setCopied] = useState(false);
 const [error, setError] = useState('');
 const [duplicateWarning, setDuplicateWarning] = useState('');
 const [phoneError, setPhoneError] = useState('');
 const [showBilling, setShowBilling] = useState(true);
 const [showAdditional, setShowAdditional] = useState(false);
 const [handlerUsers, setHandlerUsers] = useState([]);

 // Fetch SALES/MANAGER/ADMIN users for "Handled By" dropdown
 useEffect(() => {
 authAPI.getUsers().then((res) => {
  const users = (res.data.users || [])
   .filter((u) => ['SALES', 'MANAGER', 'ADMIN'].includes(u.role) && u.isActive !== false)
   .map((u) => u.name || u.username);
  setHandlerUsers(users);
 }).catch(() => {});
 }, []);

 // Auto-save draft
 useEffect(() => {
 const timer = setTimeout(() => {
 const hasData = Object.values(form).some((v) => v !== '' && v !== 'Enquiry');
 if (hasData) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
 }, 1000);
 return () => clearTimeout(timer);
 }, [form]);

 // Parse expected pax range (e.g. "40-60" → minimum guarantee 40, "50" → 50)
 const parseExpectedPax = (val) => {
 if (!val) return 0;
 const rangeMatch = val.toString().match(/^(\d+)\s*[-–]\s*(\d+)$/);
 if (rangeMatch) return parseInt(rangeMatch[1]); // minimum guarantee
 return parseFloat(val) || 0;
 };

 // Auto-calculations
 useEffect(() => {
 const pax = parseFloat(form.confirmedPax) || parseExpectedPax(form.expectedPax) || 0;
 const rate = parseFloat(form.finalRate) || 0;

 const updates = {};
 if (pax && rate) updates.finalTotalAmount = String(pax * rate);
 if (Object.keys(updates).length > 0) {
 setForm((prev) => ({ ...prev, ...updates }));
 }
 }, [form.confirmedPax, form.expectedPax, form.finalRate]);

 const handleChange = (field, value) => {
 setForm((prev) => ({ ...prev, [field]: value }));
 if (field === 'phoneNumber') {
 if (value && !validatePhone(value)) setPhoneError('Invalid Indian phone number');
 else setPhoneError('');
 }
 };

 // Check duplicates on phone + date change
 useEffect(() => {
 if (form.phoneNumber && form.date && validatePhone(form.phoneNumber)) {
 const timer = setTimeout(async () => {
 try {
 const res = await partyAPI.getAll({ search: form.phoneNumber, dateFrom: form.date, dateTo: form.date });
 if (res.data.parties?.length > 0) {
 setDuplicateWarning(`Possible duplicate: ${res.data.parties[0].hostName} on ${form.date}`);
 } else {
 setDuplicateWarning('');
 }
 } catch {
 setDuplicateWarning('');
 }
 }, 800);
 return () => clearTimeout(timer);
 } else {
 setDuplicateWarning('');
 }
 }, [form.phoneNumber, form.date]);

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!form.hostName) {
 setError('Host Name is required.');
 return;
 }
 if (!form.phoneNumber || !form.phoneNumber.trim()) {
 setError('Phone Number is required.');
 return;
 }
 if (!form.company || !form.company.trim()) {
 setError('Company Name is required.');
 return;
 }
 if (isGRE && !form.expectedPax) {
 setError('Expected Pax is required.');
 return;
 }
 if (!form.dateNotConfirmed && !form.date) {
 setError('Date is required (or mark as Date Not Confirmed).');
 return;
 }
 if (form.dateNotConfirmed && !form.tentativeMonth) {
 setError('Please select a tentative month.');
 return;
 }
 setError('');
 setLoading(true);
 try {
 const submitData = { ...form };
 if (form.dateNotConfirmed) {
 submitData.date = `TBC: ${form.tentativeMonth} ${form.tentativeYear}`;
 }
 // Clean up helper fields before sending
 delete submitData.dateNotConfirmed;
 delete submitData.tentativeMonth;
 delete submitData.tentativeYear;
 const res = await partyAPI.create(submitData);
 localStorage.removeItem(DRAFT_KEY);
 setCreatedParty(res.data.data);
 setSuccess(true);
 } catch (err) {
 setError(err.response?.data?.message || 'Failed to save party. Please try again.');
 } finally {
 setLoading(false);
 }
 };

 const handleCopyWhatsApp = async () => {
 if (!createdParty) return;
 const greName = user?.role === 'GRE' ? (user?.name || user?.username) : '';
 const msg = generateWhatsAppMessage(createdParty, user?.name || user?.username, { isNew: true, greName });
 await copyToClipboard(msg);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 const clearDraft = () => {
 localStorage.removeItem(DRAFT_KEY);
 setForm({ ...EMPTY_FORM });
 };

 const renderInput = (label, field, { type = 'text', required, placeholder, readOnly, ...props } = {}) => (
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">
 {label} {required && <span className="text-red-500">*</span>}
 </label>
 <input
 type={type}
 value={form[field]}
 onChange={(e) => handleChange(field, e.target.value)}
 placeholder={placeholder}
 readOnly={readOnly}
 className={`w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-colors ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
 {...props}
 />
 </div>
 );

 const renderSelect = (label, field, options, { required } = {}) => (
 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1">
 {label} {required && <span className="text-red-500">*</span>}
 </label>
 <select
 value={form[field]}
 onChange={(e) => handleChange(field, e.target.value)}
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 >
 <option value="">Select...</option>
 {options.map((o) => (
 <option key={o} value={o}>{o}</option>
 ))}
 </select>
 </div>
 );

 const renderSectionHeader = (title, open, onToggle) => (
 <button
 type="button"
 onClick={onToggle}
 className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-700 hover:text-[#af4408] transition-colors"
 >
 {title}
 {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
 </button>
 );

 // Success screen with WhatsApp copy template
 if (success) {
 return (
 <div className="flex flex-col items-center justify-center py-12 px-4">
 <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
 <CheckCircle className="w-8 h-8 text-green-600" />
 </div>
 <h2 className="text-xl font-semibold text-gray-900 mb-2">Party Added Successfully!</h2>
 {createdParty?.uniqueId && (
 <p className="text-sm text-gray-500 mb-6">ID: <span className="font-mono font-semibold text-[#af4408]">{createdParty.uniqueId}</span></p>
 )}

 {/* WhatsApp Copy Template */}
 <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-4 mb-6">
 <div className="flex items-center gap-2 mb-3">
 <Share2 className="w-4 h-4 text-green-600" />
 <h3 className="text-sm font-semibold text-gray-800">Share on WhatsApp</h3>
 </div>
 <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto mb-3">
 {createdParty ? generateWhatsAppMessage(createdParty, null, { isNew: true, greName: user?.role === 'GRE' ? (user?.name || user?.username) : '' }) : ''}
 </div>
 <button
 onClick={handleCopyWhatsApp}
 className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
 copied
 ? 'bg-green-100 text-green-700'
 : 'bg-green-600 text-white hover:bg-green-700'
 }`}
 >
 {copied ? (
 <><CheckCircle className="w-4 h-4" /> Copied!</>
 ) : (
 <><Copy className="w-4 h-4" /> Copy to Clipboard</>
 )}
 </button>
 </div>

 <button
 onClick={() => navigate('/')}
 className="px-6 py-2.5 rounded-xl text-sm font-medium text-[#af4408] bg-[#af4408]/10 hover:bg-[#af4408]/20 transition-colors"
 >
 Go to Dashboard
 </button>
 </div>
 );
 }

 // Date picker section (shared between GRE and full form) — called as function, not component
 const renderDateSection = () => (
 <div className="md:col-span-2">
 <div className="flex items-center gap-3 mb-2">
 <label className="block text-xs font-medium text-gray-600">
 Date {!form.dateNotConfirmed && <span className="text-red-500">*</span>}
 </label>
 <label className="flex items-center gap-1.5 cursor-pointer">
 <input
 type="checkbox"
 checked={form.dateNotConfirmed}
 onChange={(e) => handleChange('dateNotConfirmed', e.target.checked)}
 className="w-4 h-4 rounded border-gray-300 text-[#af4408] focus:ring-[#af4408]"
 />
 <span className="text-xs text-gray-500">Date Not Confirmed</span>
 </label>
 </div>
 {form.dateNotConfirmed ? (
 <div className="grid grid-cols-2 gap-3">
 <select
 value={form.tentativeMonth}
 onChange={(e) => handleChange('tentativeMonth', e.target.value)}
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 >
 <option value="">Select Month...</option>
 {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
 </select>
 <select
 value={form.tentativeYear}
 onChange={(e) => handleChange('tentativeYear', e.target.value)}
 className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 >
 {[new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
 <option key={y} value={y}>{y}</option>
 ))}
 </select>
 </div>
 ) : (
 <div className="flex items-center gap-3">
 <input
 type="date"
 value={form.date}
 min={new Date().toISOString().split('T')[0]}
 onChange={(e) => handleChange('date', e.target.value)}
 className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408]"
 />
 {form.date && (() => {
 const d = new Date(form.date);
 if (isNaN(d.getTime())) return null;
 const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
 return <span className="px-3 py-2.5 rounded-lg bg-[#af4408]/10 text-[#af4408] text-sm font-semibold whitespace-nowrap">{dayName}</span>;
 })()}
 </div>
 )}
 </div>
 );

 return (
 <div className="max-w-4xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-xl font-bold text-gray-900">Add New Party</h1>
 <p className="text-sm text-gray-500">Fill in party details below</p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={clearDraft}
 className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
 >
 Clear Draft
 </button>
 {!isGRE && (
 <button
 onClick={() => setQuickMode(!quickMode)}
 className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
 quickMode
 ? 'bg-[#af4408] text-white'
 : 'bg-[#af4408]/10 text-[#af4408] hover:bg-[#af4408]/20'
 }`}
 >
 <Zap className="w-3.5 h-3.5" />
 Quick Mode
 </button>
 )}
 </div>
 </div>

 {/* Warnings */}
 {duplicateWarning && (
 <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-700 flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 shrink-0" />
 {duplicateWarning}
 </div>
 )}
 {error && (
 <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
 {error}
 </div>
 )}

 {/* Form */}
 <form onSubmit={handleSubmit}>
 <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

 {/* ===== GRE SIMPLE FORM ===== */}
 {isGRE ? (
 <div className="p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">New Enquiry</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {renderDateSection()}
 {renderInput('Host Name', 'hostName', { required: true, placeholder: 'Enter host name' })}
 <div>
 {renderInput('Phone Number', 'phoneNumber', { required: true, placeholder: '+91 9876543210' })}
 {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
 </div>
 {renderInput('Company', 'company', { required: true, placeholder: 'Company name' })}
 {renderInput('Alt Contact', 'altContact', { placeholder: 'Alt person / phone (e.g. John - 9876543210)' })}
 {renderSelect('Handled By', 'handledBy', handlerUsers)}
 {renderSelect('Occasion Type', 'occasionType', ['Corporate', 'Family', 'Others'])}
 {renderSelect('Guest Visited', 'guestVisited', ['Yes', 'No'])}
 {renderSelect('Status', 'status', ['Enquiry'], { required: true })}
 {renderInput('Place', 'place', { placeholder: 'Venue / Hall' })}
 {renderInput('Meal Type', 'mealType', { placeholder: 'e.g. Lunch 12:30 PM, Breakfast + Dinner' })}
 {renderInput('Expected Pax', 'expectedPax', { required: isGRE, placeholder: 'e.g. 50 or 40-60' })}
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-gray-600 mb-1">Special Requirements</label>
 <textarea
 value={form.specialRequirements}
 onChange={(e) => handleChange('specialRequirements', e.target.value)}
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 placeholder="Any special requirements..."
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
 <textarea
 value={form.remarks}
 onChange={(e) => handleChange('remarks', e.target.value)}
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 placeholder="Any remarks..."
 />
 </div>
 </div>
 </div>
 ) : (
 <>
 {/* ===== FULL FORM (Sales / Manager / Admin) ===== */}
 {/* Section 1: Basic Details */}
 <div className="p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Basic Details</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {renderDateSection()}
 {renderInput('Host Name', 'hostName', { required: true, placeholder: 'Enter host name' })}
 <div>
 {renderInput('Phone Number', 'phoneNumber', { required: true, placeholder: '+91 9876543210' })}
 {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
 </div>
 {renderInput('Company', 'company', { required: true, placeholder: 'Company name' })}
 {renderInput('Alt Contact', 'altContact', { placeholder: 'Alt person / phone (e.g. John - 9876543210)' })}
 {renderSelect('Handled By', 'handledBy', handlerUsers)}
 {renderInput('Guest Email', 'guestEmail', { type: 'email', placeholder: 'guest@example.com' })}
 {renderInput('Place', 'place', { placeholder: 'Venue / Hall' })}
 {renderSelect('Status', 'status', ['Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'], { required: true })}
 </div>
 </div>

 {/* Section 2: Party Details */}
 {!quickMode && (
 <div className="p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Party Details</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {renderSelect('Occasion Type', 'occasionType', ['Corporate', 'Family', 'Others'])}
 {renderInput('Meal Type', 'mealType', { placeholder: 'e.g. Lunch 12:30 PM, Breakfast + Dinner' })}
 {renderInput('Expected Pax', 'expectedPax', { placeholder: 'e.g. 50 or 40-60' })}
 {renderInput('Package Selected', 'packageSelected', { placeholder: 'Package name' })}
 {renderSelect('Guest Visited', 'guestVisited', ['Yes', 'No'])}
 {renderSelect('FP Issued', 'fpIssued', ['Yes', 'No'])}
 </div>
 </div>
 )}

 {/* Section 4: Estimation */}
 <div className="p-5">
 {renderSectionHeader('Estimation & Billing', showBilling, () => setShowBilling(!showBilling))}
 {showBilling && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
 {renderInput('Approx Bill Amount', 'approxBillAmount', { type: 'number', placeholder: '0' })}
 {renderInput('Confirmed Pax', 'confirmedPax', { type: 'number' })}
 {renderInput('Final Rate (per pax)', 'finalRate', { type: 'number', placeholder: 'Rate per pax' })}
 {renderInput('Final Total Amount', 'finalTotalAmount', { type: 'number', readOnly: true })}
 </div>
 )}
 </div>

 {/* Additional Info */}
 {!quickMode && (
 <div className="p-5">
 {renderSectionHeader('Additional Information', showAdditional, () => setShowAdditional(!showAdditional))}
 {showAdditional && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-gray-600 mb-1">Special Requirements</label>
 <textarea
 value={form.specialRequirements}
 onChange={(e) => handleChange('specialRequirements', e.target.value)}
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 placeholder="Special requirements..."
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
 <textarea
 value={form.remarks}
 onChange={(e) => handleChange('remarks', e.target.value)}
 rows={2}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 placeholder="Any remarks..."
 />
 </div>
 {form.status === 'Cancelled' && (
 <>
 {renderInput('Lost Reason', 'lostReason', { placeholder: 'Reason for cancellation' })}
 </>
 )}
 </div>
 )}
 </div>
 )}
 </>
 )}
 </div>

 {/* Auto-calc preview */}
 {form.finalTotalAmount && (
 <div className="mt-4 bg-[#af4408]/5 rounded-xl border border-[#af4408]/20 p-4 flex flex-wrap gap-3 sm:gap-6">
 <div>
 <p className="text-xs text-gray-500">Final Total</p>
 <p className="text-lg font-bold text-[#af4408]">{formatCurrency(form.finalTotalAmount)}</p>
 </div>
 </div>
 )}

 {/* Submit */}
 <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
 <button
 type="button"
 onClick={() => navigate('/')}
 className="px-6 py-3 sm:py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={loading}
 className="flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl text-sm font-semibold text-white bg-[#af4408] hover:bg-[#963a07] shadow-lg shadow-[#af4408]/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {loading ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" /> Saving...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" /> Save Party
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 );
}
