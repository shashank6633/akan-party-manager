import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, RefreshCw, X, AlertCircle, AlertOctagon, MessageSquarePlus, Phone, Clock, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import StatsCards from '../components/Dashboard/StatsCards';
import PartyTable from '../components/Dashboard/PartyTable';
import StatusBadge from '../components/Party/StatusBadge';
import { partyAPI, notificationAPI } from '../services/api';
import { debounce, formatDate, isTBCDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['All', 'Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'];
const CASHIER_STATUS_OPTIONS = ['All', 'Confirmed'];
const PAGE_SIZE = 20;

// Get date 2 weeks from now as YYYY-MM-DD
function getTwoWeeksFromNow() {
 const d = new Date();
 d.setDate(d.getDate() + 14);
 return d.toISOString().split('T')[0];
}

export default function Dashboard() {
 const { globalSearch } = useOutletContext();
 const { user } = useAuth();
 const navigate = useNavigate();
 const isGRE = user?.role === 'GRE';
 const isCashier = user?.role === 'CASHIER';
 const canFollowUp = ['SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
 const [parties, setParties] = useState([]);
 const [stats, setStats] = useState(null);
 const [loading, setLoading] = useState(true);
 const [statsLoading, setStatsLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState('All');
 const [searchQuery, setSearchQuery] = useState('');
 const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
 const [dateTo, setDateTo] = useState(() => getTwoWeeksFromNow());
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [showFilters, setShowFilters] = useState(false);

 // Stats month filter: 0 = this month, -1 = last month, 1 = next month
 const [statsMonthOffset, setStatsMonthOffset] = useState(0);

 const getMonthRange = (offset) => {
 const now = new Date();
 const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
 const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
 const fmt = (d) => d.toISOString().split('T')[0];
 return { from: fmt(start), to: fmt(end) };
 };

 const getMonthLabel = (offset) => {
 const d = new Date();
 d.setMonth(d.getMonth() + offset);
 return d.toLocaleString('default', { month: 'long', year: 'numeric' });
 };

 // Quick action modal state
 const [modal, setModal] = useState({ open: false, type: '', party: null });
 const [modalInput, setModalInput] = useState('');
 const [modalLoading, setModalLoading] = useState(false);

 // Follow-up tracking
 const [pendingFollowUps, setPendingFollowUps] = useState([]);
 const [followUpLoading, setFollowUpLoading] = useState(false);

 // Stale enquiry alerts
 const [staleEnquiries, setStaleEnquiries] = useState([]);

 const fetchParties = useCallback(async () => {
 setLoading(true);
 try {
 const params = { page, limit: PAGE_SIZE };
 if (statusFilter !== 'All') params.status = statusFilter;
 if (searchQuery) params.search = searchQuery;
 if (globalSearch) params.search = globalSearch;
 if (dateFrom) params.dateFrom = dateFrom;
 if (dateTo) params.dateTo = dateTo;
 const res = await partyAPI.getAll(params);
 setParties(res.data.parties || []);
 setTotalPages(res.data.totalPages || 1);
 } catch (err) {
 console.error('Failed to fetch parties:', err);
 } finally {
 setLoading(false);
 }
 }, [page, statusFilter, searchQuery, dateFrom, dateTo, globalSearch]);

 const fetchStats = useCallback(async () => {
 setStatsLoading(true);
 try {
 const { from, to } = getMonthRange(statsMonthOffset);
 const res = await partyAPI.getStats({ dateFrom: from, dateTo: to });
 setStats(res.data.stats || res.data);
 } catch (err) {
 console.error('Failed to fetch stats:', err);
 } finally {
 setStatsLoading(false);
 }
 }, [statsMonthOffset]);

 useEffect(() => {
 fetchParties();
 }, [fetchParties]);

 useEffect(() => {
 fetchStats();
 }, [fetchStats]);

 const fetchFollowUps = useCallback(async () => {
 if (!canFollowUp) return;
 setFollowUpLoading(true);
 try {
 const res = await partyAPI.getPendingFollowUps();
 setPendingFollowUps(res.data.parties || []);
 } catch (err) {
 console.error('Failed to fetch follow-ups:', err);
 } finally {
 setFollowUpLoading(false);
 }
 }, [canFollowUp]);

 useEffect(() => {
 fetchFollowUps();
 }, [fetchFollowUps]);

 const fetchStaleEnquiries = useCallback(async () => {
 if (!canFollowUp) return;
 try {
 const res = await notificationAPI.getStaleEnquiries();
 setStaleEnquiries(res.data.staleEnquiries || []);
 } catch (err) {
 // Non-critical, silently handle
 }
 }, [canFollowUp]);

 useEffect(() => {
 fetchStaleEnquiries();
 }, [fetchStaleEnquiries]);

 // Auto-refresh every 30 seconds
 useEffect(() => {
 const interval = setInterval(() => {
 fetchParties();
 fetchStats();
 fetchStaleEnquiries();
 }, 30000);
 return () => clearInterval(interval);
 }, [fetchParties, fetchStats, fetchStaleEnquiries]);

 const debouncedSearch = useCallback(
 debounce((val) => {
 setSearchQuery(val);
 setPage(1);
 }, 400),
 []
 );

 // Quick date buttons
 const setToday = () => {
 const today = new Date().toISOString().split('T')[0];
 setDateFrom(today);
 setDateTo(today);
 setPage(1);
 };
 const setThisWeek = () => {
 const now = new Date();
 const start = new Date(now);
 start.setDate(now.getDate() - now.getDay());
 setDateFrom(start.toISOString().split('T')[0]);
 setDateTo(now.toISOString().split('T')[0]);
 setPage(1);
 };
 const setThisMonth = () => {
 const now = new Date();
 const start = new Date(now.getFullYear(), now.getMonth(), 1);
 setDateFrom(start.toISOString().split('T')[0]);
 setDateTo(now.toISOString().split('T')[0]);
 setPage(1);
 };
 const clearFilters = () => {
 setStatusFilter('All');
 setSearchQuery('');
 setDateFrom('');
 setDateTo('');
 setPage(1);
 };

 const hasActiveFilters = statusFilter !== 'All' || searchQuery || dateFrom || dateTo;

 // Quick actions
 const handleQuickAction = (party, type) => {
 setModal({ open: true, type, party });
 setModalInput('');
 };

 const executeQuickAction = async () => {
 setModalLoading(true);
 try {
 if (modal.type === 'confirm') {
 await partyAPI.updateStatus(modal.party.rowIndex, { status: 'Confirmed' });
 } else if (modal.type === 'cancel') {
 if (!modalInput.trim()) return;
 await partyAPI.updateStatus(modal.party.rowIndex, { status: 'Cancelled', lostReason: modalInput });
 } else if (modal.type === 'payment') {
 if (!modalInput || isNaN(modalInput)) return;
 await partyAPI.addPayment(modal.party.rowIndex, { amount: parseFloat(modalInput), type: 'advance' });
 }
 setModal({ open: false, type: '', party: null });
 fetchParties();
 fetchStats();
 } catch (err) {
 alert(err.response?.data?.message || 'Action failed. Please try again.');
 } finally {
 setModalLoading(false);
 }
 };

 return (
 <div className="space-y-6">
 {/* Stats month selector + cards - hidden for GRE */}
 {!isGRE && (
 <>
 <div className="flex items-center justify-between">
  <div className="flex items-center gap-1">
  <button
   onClick={() => setStatsMonthOffset((o) => o - 1)}
   className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
  >
   <ChevronLeft className="w-4 h-4" />
  </button>
  <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
   {getMonthLabel(statsMonthOffset)}
  </span>
  <button
   onClick={() => setStatsMonthOffset((o) => o + 1)}
   className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
  >
   <ChevronRight className="w-4 h-4" />
  </button>
  </div>
  <div className="flex items-center gap-1">
  {[-1, 0, 1].map((o) => (
   <button
   key={o}
   onClick={() => setStatsMonthOffset(o)}
   className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
    statsMonthOffset === o
    ? 'bg-[#af4408] text-white'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
   }`}
   >
   {o === -1 ? 'Last Month' : o === 0 ? 'This Month' : 'Next Month'}
   </button>
  ))}
  </div>
 </div>
 <StatsCards stats={stats} loading={statsLoading} cashierView={isCashier} showRevenue={['SALES', 'MANAGER', 'ADMIN'].includes(user?.role)} />
 </>
 )}

 {/* URGENT: Stale enquiry alerts */}
 {canFollowUp && staleEnquiries.length > 0 && (
 <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 animate-pulse-subtle">
 <div className="flex items-center gap-2 mb-3">
 <AlertOctagon className="w-5 h-5 text-red-600" />
 <h3 className="text-sm font-bold text-red-800">
 URGENT: {staleEnquiries.length} Enquir{staleEnquiries.length === 1 ? 'y' : 'ies'} Pending Status Update
 </h3>
 <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-bold">Action Required</span>
 </div>
 <p className="text-xs text-red-600 mb-3">These enquiries have not been updated for over 1 hour. Please change status to Confirmed / Tentative / Cancelled.</p>
 <div className="space-y-2 max-h-48 overflow-y-auto">
 {staleEnquiries.slice(0, 5).map((party) => (
 <div
 key={party.rowIndex}
 onClick={() => navigate(`/parties/${party.rowIndex}`)}
 className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-red-200 cursor-pointer hover:border-red-400 hover:shadow-sm transition-all"
 >
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold text-gray-900 truncate">{party.hostName}</p>
 <div className="flex items-center gap-3 mt-1">
 {party.phoneNumber && (
 <span className="flex items-center gap-1 text-[11px] text-gray-500">
 <Phone className="w-3 h-3" />{party.phoneNumber}
 </span>
 )}
 <span className="flex items-center gap-1 text-[11px] text-gray-500">
 <Calendar className="w-3 h-3" />
 {isTBCDate(party.date) ? party.date.replace('TBC: ', '') : formatDate(party.date)}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
 <Timer className="w-3 h-3" />
 {party.hoursAgo}h
 </span>
 </div>
 </div>
 ))}
 {staleEnquiries.length > 5 && (
 <p className="text-xs text-red-600 text-center pt-1 font-medium">+{staleEnquiries.length - 5} more pending</p>
 )}
 </div>
 </div>
 )}

 {/* Follow-up tracking for Sales/Manager */}
 {canFollowUp && pendingFollowUps.length > 0 && (
 <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
 <div className="flex items-center gap-2 mb-3">
 <AlertCircle className="w-4 h-4 text-amber-600" />
 <h3 className="text-sm font-semibold text-amber-800">Needs Follow-Up ({pendingFollowUps.length})</h3>
 <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">Pending</span>
 </div>
 <div className="space-y-2 max-h-[400px] overflow-y-auto">
 {pendingFollowUps.map((party) => (
 <div
 key={party.rowIndex}
 onClick={() => navigate(`/parties/${party.rowIndex}`)}
 className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-amber-100 cursor-pointer hover:border-amber-300 transition-colors"
 >
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium text-gray-900 truncate">{party.hostName}</p>
 <div className="flex items-center gap-2 mt-0.5">
 {party.phoneNumber && (
 <span className="flex items-center gap-1 text-[11px] text-gray-500">
 <Phone className="w-3 h-3" />{party.phoneNumber}
 </span>
 )}
 <span className="flex items-center gap-1 text-[11px] text-gray-500">
 <Clock className="w-3 h-3" />
 {isTBCDate(party.date) ? party.date.replace('TBC: ', '') : formatDate(party.date)}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <StatusBadge status={party.status} size="xs" />
 <MessageSquarePlus className="w-4 h-4 text-amber-500" />
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Upcoming parties banner */}
 <div className="bg-[#af4408]/5 border border-[#af4408]/20 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <h2 className="text-sm font-semibold text-[#af4408] mb-0.5">Upcoming Parties (Next 2 Weeks)</h2>
 <p className="text-xs text-gray-500">Showing parties from today to {dateTo ? formatDate(dateTo) : ''}</p>
 </div>
 {!isGRE && !isCashier && (
 <button
 onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
 className="text-xs text-[#af4408] font-medium hover:underline shrink-0"
 >
 Show All
 </button>
 )}
 </div>

 {/* Filters bar */}
 <div className="bg-white rounded-xl border border-gray-200 p-4">
 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
 {/* Search */}
 <div className="relative flex-1 min-w-0 w-full sm:w-auto">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 placeholder="Search by name, phone, company..."
 onChange={(e) => debouncedSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-colors"
 />
 </div>

 {/* Status filter */}
 <select
 value={statusFilter}
 onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
 className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 >
 {(isCashier ? CASHIER_STATUS_OPTIONS : STATUS_OPTIONS).map((s) => (
 <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
 ))}
 </select>

 {/* Quick date buttons - hidden for GRE and CASHIER */}
 {!isGRE && !isCashier && (
 <div className="hidden sm:flex items-center gap-1">
 <button onClick={setToday} className="px-3 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Today</button>
 <button onClick={setThisWeek} className="px-3 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">This Week</button>
 <button onClick={setThisMonth} className="px-3 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">This Month</button>
 </div>
 )}

 {/* Toggle more filters - hidden for GRE and CASHIER */}
 {!isGRE && !isCashier && (
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`p-2.5 rounded-lg border transition-colors ${showFilters ? 'border-[#af4408] bg-[#af4408]/10 text-[#af4408]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
 >
 <Filter className="w-4 h-4" />
 </button>
 )}

 {/* Refresh */}
 <button
 onClick={() => { fetchParties(); fetchStats(); }}
 className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
 title="Refresh"
 >
 <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
 </button>

 {/* Clear filters - hidden for GRE and CASHIER */}
 {!isGRE && !isCashier && hasActiveFilters && (
 <button
 onClick={clearFilters}
 className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
 >
 <X className="w-3 h-3" /> Clear
 </button>
 )}
 </div>

 {/* Expanded date filters - hidden for GRE and CASHIER */}
 {!isGRE && !isCashier && showFilters && (
 <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-gray-100">
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
 <label className="text-xs text-gray-500 shrink-0">From:</label>
 <input
 type="date"
 value={dateFrom}
 onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
 className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 min-w-0 flex-1 sm:flex-none"
 />
 </div>
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <label className="text-xs text-gray-500 shrink-0 ml-6 sm:ml-0">To:</label>
 <input
 type="date"
 value={dateTo}
 onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
 className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 min-w-0 flex-1 sm:flex-none"
 />
 </div>
 {/* Mobile quick date buttons */}
 <div className="flex sm:hidden items-center gap-1">
 <button onClick={setToday} className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">Today</button>
 <button onClick={setThisWeek} className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">Week</button>
 <button onClick={setThisMonth} className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">Month</button>
 </div>
 </div>
 )}
 </div>

 {/* Party table */}
 <PartyTable
 parties={parties}
 loading={loading}
 onQuickAction={handleQuickAction}
 page={page}
 totalPages={totalPages}
 onPageChange={setPage}
 />

 {/* Quick action modal */}
 {modal.open && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal({ open: false, type: '', party: null })}>
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
 <h3 className="text-lg font-semibold text-gray-900 mb-1">
 {modal.type === 'confirm' && 'Confirm Party'}
 {modal.type === 'cancel' && 'Cancel Party'}
 {modal.type === 'payment' && 'Add Advance Payment'}
 </h3>
 <p className="text-sm text-gray-500 mb-4">
 {modal.party?.hostName} - {modal.party?.date}
 </p>

 {modal.type === 'confirm' && (
 <p className="text-sm text-gray-700 mb-4">
 Are you sure you want to mark this party as <span className="font-semibold text-green-600">Confirmed</span>?
 </p>
 )}

 {modal.type === 'cancel' && (
 <div className="mb-4">
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Lost Reason <span className="text-red-500">*</span>
 </label>
 <textarea
 value={modalInput}
 onChange={(e) => setModalInput(e.target.value)}
 placeholder="Why was this party cancelled?"
 rows={3}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 resize-none"
 />
 </div>
 )}

 {modal.type === 'payment' && (
 <div className="mb-4">
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Advance Amount (INR)
 </label>
 <input
 type="number"
 value={modalInput}
 onChange={(e) => setModalInput(e.target.value)}
 placeholder="Enter amount"
 className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
 />
 </div>
 )}

 <div className="flex justify-end gap-3">
 <button
 onClick={() => setModal({ open: false, type: '', party: null })}
 className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={executeQuickAction}
 disabled={modalLoading || (modal.type === 'cancel' && !modalInput.trim()) || (modal.type === 'payment' && (!modalInput || isNaN(modalInput)))}
 className={`px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
 modal.type === 'cancel'
 ? 'bg-red-600 hover:bg-red-700'
 : 'bg-[#af4408] hover:bg-[#963a07]'
 }`}
 >
 {modalLoading ? 'Processing...' : modal.type === 'confirm' ? 'Confirm' : modal.type === 'cancel' ? 'Cancel Party' : 'Save'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
