import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 ArrowLeft,
 Save,
 Trash2,
 Loader2,
 Edit3,
 X,
 CheckCircle,
 XCircle,
 IndianRupee,
 MessageSquarePlus,
 Send,
 Plus,
 History,
 Copy,
 Clock,
 FileText,
} from 'lucide-react';
import StatusBadge from '../components/Party/StatusBadge';
import { partyAPI, fpAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
 formatCurrency,
 formatDate,
 getPaymentStatus,
 isTBCDate,
 generateWhatsAppMessage,
 copyToClipboard,
} from '../utils/helpers';

// Fields mapped to role permissions (must match backend ROLE_EDITABLE_FIELDS)
const ROLE_FIELDS = {
 GRE: [
  'date', 'hostName', 'phoneNumber', 'company', 'occasionType',
  'guestVisited', 'status', 'place', 'mealType', 'expectedPax',
  'specialRequirements', 'remarks', 'altContact', 'handledBy',
 ],
 CASHIER: [
  'approxBillAmount', 'paymentStatus',
  'billOrderId', 'balancePaymentDate',
 ],
 SALES: [
  'date', 'hostName', 'phoneNumber', 'company', 'occasionType',
  'guestVisited', 'status', 'place', 'mealType', 'expectedPax',
  'packageSelected', 'specialRequirements', 'remarks', 'handledBy',
  'lostReason', 'fpIssued', 'approxBillAmount',
  'confirmedPax', 'finalRate', 'paymentStatus',
  'altContact', 'guestEmail', 'balancePaymentDate', 'billOrderId',
 ],
 MANAGER: 'all',
 ADMIN: 'all',
};

const FIELD_LABELS = {
 uniqueId: 'Unique ID',
 date: 'Date',
 day: 'Day',
 hostName: 'Host Name',
 phoneNumber: 'Phone Number',
 company: 'Company',
 place: 'Place',
 handledBy: 'Handled By',
 occasionType: 'Occasion Type',
 mealType: 'Meal Type',
 expectedPax: 'Expected Pax',
 packageSelected: 'Package Selected',
 specialRequirements: 'Special Requirements',
 status: 'Status',
 guestVisited: 'Guest Visited',
 lostReason: 'Lost Reason',
 cancelledDate: 'Cancelled Date',
 approxBillAmount: 'Approx Bill Amount',
 confirmedPax: 'Confirmed Pax',
 finalRate: 'Final Rate',
 finalTotalAmount: 'Final Total Amount',
 totalAdvancePaid: 'Total Advance Paid',
 totalPaid: 'Total Paid',
 totalAmountPaid: 'Total Amount Paid',
 dueAmount: 'Due Amount',
 followUpNotes: 'Follow-Up Notes',
 lastFollowUpDate: 'Last Follow-Up',
 enquiredAt: 'Enquired At',
 paymentStatus: 'Payment Status',
 fpIssued: 'FP Issued',
 remarks: 'Remarks',
 altContact: 'Alt Contact',
 guestEmail: 'Guest Email',
 balancePaymentDate: 'Balance Payment Date',
 billOrderId: 'Bill Order ID',
};

const READ_ONLY_FIELDS = [
 'uniqueId', 'day', 'finalTotalAmount', 'totalAdvancePaid', 'totalPaid',
 'totalAmountPaid', 'dueAmount', 'enquiredAt',
];

const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Partial', 'Paid', 'Refunded'];

