import { useState } from 'react';
import {
  Search,
  Loader2,
  User,
  Phone,
  Building2,
  Calendar,
  Users,
  IndianRupee,
  AlertTriangle,
  CheckCircle,
  Save,
  RotateCcw,
  Plus,
  History,
  Pencil,
  Check,
} from 'lucide-react';
import { partyAPI, fpAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

export default function CashierBilling() {
  const { user } = useAuth();
  const [uniqueId, setUniqueId] = useState('');
  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [activitiesData, setActivitiesData] = useState({ total: 0, items: [] });
  const [activitiesAdded, setActivitiesAdded] = useState(false);
  const [editableActivitiesTotal, setEditableActivitiesTotal] = useState('');
  const [editingActivities, setEditingActivities] = useState(false);

  // Payment system states
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('advance');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  // Billing form
  const [form, setForm] = useState({
    confirmedPax: '',
    finalRate: '',
    finalTotalAmount: '',
    totalAdvancePaid: '',
    totalPaid: '',
    totalAmountPaid: '',
    dueAmount: '',
    billOrderId: '',
    balancePaymentDate: '',
    guestEmail: '',
  });

  const handleLookup = async () => {
    const id = uniqueId.trim();
    if (!id) {
      setError('Please enter a Party Unique ID.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    setParty(null);
    setDuplicateWarning('');
    try {
      const res = await partyAPI.lookup(id);
      const p = res.data.data;
      setParty(p);
      if (res.data.duplicateWarning) {
        setDuplicateWarning(res.data.duplicateWarning);
      }
      // Fetch F&P records for activities
      try {
        const fpRes = await fpAPI.getByParty(id);
        const fpRecords = fpRes.data.data || [];
        if (fpRecords.length > 0) {
          let acts = fpRecords[0].activities || [];
          if (typeof acts === 'string') { try { acts = JSON.parse(acts); } catch { acts = []; } }
          const validActs = acts.filter((a) => a.name);
          const actTotal = validActs.reduce((s, a) => s + ((parseFloat(a.pax) || 0) * (parseFloat(a.amount) || 0)), 0);
          setActivitiesData({ total: actTotal, items: validActs });
        } else {
          setActivitiesData({ total: 0, items: [] });
        }
      } catch {
        setActivitiesData({ total: 0, items: [] });
      }

      // Pre-fill form with existing values
      setForm({
        confirmedPax: p.confirmedPax || '',
        finalRate: p.finalRate || '',
        finalTotalAmount: p.finalTotalAmount || '',
        totalAdvancePaid: p.totalAdvancePaid || '',
        totalPaid: p.totalPaid || '',
        totalAmountPaid: p.totalAmountPaid || '',
        dueAmount: p.dueAmount || '',
        billOrderId: p.billOrderId || '',
        balancePaymentDate: p.balancePaymentDate || '',
        guestEmail: p.guestEmail || '',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Party not found. Check the Unique ID.');
    } finally {
      setLoading(false);
    }
  };

  const refetchParty = async () => {
    try {
      const res = await partyAPI.lookup(uniqueId.trim());
      const p = res.data.data;
      setParty(p);
      setForm((prev) => ({
        ...prev,
        totalAdvancePaid: p.totalAdvancePaid || '',
        totalPaid: p.totalPaid || '',
        totalAmountPaid: p.totalAmountPaid || '',
        dueAmount: p.dueAmount || '',
      }));
    } catch { /* ignore */ }
  };

  const fetchPaymentHistory = async () => {
    if (!party) return;
    try {
      const res = await partyAPI.getPayments(party.rowIndex);
      setPaymentHistory(res.data.payments || []);
      setShowPaymentHistory(true);
    } catch {
      setError('Failed to load payment history.');
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || isNaN(paymentAmount)) return;
    const isCashierRole = user?.role === 'CASHIER';
    const currentBillOrderId = (form.billOrderId || '').trim();
    if (isCashierRole && !currentBillOrderId) {
      setError('Bill Order ID (POS Ref) is mandatory. Please enter the POS Bill Order ID first.');
      return;
    }
    setAddingPayment(true);
    setError('');
    try {
      await partyAPI.addPayment(party.rowIndex, {
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
      setSuccess('Payment added successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await refetchParty();
      if (showPaymentHistory) fetchPaymentHistory();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add payment.');
    } finally {
      setAddingPayment(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      // AUTO CALCULATIONS
      const confirmedPax = parseFloat(field === 'confirmedPax' ? value : updated.confirmedPax) || 0;
      const finalRate = parseFloat(field === 'finalRate' ? value : updated.finalRate) || 0;
      const totalAdvancePaid = parseFloat(field === 'totalAdvancePaid' ? value : updated.totalAdvancePaid) || 0;
      const totalPaid = parseFloat(field === 'totalPaid' ? value : updated.totalPaid) || 0;

      // Final Total = Final Rate × Confirmed Pax + Activities (if added)
      if (field === 'confirmedPax' || field === 'finalRate') {
        const base = confirmedPax && finalRate ? (confirmedPax * finalRate) : parseFloat(updated.finalTotalAmount) || 0;
        const actAmount = activitiesAdded ? (parseFloat(editableActivitiesTotal) || 0) : 0;
        updated.finalTotalAmount = confirmedPax && finalRate ? (base + actAmount).toString() : updated.finalTotalAmount;
      }

      // Total Amount Paid = Advance + Payments
      if (field === 'totalAdvancePaid' || field === 'totalPaid') {
        updated.totalAmountPaid = (totalAdvancePaid + totalPaid).toString();
      }

      // Due Amount = Final Total - Total Amount Paid
      const finalTotal = parseFloat(updated.finalTotalAmount) || 0;
      const totalAmountPaid = parseFloat(updated.totalAmountPaid) || 0;
      if (field === 'confirmedPax' || field === 'finalRate' || field === 'totalAdvancePaid' || field === 'totalPaid') {
        updated.dueAmount = (finalTotal - totalAmountPaid).toString();
      }

      return updated;
    });
  };

  const handleSave = async () => {
    if (!party) return;

    // Validation: If confirmed, final rate is required
    if (party.status === 'Confirmed' && !form.finalRate) {
      setError('Final Rate is required for Confirmed parties.');
      return;
    }

    // Validation: If due amount > 0, balance payment date and guest email are required
    if (parseFloat(form.dueAmount) > 0) {
      if (!form.balancePaymentDate) {
        setError('Balance Payment Date is required when there is a due amount.');
        return;
      }
      if (!form.guestEmail) {
        setError('Guest Email is required when there is a due amount (for payment reminder).');
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        confirmedPax: form.confirmedPax,
        finalRate: form.finalRate,
        finalTotalAmount: form.finalTotalAmount,
        totalAdvancePaid: form.totalAdvancePaid,
        totalPaid: form.totalPaid,
        totalAmountPaid: form.totalAmountPaid,
        dueAmount: form.dueAmount,
        billOrderId: form.billOrderId,
        balancePaymentDate: form.balancePaymentDate,
        guestEmail: form.guestEmail,
      };
      // Remove fields that are empty strings to avoid overwriting with blank
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k];
      });
      await partyAPI.update(party.rowIndex, payload);
      setSuccess('Billing details saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setParty(null);
    setUniqueId('');
    setForm({
      confirmedPax: '',
      finalRate: '',
      finalTotalAmount: '',
      totalAdvancePaid: '',
      totalPaid: '',
      totalAmountPaid: '',
      dueAmount: '',
      billOrderId: '',
      balancePaymentDate: '',
      guestEmail: '',
    });
    setError('');
    setSuccess('');
    setDuplicateWarning('');
    setActivitiesData({ total: 0, items: [] });
    setActivitiesAdded(false);
    setEditableActivitiesTotal('');
    setEditingActivities(false);
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentType('advance');
    setPaymentMethod('');
    setPaymentNote('');
    setPaymentHistory([]);
    setShowPaymentHistory(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Cashier Billing</h1>
        <p className="text-sm text-gray-500">Look up a party by Unique ID and enter billing details</p>
      </div>

      {/* Messages */}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {duplicateWarning && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {duplicateWarning}
        </div>
      )}

      {/* Lookup Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Party Lookup</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="Enter Party Unique ID (e.g., AKN-20260325-AB12)"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-colors"
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={loading}
            className="px-5 py-3 rounded-lg text-sm font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
          {party && (
            <button
              onClick={handleReset}
              className="px-3 py-3 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Party Info Card */}
      {party && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Party Details</h3>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              party.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
              party.status === 'Tentative' ? 'bg-blue-100 text-blue-700' :
              party.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
              party.status === 'Contacted' ? 'bg-purple-100 text-purple-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {party.status || 'Unknown'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">Host Name</p>
                <p className="text-sm font-medium text-gray-900">{party.hostName || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">Phone Number</p>
                <p className="text-sm font-medium text-gray-900">{party.phoneNumber || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">Company</p>
                <p className="text-sm font-medium text-gray-900">{party.company || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">Date</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(party.date) || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">Expected Pax</p>
                <p className="text-sm font-medium text-gray-900">{party.expectedPax || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400">Approx Bill</p>
                <p className="text-sm font-medium text-gray-900">{party.approxBillAmount ? formatCurrency(party.approxBillAmount) : '-'}</p>
              </div>
            </div>
          </div>

          {/* Cancelled warning */}
          {party.status === 'Cancelled' && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-xs font-semibold text-red-700">This party is Cancelled</p>
              {party.lostReason && <p className="text-xs text-red-600 mt-1">Reason: {party.lostReason}</p>}
            </div>
          )}
        </div>
      )}

      {/* Activities Total Banner */}
      {party && activitiesData.total > 0 && (
        <div className={`border-2 rounded-xl p-4 ${activitiesAdded ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activitiesAdded ? '✅' : '⭐'}</span>
            <div className="flex-1">
              <p className={`text-xs font-bold uppercase tracking-wide ${activitiesAdded ? 'text-green-800' : 'text-amber-800'}`}>
                Activities Total (from F&P) {activitiesAdded && '— Added to Bill'}
              </p>
              {/* Editable amount when added to bill */}
              {activitiesAdded && editingActivities ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-lg font-bold ${activitiesAdded ? 'text-green-900' : 'text-amber-900'}`}>₹</span>
                  <input
                    type="number"
                    value={editableActivitiesTotal}
                    onChange={(e) => setEditableActivitiesTotal(e.target.value)}
                    className="w-32 px-2 py-1 text-lg font-bold rounded-lg border-2 border-green-400 bg-white text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500/30"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const newActAmount = parseFloat(editableActivitiesTotal) || 0;
                      const oldActAmount = parseFloat(editableActivitiesTotal) || 0;
                      setEditingActivities(false);
                      // Recalculate final total with new activities amount
                      setForm((prev) => {
                        const confirmedPax = parseFloat(prev.confirmedPax) || 0;
                        const finalRate = parseFloat(prev.finalRate) || 0;
                        const base = confirmedPax && finalRate ? confirmedPax * finalRate : 0;
                        const newTotal = base + newActAmount;
                        const totalAmountPaid = parseFloat(prev.totalAmountPaid) || 0;
                        return {
                          ...prev,
                          finalTotalAmount: newTotal.toString(),
                          dueAmount: (newTotal - totalAmountPaid).toString(),
                        };
                      });
                    }}
                    className="p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-lg font-bold ${activitiesAdded ? 'text-green-900' : 'text-amber-900'}`}>
                    ₹{(parseFloat(editableActivitiesTotal) || activitiesData.total).toLocaleString('en-IN')}
                  </p>
                  {activitiesAdded && (
                    <button
                      onClick={() => setEditingActivities(true)}
                      className="p-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                      title="Edit amount"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className={`text-[10px] mt-1 ${activitiesAdded ? 'text-green-600' : 'text-amber-600'}`}>
                {activitiesData.items.map((a) => `${a.name} (${a.pax} pax × ₹${parseFloat(a.amount).toLocaleString('en-IN')})`).join(' | ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              {activitiesAdded ? (
                <button
                  onClick={() => {
                    setActivitiesAdded(false);
                    setEditingActivities(false);
                    const actAmount = parseFloat(editableActivitiesTotal) || 0;
                    setForm((prev) => {
                      const currentTotal = parseFloat(prev.finalTotalAmount) || 0;
                      const newTotal = currentTotal - actAmount;
                      const totalAmountPaid = parseFloat(prev.totalAmountPaid) || 0;
                      return { ...prev, finalTotalAmount: Math.max(0, newTotal).toString(), dueAmount: (Math.max(0, newTotal) - totalAmountPaid).toString() };
                    });
                  }}
                  className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100 transition-colors"
                >
                  Remove from Bill
                </button>
              ) : (
                <button
                  onClick={() => {
                    const actAmount = activitiesData.total;
                    setEditableActivitiesTotal(actAmount.toString());
                    setActivitiesAdded(true);
                    setForm((prev) => {
                      const currentTotal = parseFloat(prev.finalTotalAmount) || 0;
                      const newTotal = currentTotal + actAmount;
                      const totalAmountPaid = parseFloat(prev.totalAmountPaid) || 0;
                      return { ...prev, finalTotalAmount: newTotal.toString(), dueAmount: (newTotal - totalAmountPaid).toString() };
                    });
                  }}
                  className="text-xs font-bold text-white bg-[#af4408] rounded-lg px-4 py-2 hover:bg-[#963a07] transition-colors"
                >
                  Add to Final Bill
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Billing Form */}
      {party && party.status !== 'Cancelled' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Billing Details</h3>

          <div className="space-y-4">
            {/* Row 1: Confirmed Pax + Final Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Confirmed Pax <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.confirmedPax}
                  onChange={(e) => handleChange('confirmedPax', e.target.value)}
                  placeholder="No. of guests"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Final Rate (per pax) {party.status === 'Confirmed' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="number"
                  value={form.finalRate}
                  onChange={(e) => handleChange('finalRate', e.target.value)}
                  placeholder="Rate per person"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                />
              </div>
            </div>

            {/* Final Total Amount (auto-calculated) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Final Total Amount <span className="text-[10px] text-gray-400">(Auto: Rate × Pax)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                <input
                  type="number"
                  value={form.finalTotalAmount}
                  onChange={(e) => handleChange('finalTotalAmount', e.target.value)}
                  placeholder="Auto-calculated"
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 bg-amber-50 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                />
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Payment section */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Details</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPaymentForm(!showPaymentForm)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Payment
                </button>
                <button
                  onClick={fetchPaymentHistory}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <History className="w-3.5 h-3.5" /> Payment History
                </button>
              </div>
            </div>

            {/* Add Payment Form */}
            {showPaymentForm && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
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
                      <option value="Razorpay">Razorpay</option>
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
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
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

            {/* Payment History */}
            {showPaymentHistory && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
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
                        {entry.recordedBy && <span className="ml-2 text-gray-400">by {entry.recordedBy}</span>}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-gray-400 text-center py-4">No payments recorded yet.</p>
                )}
              </div>
            )}

            {/* Payment Summary (read-only totals) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total Advance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    value={form.totalAdvancePaid}
                    readOnly
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 bg-blue-50 text-sm font-semibold text-blue-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    value={form.totalPaid}
                    readOnly
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 bg-green-50 text-sm font-semibold text-green-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount Paid</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    value={form.totalAmountPaid}
                    readOnly
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 bg-green-50 text-sm font-semibold text-green-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Due Amount (auto-calculated) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Due Amount <span className="text-[10px] text-gray-400">(Final Total - Total Paid)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                <input
                  type="number"
                  value={form.dueAmount}
                  readOnly
                  className={`w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold cursor-not-allowed ${
                    parseFloat(form.dueAmount) > 0
                      ? 'bg-red-50 text-red-700'
                      : parseFloat(form.dueAmount) === 0
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-50 text-gray-900'
                  }`}
                />
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Bill Order ID */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bill Order ID <span className="text-[10px] text-gray-400">(POS Ref)</span></label>
              <input
                type="text"
                value={form.billOrderId}
                onChange={(e) => handleChange('billOrderId', e.target.value)}
                placeholder="POS Order ID"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
              />
            </div>

            {/* Balance Payment Details — highlighted when due > 0 */}
            {parseFloat(form.dueAmount) > 0 && (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Due amount detected — payment reminder details required
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Balance Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.balancePaymentDate}
                      onChange={(e) => handleChange('balancePaymentDate', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Guest Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.guestEmail}
                      onChange={(e) => handleChange('guestEmail', e.target.value)}
                      placeholder="guest@example.com"
                      className="w-full px-3 py-2.5 rounded-lg border border-amber-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Balance Payment Date + Guest Email when no due */}
            {parseFloat(form.dueAmount) <= 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Balance Payment Date</label>
                  <input
                    type="date"
                    value={form.balancePaymentDate}
                    onChange={(e) => handleChange('balancePaymentDate', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Guest Email</label>
                  <input
                    type="email"
                    value={form.guestEmail}
                    onChange={(e) => handleChange('guestEmail', e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            {form.finalTotalAmount && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Final Total</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(form.finalTotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Total Paid</span>
                  <span className="font-semibold text-green-600">{formatCurrency(form.totalAmountPaid || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-700">Balance Due</span>
                  <span className={`font-bold text-lg ${parseFloat(form.dueAmount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(form.dueAmount || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Billing Details'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
