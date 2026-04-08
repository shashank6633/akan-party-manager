import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, RefreshCw, X, AlertCircle, AlertOctagon, MessageSquarePlus, Phone, Clock, Timer, ChevronLeft, ChevronRight, User, IndianRupee, TrendingUp, UserPlus } from 'lucide-react';
import StatsCards from '../components/Dashboard/StatsCards';
import PartyTable from '../components/Dashboard/PartyTable';
import StatusBadge from '../components/Party/StatusBadge';
import { partyAPI, notificationAPI, guestContactAPI } from '../services/api';
import { debounce, formatDate, formatCurrency, isTBCDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['All', 'Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'];
const CASHIER_STATUS_OPTIONS = ['All', 'Confirmed'];
const PAGE_SIZE = 20;

// Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift issues)
function toLocalDateStr(d) {
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${y}-${m}-${day}`;
}

// Get start of current month as YYYY-MM-DD
function getStartOfMonth() {
 const now = new Date();
 return toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
}

// Get end of current month as YYYY-MM-DD
function getEndOfMonth() {
 const now = new Date();
 return toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

export default function Dashboard() {
 const outletContext = useOutletContext();
 const { user } = useAuth();
 const navigate = useNavigate();
 const isGRE = user?.role === 'GRE';
 const isCashier = user?.role === 'CASHIER' || user?.role === 'ACCOUNTS';
 const isViewer = user?.role === 'VIEWER';
 const canFollowUp = ['SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
 const [parties, setParties] = useState([]);
 const [stats, setStats] = useState(null);
 const [loading, setLoading] = useState(true);
 const [statsLoading, setStatsLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState('All');
 const [searchQuery, setSearchQuery] = useState('');
 const [dateFrom, setDateFrom] = useState(() => getStartOfMonth());
 const [dateTo, setDateTo] = useState(() => getEndOfMonth());
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [showFilters, setShowFilters] = useState(false);
 const [activeQuickDate, setActiveQuickDate] = useState('thisMonth');

 // Stats month filter: 0 = this month, -1 = last month, 1 = next month
 const [statsMonthOffset, setStatsMonthOffset] = useState(0);

 const getMonthRange = (offset) => {
 const now = new Date();
 const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
 const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
 const fmt = (d) => toLocalDateStr(d);
 return { from: fmt(start), to: fmt(end) };
 };

 const getMonthLabel = (offset) => {
 const now = new Date();
 const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
 return d.toLocaleString('default', { month: 'long', year: 'numeric' });
 };

 // Sync stats month change with party list date filters
 const changeMonth = (offset) => {
 setStatsMonthOffset(offset);
 const { from, to } = getMonthRange(offset);
 setDateFrom(from);
 setDateTo(to);
 setPage(1);
 setActiveQuickDate(offset === 0 ? 'thisMonth' : '');
 };

 // Quick action modal state
 const [modal, setModal] = useState({ open: false, type: '', party: null });
 const [modalInput, setModalInput] = useState('');
 const [modalLoading, setModalLoading] = useState(false);

 // Follow-up tracking
 const [pendingFollowUps, setPendingFollowUps] = useState([]);
 const [followUpLoading, setFollowUpLoading] = useState(false);

 // "My Parties" filter for follow-up and upcoming sections
 const [myFollowUps, setMyFollowUps] = useState(false);
 const [myUpcoming, setMyUpcoming] = useState(false);

 // Pending Dues filter
 const [pendingDuesOnly, setPendingDuesOnly] = useState(false);

 // Stale enquiry alerts
 const [staleEnquiries, setStaleEnquiries] = useState([]);
 const [showStalePopup, setShowStalePopup] = useState(false);

 // Guest Contacts tasks (GRE + Admin)
 const isAdmin = user?.role === 'ADMIN';
 const [gcTasks, setGcTasks] = useState([]);
 const [gcAdminRequests, setGcAdminRequests] = useState([]);
 const [noContactReason, setNoContactReason] = useState('');
 const [noContactParty, setNoContactParty] = useState(null);
 const [gcLoading, setGcLoading] = useState(false);

 const fetchParties = useCallback(async () => {
 setLoading(true);
 try {
 const params = { page, limit: PAGE_SIZE };
 if (statusFilter !== 'All') params.status = statusFilter;
 if (searchQuery) params.search = searchQuery;
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
 }, [page, statusFilter, searchQuery, dateFrom, dateTo]);

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

 // Initial fetch
 useEffect(() => {
 fetchStaleEnquiries();
 }, [fetchStaleEnquiries]);

 // GRE: fetch guest contacts tasks
 const fetchGcTasks = useCallback(async () => {
  if (!isGRE && !isAdmin) return;
  try {
   const res = await guestContactAPI.getTasks();
   setGcTasks(res.data.tasks || []);
  } catch { /* ignore */ }
 }, [isGRE, isAdmin]);

 // Admin: fetch "No Contacts" approval requests
 const fetchGcAdminRequests = useCallback(async () => {
  if (!isAdmin) return;
  try {
   const res = await guestContactAPI.getAdminRequests();
   setGcAdminRequests(res.data.requests || []);
  } catch { /* ignore */ }
 }, [isAdmin]);

 useEffect(() => {
  fetchGcTasks();
  fetchGcAdminRequests();
 }, [fetchGcTasks, fetchGcAdminRequests]);

 const handleNoContactRequest = async () => {
  if (!noContactParty || !noContactReason.trim()) return;
  setGcLoading(true);
  try {
   await guestContactAPI.requestNoContacts(noContactParty.rowIndex, noContactReason);
   setNoContactParty(null);
   setNoContactReason('');
   fetchGcTasks();
  } catch { /* ignore */ }
  finally { setGcLoading(false); }
 };

 const handleApproveNoContacts = async (rowIndex) => {
  setGcLoading(true);
  try {
   await guestContactAPI.approveNoContacts(rowIndex);
   fetchGcAdminRequests();
   fetchGcTasks();
  } catch { /* ignore */ }
  finally { setGcLoading(false); }
 };

 // Show popup whenever stale enquiries are fetched and there are any
 useEffect(() => {
 if (staleEnquiries.length > 0) {
  setShowStalePopup(true);
 }
 }, [staleEnquiries]);

 const dismissStalePopup = () => {
 setShowStalePopup(false);
 };

 // Auto-refresh every 5 minutes — re-fetches stale enquiries (popup will reappear if any exist)
 useEffect(() => {
 const interval = setInterval(() => {
 fetchParties();
 fetchStats();
 fetchStaleEnquiries();
 }, 300000);
 return () => clearInterval(interval);
 }, [fetchParties, fetchStats, fetchStaleEnquiries]);

 const debouncedSearch = useCallback(
 debounce((val) => {
 setSearchQuery(val);
 if (val && val.trim()) {
  setDateFrom('');
  setDateTo('');
 }
 setPage(1);
 }, 400),
 []
 );

 // Quick date buttons
 const setToday = () => {
 const today = toLocalDateStr(new Date());
 setDateFrom(today);
 setDateTo(today);
 setPage(1);
 setActiveQuickDate('today');
 };
 const setThisWeek = () => {
 const now = new Date();
 const start = new Date(now);
 start.setDate(now.getDate() - now.getDay());
 setDateFrom(toLocalDateStr(start));
 setDateTo(toLocalDateStr(now));
 setPage(1);
 setActiveQuickDate('thisWeek');
 };
 const setThisMonth = () => {
 const now = new Date();
 setDateFrom(toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
 setDateTo(toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
 setPage(1);
 setActiveQuickDate('thisMonth');
 };
 const setNextMonth = () => {
 const now = new Date();
 setDateFrom(toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 1)));
 setDateTo(toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 2, 0)));
 setPage(1);
 setActiveQuickDate('nextMonth');
 };
 const clearFilters = () => {
 setStatusFilter('All');
 setSearchQuery('');
 setDateFrom('');
 setDateTo('');
 setPage(1);
 setActiveQuickDate('');
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
   onClick={() => changeMonth(statsMonthOffset - 1)}
   className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
  >
   <ChevronLeft className="w-4 h-4" />
  </button>
  <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
   {getMonthLabel(statsMonthOffset)}
  </span>
  <button
   onClick={() => changeMonth(statsMonthOffset + 1)}
   className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
  >
   <ChevronRight className="w-4 h-4" />
  </button>
  </div>
  <div className="flex items-center gap-1">
  {[-1, 0, 1].map((o) => (
   <button
   key={o}
   onClick={() => changeMonth(o)}
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
 <StatsCards stats={stats} loading={statsLoading} cashierView={isCashier} showRevenue={['CASHIER', 'ACCOUNTS', 'ADMIN'].includes(user?.role)} onPendingDuesClick={() => { setStatusFilter('Confirmed'); setPendingDuesOnly(true); setPage(1); }} />
 </>
 )}

 {/* Today's Expected Income Banner — ADMIN only */}
 {user?.role === 'ADMIN' && stats?.todayExpectedIncome > 0 && (
 <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
 <div className="flex items-center justify-between gap-3">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
   <TrendingUp className="w-5 h-5 text-green-600" />
  </div>
  <div>
   <p className="text-xs font-medium text-green-700 uppercase tracking-wider">Today's Expected Income</p>
   <p className="text-2xl font-black text-green-800">{formatCurrency(stats.todayExpectedIncome)}</p>
   <p className="text-[11px] text-green-600 mt-0.5">
   {stats.todayConfirmed} confirmed part{stats.todayConfirmed !== 1 ? 'ies' : 'y'} today
   </p>
  </div>
  </div>
  {stats.todayConfirmedParties && stats.todayConfirmedParties.length > 0 && (
  <div className="hidden sm:flex flex-col gap-1 max-w-xs">
   {stats.todayConfirmedParties.slice(0, 3).map((p, i) => (
   <div key={i} className="flex items-center gap-2 text-[11px] bg-white/70 rounded-lg px-2.5 py-1.5">
    <span className="font-semibold text-gray-800 truncate max-w-[120px]">{p.hostName}</span>
    {p.partyTime && <span className="text-orange-700 font-medium bg-orange-50 px-1.5 py-0.5 rounded text-[10px]">{p.partyTime}</span>}
    {p.place && <span className="text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">{p.place}</span>}
    <span className="font-bold text-green-700 ml-auto">{formatCurrency(p.approxBill)}</span>
   </div>
   ))}
   {stats.todayConfirmedParties.length > 3 && (
   <p className="text-[10px] text-green-600 text-right">+{stats.todayConfirmedParties.length - 3} more</p>
   )}
  </div>
  )}
 </div>
 </div>
 )}

 {/* URGENT: Stale enquiry popup modal */}
 {canFollowUp && showStalePopup && staleEnquiries.length > 0 && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={dismissStalePopup}>
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in" onClick={(e) => e.stopPropagation()}>
 {/* Header */}
 <div className="bg-red-600 rounded-t-2xl px-5 py-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
   <AlertOctagon className="w-6 h-6 text-white" />
  </div>
  <div>
   <h3 className="text-base font-bold text-white">
   {staleEnquiries.length} Enquir{staleEnquiries.length === 1 ? 'y' : 'ies'} Pending
   </h3>
   <p className="text-xs text-red-100 mt-0.5">Not updated for over 40 minutes</p>
  </div>
  </div>
  <button onClick={dismissStalePopup} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
  <X className="w-5 h-5 text-white" />
  </button>
 </div>

 {/* Body */}
 <div className="p-5">
  <p className="text-sm text-gray-600 mb-4">
  These enquiries need a status update. Please change to <span className="font-semibold text-green-600">Contacted</span>, <span className="font-semibold text-amber-600">Tentative</span>, <span className="font-semibold text-green-700">Confirmed</span>, or <span className="font-semibold text-red-600">Cancelled</span>.
  </p>

  <div className="space-y-2 max-h-64 overflow-y-auto">
  {staleEnquiries.map((party) => (
   <div
   key={party.rowIndex}
   onClick={() => { dismissStalePopup(); navigate(`/parties/${party.rowIndex}`); }}
   className="flex items-center justify-between gap-3 p-3 bg-red-50 rounded-xl border border-red-200 cursor-pointer hover:bg-red-100 hover:border-red-400 transition-all"
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
     {party.day && <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-[#af4408]/10 text-[#af4408]">{party.day.slice(0, 3)}</span>}
    </span>
    {party.partyTime && (
     <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">{party.partyTime}</span>
    )}
    {party.place && (
     <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{party.place}</span>
    )}
    {party.handledBy && (
     <span className="text-[10px] text-gray-700 bg-white px-1.5 py-0.5 rounded">{party.handledBy}</span>
    )}
    </div>
   </div>
   <div className="flex items-center gap-2 shrink-0">
    {party.phoneNumber && (
    <a
     href={`tel:${party.phoneNumber}`}
     onClick={(e) => e.stopPropagation()}
     className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
     title="Call Guest"
    >
     <Phone className="w-3.5 h-3.5" />
    </a>
    )}
    <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
    <Timer className="w-3 h-3" />
    {party.minutesAgo >= 60 ? `${party.hoursAgo}h ${party.minutesAgo % 60}m ago` : `${party.minutesAgo}m ago`}
    </span>
   </div>
   </div>
  ))}
  </div>
 </div>

 {/* Footer */}
 <div className="border-t border-gray-100 px-5 py-3 flex justify-end">
  <button
  onClick={dismissStalePopup}
  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
  >
  Got it
  </button>
 </div>
 </div>
 </div>
 )}

 {/* Follow-up tracking for Sales/Manager */}
 {canFollowUp && pendingFollowUps.length > 0 && (() => {
 const filteredFollowUps = myFollowUps
  ? pendingFollowUps.filter((p) => p.handledBy && p.handledBy.toLowerCase().includes(user?.name?.toLowerCase()))
  : pendingFollowUps;
 return (
 <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <AlertCircle className="w-4 h-4 text-amber-600" />
 <h3 className="text-sm font-semibold text-amber-800">Needs Follow-Up ({filteredFollowUps.length})</h3>
 <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">Pending</span>
 </div>
 {user?.name && user?.role !== 'ACCOUNTS' && user?.role !== 'VIEWER' && (
 <button
  onClick={() => setMyFollowUps(!myFollowUps)}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
  myFollowUps
   ? 'bg-[#af4408] text-white shadow-sm'
   : 'bg-white text-gray-600 border border-gray-300 hover:border-[#af4408] hover:text-[#af4408]'
  }`}
 >
  <User className="w-3.5 h-3.5" />
  {myFollowUps ? user.name : 'My Parties'}
 </button>
 )}
 </div>
 <div className="space-y-2 max-h-[400px] overflow-y-auto">
 {filteredFollowUps.map((party) => (
 <div
 key={party.rowIndex}
 onClick={() => navigate(`/parties/${party.rowIndex}`)}
 className="p-3 bg-white rounded-lg border border-amber-100 cursor-pointer hover:border-amber-300 transition-colors"
 >
 {/* Top row: Name + Status badges */}
 <div className="flex items-start justify-between gap-2">
  <p className="text-sm font-medium text-gray-900 truncate min-w-0 flex-1">{party.hostName}</p>
  <div className="flex items-center gap-1.5 shrink-0">
  <StatusBadge status={party.status} size="xs" />
  {party._fpAlert && (
   <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200 animate-pulse">FP Needed</span>
  )}
  </div>
 </div>
 {/* Info row: Phone, Date, Handler */}
 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
  {party.phoneNumber && (
  <span className="flex items-center gap-1 text-[11px] text-gray-500">
   <Phone className="w-3 h-3" />{party.phoneNumber}
  </span>
  )}
  <span className="flex items-center gap-1 text-[11px] text-gray-500">
  <Clock className="w-3 h-3" />
  {isTBCDate(party.date) ? party.date.replace('TBC: ', '') : formatDate(party.date)}
  {party.day && <span className="px-1 py-0.5 rounded text-[9px] font-semibold bg-[#af4408]/10 text-[#af4408]">{party.day.slice(0, 3)}</span>}
  </span>
  {party.partyTime && (
  <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">{party.partyTime}</span>
  )}
  {party.place && (
  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{party.place}</span>
  )}
  {party.handledBy && party.handledBy.split(',').map((name, i) => (
  <span key={i} className="text-[10px] text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{name.trim()}</span>
  ))}
 </div>
 {/* Created By */}
 {party.createdBy && (
 <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1">
  <span className="font-medium">Added by:</span> {party.createdBy}
 </p>
 )}
 {/* Latest follow-up note */}
 {party.followUpNotes && (
 <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-1 italic bg-gray-50 rounded px-2 py-1">
  {party.followUpNotes.split('\n')[0]}
 </p>
 )}
 {/* Action row: Call + Follow-up icon */}
 <div className="flex items-center justify-end gap-2 mt-2">
  {party.phoneNumber && (
  <a
   href={`tel:${party.phoneNumber}`}
   onClick={(e) => e.stopPropagation()}
   className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors text-[11px] font-medium"
   title="Call Guest"
  >
   <Phone className="w-3 h-3" /> Call
  </a>
  )}
  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[11px] font-medium">
  <MessageSquarePlus className="w-3 h-3" /> Follow Up
  </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
 })()}

 {/* Upcoming parties banner */}
 <div className="bg-[#af4408]/5 border border-[#af4408]/20 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <h2 className="text-sm font-semibold text-[#af4408] mb-0.5">
  {searchQuery ? 'Search Results' : dateFrom || dateTo ? `Parties: ${dateFrom ? formatDate(dateFrom) : 'Start'} — ${dateTo ? formatDate(dateTo) : 'End'}` : 'All Parties'}
 </h2>
 <p className="text-xs text-gray-500">
  {searchQuery ? `Searching "${searchQuery}" across all dates` : dateFrom && dateTo ? `Filtered by date range` : 'Showing all parties'}
 </p>
 </div>
 <div className="flex items-center gap-2">
 {user?.name && user?.role !== 'ACCOUNTS' && user?.role !== 'VIEWER' && (
 <button
  onClick={() => setMyUpcoming(!myUpcoming)}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
  myUpcoming
   ? 'bg-[#af4408] text-white shadow-sm'
   : 'bg-white text-gray-600 border border-gray-300 hover:border-[#af4408] hover:text-[#af4408]'
  }`}
 >
  <User className="w-3.5 h-3.5" />
  {myUpcoming ? user.name : 'My Parties'}
 </button>
 )}
 {!isGRE && !isCashier && (dateFrom || dateTo) && !searchQuery && (
 <button
  onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
  className="text-xs text-[#af4408] font-medium hover:underline shrink-0"
 >
  Show All
 </button>
 )}
 </div>
 </div>

 {/* Filters bar */}
 <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 space-y-3">
 {/* Row 1: Search bar - full width */}
 <div className="relative w-full">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 placeholder="Search by name, phone, company..."
 onChange={(e) => debouncedSearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-colors"
 />
 </div>

 {/* Row 2: Status pills - scrollable on mobile */}
 <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
 {(isCashier ? CASHIER_STATUS_OPTIONS : STATUS_OPTIONS).map((s) => (
 <button
  key={s}
  onClick={() => { setStatusFilter(s); setPendingDuesOnly(false); setPage(1); }}
  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
  statusFilter === s
   ? s === 'Confirmed' ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
   : s === 'Cancelled' ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
   : s === 'Tentative' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
   : s === 'Contacted' ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
   : s === 'Enquiry' ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
   : 'bg-[#af4408] text-white'
  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`}
 >
  {s === 'All' ? 'All' : s}
 </button>
 ))}
 </div>

 {/* Row 3: Quick dates + action buttons */}
 <div className="flex items-center justify-between gap-2">
 {/* Quick date buttons */}
 {!isGRE && !isCashier && (
 <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
  <button onClick={setToday} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${activeQuickDate === 'today' ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Today</button>
  <button onClick={setThisWeek} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${activeQuickDate === 'thisWeek' ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>This Week</button>
  <button onClick={setThisMonth} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${activeQuickDate === 'thisMonth' ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>This Month</button>
  <button onClick={setNextMonth} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${activeQuickDate === 'nextMonth' ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Next Month</button>
 </div>
 )}

 {/* Action buttons */}
 <div className="flex items-center gap-1.5 shrink-0">
  {/* Date filter toggle */}
  {!isGRE && !isCashier && (
  <button
  onClick={() => setShowFilters(!showFilters)}
  className={`p-2 rounded-lg border transition-colors ${showFilters ? 'border-[#af4408] bg-[#af4408]/10 text-[#af4408]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
  title="Date Filter"
  >
  <Filter className="w-4 h-4" />
  </button>
  )}

  {/* Refresh */}
  <button
  onClick={() => { fetchParties(); fetchStats(); }}
  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
  title="Refresh"
  >
  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
  </button>

  {/* Clear all filters */}
  {!isGRE && !isCashier && hasActiveFilters && (
  <button
  onClick={clearFilters}
  className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors whitespace-nowrap"
  >
  <X className="w-3 h-3" /> Reset
  </button>
  )}
 </div>
 </div>

 {/* Row 4: Expanded date range filters */}
 {!isGRE && !isCashier && showFilters && (
 <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t border-gray-100">
 <div className="flex items-center gap-2 flex-1 min-w-0">
  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
  <label className="text-xs text-gray-500 shrink-0">From</label>
  <input
  type="date"
  value={dateFrom}
  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
  className="px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 min-w-0 flex-1"
  />
 </div>
 <div className="flex items-center gap-2 flex-1 min-w-0">
  <label className="text-xs text-gray-500 shrink-0">To</label>
  <input
  type="date"
  value={dateTo}
  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
  className="px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 min-w-0 flex-1"
  />
 </div>
 </div>
 )}
 </div>

 {/* Pending Dues filter banner */}
 {pendingDuesOnly && (
 <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5">
  <p className="text-xs font-semibold text-orange-700">Showing only Confirmed parties with Pending Dues</p>
  <button onClick={() => { setPendingDuesOnly(false); setStatusFilter('All'); }} className="text-xs font-semibold text-orange-600 hover:text-orange-800 underline">Clear Filter</button>
 </div>
 )}

 {/* Party table */}
 <PartyTable
 parties={(() => {
  let list = myUpcoming ? parties.filter((p) => p.handledBy && p.handledBy.toLowerCase().includes(user?.name?.toLowerCase())) : parties;
  if (pendingDuesOnly) list = list.filter((p) => parseFloat(p.dueAmount) > 0);
  return list;
 })()}
 loading={loading}
 onQuickAction={isViewer || isGRE ? null : handleQuickAction}
 page={page}
 totalPages={totalPages}
 onPageChange={setPage}
 />

 {/* Guest Contacts Tasks for GRE */}
 {(isGRE || isAdmin) && gcTasks.length > 0 && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
   <div className="flex items-center gap-2 mb-3">
    <UserPlus className="w-4 h-4 text-blue-600" />
    <h3 className="text-sm font-semibold text-blue-800">Guest Contacts Pending ({gcTasks.length})</h3>
    <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full font-medium">Tasks</span>
   </div>
   <div className="space-y-2 max-h-64 overflow-y-auto">
    {gcTasks.map((task) => (
     <div key={task.uniqueId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100">
      <div className="flex-1 min-w-0">
       <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{task.hostName || 'No Host'}</p>
        {task.company && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{task.company}</span>}
       </div>
       <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
        <span>{formatDate(task.date)}</span>
        <span className="font-semibold text-blue-600">{task.contactsEntered}/{task.confirmedPax} contacts ({task.percentDone}%)</span>
        {task.gcStatus === 'No Contacts Requested' && <span className="text-amber-600 font-semibold">Awaiting Admin Approval</span>}
       </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
       <button
        onClick={() => navigate('/guest-contacts')}
        className="text-xs font-semibold text-white bg-[#af4408] px-3 py-1.5 rounded-lg hover:bg-[#963a07] transition-colors"
       >
        Enter Contacts
       </button>
       {task.gcStatus !== 'No Contacts Requested' && (
        <button
         onClick={() => setNoContactParty(task)}
         className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
        >
         No Contacts
        </button>
       )}
      </div>
     </div>
    ))}
   </div>

   {/* No Contacts Reason Modal */}
   {noContactParty && (
    <div className="mt-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
     <p className="text-xs font-semibold text-amber-800 mb-2">
      No contacts for: {noContactParty.hostName} ({formatDate(noContactParty.date)})
     </p>
     <p className="text-[10px] text-amber-600 mb-2">Enter reason — this will be sent to Admin for approval</p>
     <div className="flex gap-2">
      <input
       type="text"
       value={noContactReason}
       onChange={(e) => setNoContactReason(e.target.value)}
       placeholder="e.g., Guest refused to share, Walk-in party..."
       className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
      />
      <button
       onClick={handleNoContactRequest}
       disabled={gcLoading || !noContactReason.trim()}
       className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
       Send Request
      </button>
      <button
       onClick={() => { setNoContactParty(null); setNoContactReason(''); }}
       className="px-2 py-2 rounded-lg text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
      >
       Cancel
      </button>
     </div>
    </div>
   )}
  </div>
 )}

 {/* Admin: "No Contacts" Approval Requests */}
 {isAdmin && gcAdminRequests.length > 0 && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
   <div className="flex items-center gap-2 mb-3">
    <AlertCircle className="w-4 h-4 text-amber-600" />
    <h3 className="text-sm font-semibold text-amber-800">No Contacts Requests ({gcAdminRequests.length})</h3>
    <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">Needs Approval</span>
   </div>
   <div className="space-y-2">
    {gcAdminRequests.map((req) => (
     <div key={req.uniqueId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100">
      <div>
       <p className="text-sm font-medium text-gray-900">{req.hostName || 'No Host'} {req.company ? `(${req.company})` : ''}</p>
       <p className="text-xs text-gray-500 mt-0.5">{formatDate(req.date)} | {req.remarks || 'No reason provided'}</p>
      </div>
      <button
       onClick={() => handleApproveNoContacts(req.rowIndex)}
       disabled={gcLoading}
       className="text-xs font-semibold text-white bg-green-600 px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
       Approve
      </button>
     </div>
    ))}
   </div>
  </div>
 )}

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