export default function PartyDetail() {
 const { id } = useParams();
 const navigate = useNavigate();
 const { user } = useAuth();
 const [party, setParty] = useState(null);
 const [editData, setEditData] = useState({});
 const [editing, setEditing] = useState(false);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [showDelete, setShowDelete] = useState(false);
 const [showCancelModal, setShowCancelModal] = useState(false);
 const [cancelReason, setCancelReason] = useState('');
 const [showFollowUpModal, setShowFollowUpModal] = useState(false);
 const [statusFollowUpNote, setStatusFollowUpNote] = useState('');
 const [pendingStatus, setPendingStatus] = useState('');
 const [followUpNote, setFollowUpNote] = useState('');
 const [sendingFollowUp, setSendingFollowUp] = useState(false);
 const [copied, setCopied] = useState(false);

 // Payment Log state
 const [showPaymentForm, setShowPaymentForm] = useState(false);
 const [paymentAmount, setPaymentAmount] = useState('');
 const [paymentType, setPaymentType] = useState('advance');
 const [paymentMethod, setPaymentMethod] = useState('');
 const [paymentNote, setPaymentNote] = useState('');
 const [addingPayment, setAddingPayment] = useState(false);
 const [paymentHistory, setPaymentHistory] = useState([]);
 const [showPaymentHistory, setShowPaymentHistory] = useState(false);
 const [sendingReminder, setSendingReminder] = useState(false);
 const [reminderLog, setReminderLog] = useState([]);
 const [showReminderLog, setShowReminderLog] = useState(false);
 const [fpRecords, setFpRecords] = useState([]);

 const isCashier = user?.role === 'CASHIER';
 const canFollowUp = ['SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
 const canAddPayment = ['CASHIER', 'SALES', 'MANAGER', 'ADMIN'].includes(user?.role);

 useEffect(() => {
  fetchParty();
 }, [id]);

 const fetchParty = async () => {
  setLoading(true);
  try {
   const res = await partyAPI.getById(id);
   const data = res.data;
   setParty(data);
   setEditData(data);
   fetchFpRecords(data.uniqueId);
  } catch (err) {
   setError('Failed to load party details.');
  } finally {
   setLoading(false);
  }
 };

 const fetchFpRecords = async (uniqueId) => {
  if (!uniqueId) return;
  try {
   const res = await fpAPI.getByParty(uniqueId);
   setFpRecords(res.data.data || []);
  } catch {
   setFpRecords([]);
  }
 };

 const fetchPaymentHistory = async () => {
  try {
   const res = await partyAPI.getPayments(id);
   setPaymentHistory(res.data.payments || []);
   setShowPaymentHistory(true);
  } catch (err) {
   setError('Failed to load payment history.');
  }
 };

 const fetchReminderLog = async () => {
  try {
   const res = await partyAPI.getReminderLog();
   // Filter logs for this party
   const partyLogs = (res.data.data || []).filter((l) => l.uniqueId === party?.uniqueId);
   setReminderLog(partyLogs);
   setShowReminderLog(true);
  } catch {
   setReminderLog([]);
   setShowReminderLog(true);
  }
 };

 const canEdit = (field) => {
  if (READ_ONLY_FIELDS.includes(field)) return false;
  const allowed = ROLE_FIELDS[user?.role];
  if (allowed === 'all') return true;
  return Array.isArray(allowed) && allowed.includes(field);
 };

 const handleSave = async () => {
  setSaving(true);
  setError('');
  try {
   await partyAPI.update(id, editData);
   await fetchParty();
   setEditing(false);
  } catch (err) {
   setError(err.response?.data?.message || 'Failed to save changes.');
  } finally {
   setSaving(false);
  }
 };

 const handleStatusChange = async (newStatus) => {
  if (newStatus === 'Cancelled') {
   setShowCancelModal(true);
   return;
  }
  // Mandatory follow-up note for ALL status changes (what was discussed with guest)
  const currentStatus = (party.status || '').trim();
  if (currentStatus !== newStatus) {
   // Warn if confirming without Confirmed Pax & Final Rate
   if (newStatus === 'Confirmed') {
    const pax = party.confirmedPax || editData.confirmedPax;
    const rate = party.finalRate || editData.finalRate;
    if (!pax || !rate) {
     const proceed = window.confirm(
      'Confirmed Pax and Final Rate are not set yet. You can fill them later.\n\nProceed with confirmation?'
    );
    if (!proceed) return;
   }
  }
  // Always ask for follow-up note on status change
  setPendingStatus(newStatus);
  setStatusFollowUpNote('');
  setShowFollowUpModal(true);
  return;
  }
 };

 const handleStatusWithFollowUp = async () => {
  if (!statusFollowUpNote.trim()) return;
  try {
   // First update status (backend auto-adds follow-up note)
   await partyAPI.updateStatus(id, { status: pendingStatus, followUpNote: statusFollowUpNote.trim() });
   setShowFollowUpModal(false);
   setStatusFollowUpNote('');
   setPendingStatus('');
   await fetchParty();
  } catch (err) {
   setError(err.response?.data?.message || 'Failed to update status.');
  }
 };

 const handleCancel = async () => {
  if (!cancelReason.trim()) return;
  try {
   await partyAPI.updateStatus(id, { status: 'Cancelled', lostReason: cancelReason });
   setShowCancelModal(false);
   setCancelReason('');
   await fetchParty();
  } catch (err) {
   setError('Failed to cancel party.');
  }
 };

 const handleDelete = async () => {
  try {
   await partyAPI.delete(id);
   navigate('/');
  } catch (err) {
   setError('Failed to delete party.');
  }
 };

 const handleFollowUp = async () => {
  if (!followUpNote.trim()) return;
  setSendingFollowUp(true);
  try {
   await partyAPI.addFollowUp(id, { note: followUpNote });
   setFollowUpNote('');
   await fetchParty();
  } catch (err) {
   setError('Failed to add follow-up note.');
  } finally {
   setSendingFollowUp(false);
  }
 };

 const handleAddPayment = async () => {
  if (!paymentAmount || isNaN(paymentAmount)) return;
  setAddingPayment(true);
  setError('');
  try {
   await partyAPI.addPayment(id, {
    amount: parseFloat(paymentAmount),
    type: paymentType,
    method: paymentMethod,
    note: paymentNote,
   });
   setPaymentAmount('');
   setPaymentType('advance');
   setPaymentMethod('');
   setPaymentNote('');
   setShowPaymentForm(false);
   await fetchParty();
  } catch (err) {
   setError(err.response?.data?.message || 'Failed to add payment.');
  } finally {
   setAddingPayment(false);
  }
 };

 const handleCopyWhatsApp = async () => {
  if (!party) return;
  const msg = generateWhatsAppMessage(party, user?.name || user?.username);
  const ok = await copyToClipboard(msg);
  if (ok) {
   setCopied(true);
   setTimeout(() => setCopied(false), 2000);
  }
 };

 const handleSendPaymentReminder = async () => {
  if (!party) return;
  if (!party.guestEmail) {
   alert('No Guest Email set. Please add a Guest Email first.');
   return;
  }
  const due = parseFloat(party.dueAmount) || 0;
  if (due <= 0) {
   alert('No pending dues for this party.');
   return;
  }
  if (!confirm(`Send payment reminder email to ${party.guestEmail}?\n\nDue Amount: ₹${due.toLocaleString('en-IN')}`)) return;
  setSendingReminder(true);
  try {
   const res = await partyAPI.sendPaymentReminder(id);
   alert(res.data.message || 'Payment reminder sent successfully!');
  } catch (err) {
   alert(err.response?.data?.message || 'Failed to send payment reminder.');
  } finally {
   setSendingReminder(false);
  }
 };

 if (loading) {
  return (
   <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
   </div>
  );
 }

 if (!party) {
  return (
   <div className="text-center py-20">
    <p className="text-gray-500">{error || 'Party not found.'}</p>
    <button onClick={() => navigate('/')} className="mt-4 text-[#af4408] hover:underline text-sm">Back to Dashboard</button>
   </div>
  );
 }

 const payment = getPaymentStatus(
  parseFloat(party.approxBillAmount) || parseFloat(party.finalTotalAmount) || 0,
  parseFloat(party.totalAmountPaid) || 0
 );

 const sections = [
  {
   title: 'Basic Details',
   fields: ['uniqueId', 'date', 'day', 'hostName', 'phoneNumber', 'altContact', 'company', 'place', 'handledBy', 'guestEmail'],
  },
  {
   title: 'Party Details',
   fields: ['occasionType', 'mealType', 'expectedPax', 'packageSelected', 'specialRequirements', 'guestVisited'],
  },
  {
   title: 'Status Tracking',
   fields: ['status', 'lostReason', 'cancelledDate', 'fpIssued', 'enquiredAt'],
  },
  {
   title: 'Estimation',
   fields: ['approxBillAmount'],
  },
  {
   title: 'Final Confirmation',
   fields: ['confirmedPax', 'finalRate', 'finalTotalAmount'],
  },
  {
   title: 'Payment Tracking',
   fields: ['totalAdvancePaid', 'totalPaid', 'totalAmountPaid', 'dueAmount', 'paymentStatus', 'balancePaymentDate', 'billOrderId'],
  },
  {
   title: 'Additional Information',
   fields: ['remarks'],
  },
 ];

 const isCurrencyField = (f) => [
  'approxBillAmount', 'finalTotalAmount',
  'totalAdvancePaid', 'totalPaid', 'totalAmountPaid', 'dueAmount',
 ].includes(f);

 const renderFieldInput = (field) => {
  if (field === 'status') {
   return (
    <select
     value={editData[field] || ''}
     onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
     className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
    >
     {['Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'].map((s) => (
      <option key={s} value={s}>{s}</option>
     ))}
    </select>
   );
  }
  if (field === 'occasionType') {
   return (
    <select
     value={editData[field] || ''}
     onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
     className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
    >
     <option value="">Select...</option>
     <option value="Corporate">Corporate</option>
     <option value="Family">Family</option>
     <option value="Others">Others</option>
    </select>
   );
  }
  if (field === 'mealType') {
   return (
    <input
     type="text"
     value={editData[field] || ''}
     onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
     placeholder="e.g. Lunch 12:30 PM, Breakfast + Dinner"
     className="w-full px-3 py-2 rounded-lg border border-[#af4408]/30 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
    />
   );
  }
  if (field === 'paymentStatus') {
   return (
    <select
     value={editData[field] || ''}
     onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
     className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
    >
     <option value="">Select...</option>
     {PAYMENT_STATUS_OPTIONS.map((s) => (
      <option key={s} value={s}>{s}</option>
     ))}
    </select>
   );
  }
  if (field === 'guestVisited' || field === 'fpIssued') {
   return (
    <select
     value={editData[field] || ''}
     onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
     className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
    >
     <option value="">Select...</option>
     <option value="Yes">Yes</option>
     <option value="No">No</option>
    </select>
   );
  }
  const isDateField = field.toLowerCase().includes('date') || field === 'date';
  return (
   <input
    type={isDateField ? 'date' : 'text'}
    value={editData[field] || ''}
    min={field === 'date' ? new Date().toISOString().split('T')[0] : undefined}
    onChange={(e) => setEditData((prev) => ({ ...prev, [field]: e.target.value }))}
    className="w-full px-3 py-2 rounded-lg border border-[#af4408]/30 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
   />
  );
 };

 const renderFieldDisplay = (field, value) => {
  if (field === 'status') {
   return <StatusBadge status={value || 'Enquiry'} size="xs" />;
  }
  if (field === 'paymentStatus' && value) {
   return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
     value === 'Paid' ? 'bg-green-100 text-green-700' :
     value === 'Partial' ? 'bg-amber-100 text-amber-700' :
     value === 'Refunded' ? 'bg-blue-100 text-blue-700' :
     'bg-red-100 text-red-700'
    }`}>{value}</span>
   );
  }
  if (field === 'fpIssued') {
   if (fpRecords.length > 0) {
    const fpStatus = fpRecords[0].status || 'Draft';
    return (
     <span className="inline-flex items-center gap-1.5">
      <span className="text-xs font-semibold text-green-700">Yes</span>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
       fpStatus === 'Approved' ? 'bg-green-100 text-green-700' :
       fpStatus === 'Issued' ? 'bg-blue-100 text-blue-700' :
       fpStatus === 'Revised' ? 'bg-amber-100 text-amber-700' :
       'bg-gray-100 text-gray-600'
      }`}>{fpStatus}</span>
     </span>
    );
   }
   return <span className="text-xs text-gray-400">{value || 'No'}</span>;
  }
  if (isCurrencyField(field) && value) {
   return formatCurrency(value);
  }
  if (field === 'day' && value) {
   return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-[#af4408]/10 text-[#af4408]">{value}</span>;
  }
  if ((field === 'date' || field === 'cancelledDate' || field === 'enquiredAt' || field === 'lastFollowUpDate') && value) {
   if (isTBCDate(value)) {
    return (
     <span className="inline-flex items-center gap-1">
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">TBC</span>
      <span>{value.replace('TBC: ', '')}</span>
     </span>
    );
   }
   return formatDate(value);
  }
  return value || <span className="text-gray-300">-</span>;
 };

 return (
  <div className="max-w-4xl mx-auto">
   {/* Header */}
   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-3">
     <button
      onClick={() => navigate('/')}
      className="p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
     >
      <ArrowLeft className="w-5 h-5 text-gray-600" />
     </button>
     <div className="min-w-0">
      <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
       {party.hostName || 'Party Details'}
      </h1>
      <div className="flex items-center gap-2 mt-1">
       <StatusBadge status={party.status} size="sm" />
       <span className={`text-xs font-semibold ${payment.color}`}>{payment.label}</span>
       {party.uniqueId && (
        <span className="text-[10px] text-gray-400 font-mono">{party.uniqueId}</span>
       )}
      </div>
     </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
     {/* WhatsApp copy */}
     <button
      onClick={handleCopyWhatsApp}
      className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors min-h-[44px]"
     >
      <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'WhatsApp'}
     </button>

     {/* F&P - SALES/MANAGER/ADMIN - only for Confirmed or Tentative */}
     {['SALES', 'MANAGER', 'ADMIN'].includes(user?.role) && ['Confirmed', 'Tentative'].includes((party.status || '').trim()) && (
      fpRecords.length > 0 ? (
       <button
        onClick={() => navigate(`/fp/${fpRecords[0].rowIndex}`)}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors min-h-[44px]"
       >
        <FileText className="w-4 h-4" /> View F&P
        <span className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
         fpRecords[0].status === 'Approved' ? 'bg-green-100 text-green-700' :
         fpRecords[0].status === 'Issued' ? 'bg-blue-100 text-blue-700' :
         fpRecords[0].status === 'Revised' ? 'bg-amber-100 text-amber-700' :
         'bg-gray-100 text-gray-600'
        }`}>{fpRecords[0].status || 'Draft'}</span>
       </button>
      ) : (
       <button
        onClick={() => navigate(`/fp/new?partyId=${encodeURIComponent(party.uniqueId)}`)}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors min-h-[44px]"
       >
        <FileText className="w-4 h-4" /> Create F&P
       </button>
      )
     )}

     {/* Send Payment Reminder - SALES/MANAGER/ADMIN only, when dues exist */}
     {['SALES', 'MANAGER', 'ADMIN'].includes(user?.role) && parseFloat(party.dueAmount) > 0 && (
      <button
       onClick={handleSendPaymentReminder}
       disabled={sendingReminder}
       className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors min-h-[44px] disabled:opacity-50"
      >
       {sendingReminder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
       {sendingReminder ? 'Sending...' : 'Payment Reminder'}
      </button>
     )}

     {/* Quick status actions - hidden for CASHIER */}
     {!isCashier && party.status === 'Enquiry' && (
      <button
       onClick={() => handleStatusChange('Contacted')}
       className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors min-h-[44px]"
      >
       Contacted
      </button>
     )}
     {!isCashier && party.status !== 'Tentative' && party.status !== 'Confirmed' && party.status !== 'Cancelled' && (
      <button
       onClick={() => handleStatusChange('Tentative')}
       className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors min-h-[44px]"
      >
       <Clock className="w-4 h-4" /> Tentative
      </button>
     )}
     {!isCashier && party.status !== 'Confirmed' && party.status !== 'Cancelled' && (
      <button
       onClick={() => handleStatusChange('Confirmed')}
       className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors min-h-[44px]"
      >
       <CheckCircle className="w-4 h-4" /> Confirm
      </button>
     )}
     {!isCashier && party.status !== 'Cancelled' && (
      <button
       onClick={() => handleStatusChange('Cancelled')}
       className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors min-h-[44px]"
      >
       <XCircle className="w-4 h-4" /> Cancel
      </button>
     )}

     {editing ? (
      <>
       <button onClick={() => { setEditing(false); setEditData(party); }} className="px-3 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
        <X className="w-3.5 h-3.5" />
       </button>
       <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
       >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save
       </button>
      </>
     ) : (
      user?.role !== 'GRE' && (
      <button
       onClick={() => setEditing(true)}
       className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408]/10 text-[#af4408] hover:bg-[#af4408]/20 transition-colors"
      >
       <Edit3 className="w-3.5 h-3.5" /> Edit
      </button>
      )
     )}

     {user?.role === 'ADMIN' && (
      <button
       onClick={() => setShowDelete(true)}
       className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
      >
       <Trash2 className="w-4 h-4" />
      </button>
     )}
    </div>
   </div>

   {error && (
    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
     {error}
    </div>
   )}

   {/* Detail sections */}
   <div className="space-y-4">
    {sections.map((section) => (
     <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{section.title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       {section.fields.map((field) => {
        const value = editing ? (editData[field] || '') : (party[field] || '');
        const editable = editing && canEdit(field);
        const label = FIELD_LABELS[field] || field;

        return (
         <div key={field}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          {editable ? renderFieldInput(field) : (
           <p className="text-sm font-medium text-gray-900">
            {renderFieldDisplay(field, value)}
           </p>
          )}
         </div>
        );
       })}
      </div>

      {/* Add Payment button inside Payment Tracking section */}
      {section.title === 'Payment Tracking' && canAddPayment && (
       <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
         <button
          onClick={() => setShowPaymentForm(!showPaymentForm)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors min-h-[44px]"
         >
          <Plus className="w-3.5 h-3.5" /> Add Payment
         </button>
         <button
          onClick={fetchPaymentHistory}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors min-h-[44px]"
         >
          <History className="w-3.5 h-3.5" /> Payment History
         </button>
         {['SALES', 'MANAGER', 'ADMIN'].includes(user?.role) && (
          <button
           onClick={fetchReminderLog}
           className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors min-h-[44px]"
          >
           <Send className="w-3.5 h-3.5" /> Reminder Log
          </button>
         )}
        </div>

        {/* Add payment form */}
        {showPaymentForm && (
         <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
           <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (INR) *</label>
            <input
             type="number"
             value={paymentAmount}
             onChange={(e) => setPaymentAmount(e.target.value)}
             placeholder="Enter amount"
             className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
            />
           </div>
           <div>
            <label className="block text-xs text-gray-500 mb-1">Type *</label>
            <select
             value={paymentType}
             onChange={(e) => setPaymentType(e.target.value)}
             className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
            >
             <option value="advance">Advance</option>
             <option value="payment">Payment</option>
            </select>
           </div>
           <div>
            <label className="block text-xs text-gray-500 mb-1">Method</label>
            <select
             value={paymentMethod}
             onChange={(e) => setPaymentMethod(e.target.value)}
             className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
            >
             <option value="">Select...</option>
             <option value="Cash">Cash</option>
             <option value="UPI">UPI</option>
             <option value="Card">Card</option>
             <option value="Bank Transfer">Bank Transfer</option>
             <option value="Cheque">Cheque</option>
            </select>
           </div>
           <div>
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input
             type="text"
             value={paymentNote}
             onChange={(e) => setPaymentNote(e.target.value)}
             placeholder="Optional note"
             className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
            />
           </div>
          </div>
          <div className="flex items-center gap-2">
           <button
            onClick={handleAddPayment}
            disabled={addingPayment || !paymentAmount || isNaN(paymentAmount)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50 min-h-[44px]"
           >
            {addingPayment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5" />}
            Save Payment
           </button>
           <button
            onClick={() => setShowPaymentForm(false)}
            className="px-3 py-2.5 rounded-lg text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
           >
            Cancel
           </button>
          </div>
         </div>
        )}

        {/* Payment history */}
        {showPaymentHistory && (
         <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
          {paymentHistory.length > 0 ? paymentHistory.map((entry, i) => (
           <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div>
             <p className="text-sm font-medium text-gray-900">
              {formatCurrency(entry.amount)}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
               entry.type === 'advance' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
               {entry.type === 'advance' ? 'Advance' : 'Payment'}
              </span>
             </p>
             <p className="text-xs text-gray-500 mt-0.5">
              {entry.method && <span className="mr-2">{entry.method}</span>}
              {entry.note && <span className="mr-2">{entry.note}</span>}
              {entry.date && <span>{formatDate(entry.date)}</span>}
             </p>
            </div>
           </div>
          )) : (
           <p className="text-xs text-gray-400 text-center py-4">No payments recorded yet.</p>
          )}
         </div>
        )}

        {/* Reminder Log */}
        {showReminderLog && (
         <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
          <h4 className="text-xs font-semibold text-amber-700 mb-2">Payment Reminder Log</h4>
          {reminderLog.length > 0 ? reminderLog.map((entry, i) => (
           <div key={i} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
            <div>
             <p className="text-sm font-medium text-gray-900">
              {entry.guestEmail}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
               entry.reminderType === 'manual' ? 'bg-blue-100 text-blue-700'
               : entry.reminderType === 'due_today' ? 'bg-red-100 text-red-700'
               : entry.reminderType === '1_day_before' ? 'bg-orange-100 text-orange-700'
               : 'bg-yellow-100 text-yellow-700'
              }`}>
               {entry.reminderType === 'manual' ? 'Manual' : entry.reminderType === 'due_today' ? 'Due Today' : entry.reminderType === '1_day_before' ? '1 Day Before' : '2 Days Before'}
              </span>
             </p>
             <p className="text-xs text-gray-500 mt-0.5">
              Due: {formatCurrency(parseFloat(entry.dueAmount) || 0)} | Sent: {entry.sentAt} | By: {entry.sentBy}
             </p>
            </div>
           </div>
          )) : (
           <p className="text-xs text-gray-400 text-center py-4">No payment reminders sent yet.</p>
          )}
         </div>
        )}
       </div>
      )}
     </div>
    ))}
   </div>

   {/* Follow-up Notes Section */}
   {canFollowUp && party.status !== 'Cancelled' && (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
     <div className="flex items-center gap-2 mb-4">
      <MessageSquarePlus className="w-4 h-4 text-[#af4408]" />
      <h3 className="text-sm font-semibold text-gray-800">Follow-Up Tracking</h3>
      <div className="flex items-center gap-2 ml-auto">
       {party.phoneNumber && (
        <a
         href={`tel:${party.phoneNumber}`}
         className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
         title="Call Guest"
        >
         📞 Call
        </a>
       )}
       {party.lastFollowUpDate && (
        <span className="text-[10px] text-gray-400">Last: {formatDate(party.lastFollowUpDate)}</span>
       )}
      </div>
     </div>

     {/* Add follow-up note */}
     <div className="flex gap-2 mb-4">
      <input
       type="text"
       value={followUpNote}
       onChange={(e) => setFollowUpNote(e.target.value)}
       placeholder="Add a follow-up note (e.g., Called client, waiting for confirmation...)"
       className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
       onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
      />
      <button
       onClick={handleFollowUp}
       disabled={sendingFollowUp || !followUpNote.trim()}
       className="px-4 py-2.5 rounded-lg bg-[#af4408] text-white text-xs font-semibold hover:bg-[#963a07] disabled:opacity-50 min-h-[44px] flex items-center gap-1.5 shrink-0"
      >
       {sendingFollowUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
       Add
      </button>
     </div>

     {/* Existing notes */}
     {party.followUpNotes ? (
      <div className="space-y-2 max-h-60 overflow-y-auto">
       {party.followUpNotes.split('\n').filter(Boolean).map((note, i) => (
        <div key={i} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700">
         {note}
        </div>
       ))}
      </div>
     ) : (
      <p className="text-xs text-gray-400 text-center py-4">No follow-up notes yet. Add one above to start tracking.</p>
     )}
    </div>
   )}

   {/* Delete confirmation modal */}
   {showDelete && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDelete(false)}>
     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-sm p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Party?</h3>
      <p className="text-sm text-gray-500 mb-4">
       This action cannot be undone. The party record will be permanently removed.
      </p>
      <div className="flex justify-end gap-3">
       <button onClick={() => setShowDelete(false)} className="px-4 py-2.5 rounded-lg text-sm bg-gray-100 text-gray-700">Cancel</button>
       <button onClick={handleDelete} className="px-4 py-2.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700">Delete</button>
      </div>
     </div>
    </div>
   )}

   {/* Cancel with reason modal */}
   {showCancelModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCancelModal(false)}>
     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Party</h3>
      <p className="text-sm text-gray-500 mb-4">Please provide a reason for cancellation.</p>
      <textarea
       value={cancelReason}
       onChange={(e) => setCancelReason(e.target.value)}
       placeholder="Lost reason (required)"
       rows={3}
       className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none mb-4"
      />
      <div className="flex justify-end gap-3">
       <button onClick={() => setShowCancelModal(false)} className="px-4 py-2.5 rounded-lg text-sm bg-gray-100 text-gray-700">Back</button>
       <button
        onClick={handleCancel}
        disabled={!cancelReason.trim()}
        className="px-4 py-2.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
       >
        Cancel Party
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Follow-up note modal for status change (Enquiry → Contacted/Tentative) */}
   {showFollowUpModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowFollowUpModal(false); setPendingStatus(''); }}>
     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Follow-Up Note Required</h3>
      <p className="text-sm text-gray-500 mb-4">
       Changing status to <span className="font-semibold text-[#af4408]">{pendingStatus}</span>. Please describe what was discussed with the guest.
      </p>
      <textarea
       value={statusFollowUpNote}
       onChange={(e) => setStatusFollowUpNote(e.target.value)}
       placeholder="What was spoken to the guest? (required)"
       rows={3}
       autoFocus
       className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none mb-4"
      />
      <div className="flex justify-end gap-3">
       <button onClick={() => { setShowFollowUpModal(false); setPendingStatus(''); }} className="px-4 py-2.5 rounded-lg text-sm bg-gray-100 text-gray-700">Cancel</button>
       <button
        onClick={handleStatusWithFollowUp}
        disabled={!statusFollowUpNote.trim()}
        className="px-4 py-2.5 rounded-lg text-sm bg-[#af4408] text-white hover:bg-[#963a07] disabled:opacity-50"
       >
        Update Status
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
