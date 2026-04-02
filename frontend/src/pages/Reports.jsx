import { useState, useEffect } from 'react';
import {
 Calendar,
 Download,
 Send,
 Loader2,
 BarChart3,
 TrendingUp,
 PieChart as PieIcon,
 FileSpreadsheet,
 FileText,
 Star,
 MessageSquare,
 ThumbsUp,
 ThumbsDown,
 AlertTriangle,
 PhoneCall,
 ChefHat,
} from 'lucide-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 PieChart, Pie, Cell, Legend,
 LineChart, Line,
} from 'recharts';
import { reportAPI, partyAPI, feedbackAPI } from '../services/api';
import { formatCurrency, exportToExcel } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
 Enquiry: '#EAB308',
 Contacted: '#A855F7',
 Tentative: '#3B82F6',
 Confirmed: '#22C55E',
 Cancelled: '#EF4444',
 Unknown: '#6B7280',
};

const ALL_TABS = [
 { id: 'overview', label: 'Overview', icon: BarChart3 },
 { id: 'financial', label: 'Financial', icon: TrendingUp, revenueOnly: true },
 { id: 'status', label: 'Status Analysis', icon: PieIcon },
 { id: 'feedback', label: 'Feedback', icon: Star },
];

const RATING_COLORS = { 5: '#22C55E', 4: '#84CC16', 3: '#EAB308', 2: '#F97316', 1: '#EF4444' };
const RATING_LABELS = { 5: 'Excellent', 4: 'Good', 3: 'Average', 2: 'Poor', 1: 'Very Poor' };

export default function Reports() {
 const { user } = useAuth();
 const canSeeRevenue = user?.role === 'ADMIN';
 const [activeTab, setActiveTab] = useState('overview');
 const [dateFrom, setDateFrom] = useState(() => {
 const now = new Date();
 return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
 });
 const [dateTo, setDateTo] = useState(() => {
 const now = new Date();
 const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
 return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
 });
 const [reportData, setReportData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [sendingReport, setSendingReport] = useState(false);
 const [allParties, setAllParties] = useState([]);
 const [feedbackData, setFeedbackData] = useState([]);
 const [feedbackLoading, setFeedbackLoading] = useState(false);

 useEffect(() => {
 fetchReport();
 }, [dateFrom, dateTo]);

 useEffect(() => {
 if (activeTab === 'feedback') fetchFeedback();
 }, [activeTab]);

 const fetchReport = async () => {
 setLoading(true);
 try {
 const [rangeRes, partiesRes] = await Promise.all([
 reportAPI.getRange(dateFrom, dateTo),
 partyAPI.getAll({ dateFrom, dateTo, limit: 500 }),
 ]);
 // rangeRes.data = { success, data: { stats, parties } }
 setReportData(rangeRes.data?.data?.stats || rangeRes.data?.data || {});
 setAllParties(partiesRes.data.parties || []);
 } catch (err) {
 console.error('Failed to fetch report:', err);
 } finally {
 setLoading(false);
 }
 };

 const fetchFeedback = async () => {
 setFeedbackLoading(true);
 try {
 const res = await feedbackAPI.getAll();
 setFeedbackData(res.data.feedback || []);
 } catch (err) {
 console.error('Failed to fetch feedback:', err);
 } finally {
 setFeedbackLoading(false);
 }
 };

 const [sendingType, setSendingType] = useState('');

 const handleSendDaily = async () => {
 setSendingReport(true);
 setSendingType('daily');
 try {
 await reportAPI.sendDaily();
 alert('Daily report sent successfully!');
 } catch (err) {
 alert('Failed to send report. Check email configuration.');
 } finally {
 setSendingReport(false);
 setSendingType('');
 }
 };

 const handleSendRange = async (type) => {
 setSendingReport(true);
 setSendingType(type);
 try {
 const now = new Date();
 const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
 const today = `${y}-${m}-${d}`;
 let from, to, label;
 if (type === '2weeks') {
  from = today;
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  label = '2 Weeks Report';
 } else {
  from = `${y}-${m}-01`;
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  label = 'This Month Report';
 }
 await reportAPI.sendRange(from, to, label);
 alert(`${label} sent successfully!`);
 } catch (err) {
 alert('Failed to send report. Check email configuration.');
 } finally {
 setSendingReport(false);
 setSendingType('');
 }
 };

 const handleExportExcel = () => {
 if (allParties.length === 0) return;
 exportToExcel(allParties, `AKAN_Report_${dateFrom}_to_${dateTo}`);
 };

 // Build chart data — always show all statuses
 const statusData = reportData ? [
 { name: 'Enquiry', value: reportData.enquiries || 0 },
 { name: 'Contacted', value: reportData.contacted || 0 },
 { name: 'Tentative', value: reportData.tentative || 0 },
 { name: 'Confirmed', value: reportData.confirmed || 0 },
 { name: 'Cancelled', value: reportData.cancelled || 0 },
 { name: 'Unknown', value: reportData.unknown || 0 },
 ] : [];

 // Group parties by date for line chart
 const dailyRevenue = {};
 allParties.forEach((p) => {
 const date = p.date?.split('T')[0] || p.date;
 if (!date || date.startsWith('TBC') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
 if (!dailyRevenue[date]) dailyRevenue[date] = { date, revenue: 0, approxBill: 0, count: 0 };
 dailyRevenue[date].revenue += parseFloat(p.finalTotalAmount) || 0;
 dailyRevenue[date].approxBill += parseFloat(p.approxBillAmount) || 0;
 dailyRevenue[date].count += 1;
 });
 const revenueTimeline = Object.values(dailyRevenue).sort((a, b) => a.date.localeCompare(b.date));

 // Bar chart - parties by status per week
 const barData = statusData;

 const StatCard = ({ label, value, color = 'text-gray-900' }) => (
 <div className="bg-white rounded-xl border border-gray-200 p-4">
 <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
 <p className={`text-2xl font-bold ${color}`}>{value}</p>
 </div>
 );

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-wrap items-center justify-between gap-4">
 <div>
 <h1 className="text-xl font-bold text-gray-900">Reports</h1>
 <p className="text-sm text-gray-500">Analytics and insights for your parties</p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
 <>
 <button
 onClick={handleSendDaily}
 disabled={sendingReport}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
 >
 {sendingReport && sendingType === 'daily' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
 Daily Report
 </button>
 <button
 onClick={() => handleSendRange('2weeks')}
 disabled={sendingReport}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
 >
 {sendingReport && sendingType === '2weeks' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
 2 Weeks Report
 </button>
 <button
 onClick={() => handleSendRange('month')}
 disabled={sendingReport}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
 >
 {sendingReport && sendingType === 'month' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
 This Month Report
 </button>
 </>
 )}
 <button
 onClick={handleExportExcel}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
 >
 <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
 </button>
 </div>
 </div>

 {/* Date range picker */}
 <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-2 sm:gap-4">
 <Calendar className="w-4 h-4 text-gray-400" />
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <label className="text-xs text-gray-500 shrink-0">From:</label>
 <input
 type="date"
 value={dateFrom}
 onChange={(e) => setDateFrom(e.target.value)}
 className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 min-w-0 flex-1 sm:flex-none"
 />
 </div>
 <div className="flex items-center gap-2 w-full sm:w-auto">
 <label className="text-xs text-gray-500 shrink-0">To:</label>
 <input
 type="date"
 value={dateTo}
 onChange={(e) => setDateTo(e.target.value)}
 className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 min-w-0 flex-1 sm:flex-none"
 />
 </div>
 <div className="flex flex-wrap gap-1">
 {/* 2 Weeks */}
 <button
 onClick={() => {
  const now = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  setDateFrom(fmt(now));
  setDateTo(fmt(end));
 }}
 className="px-2 py-1.5 sm:px-3 sm:py-1.5 rounded text-[11px] sm:text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
 >
 2 Weeks
 </button>
 {/* Monthly */}
 <button
 onClick={() => {
  const now = new Date();
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  setDateFrom(fmt(now));
  setDateTo(fmt(end));
 }}
 className="px-2 py-1.5 sm:px-3 sm:py-1.5 rounded text-[11px] sm:text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
 >
 Monthly
 </button>
 {/* Last Month */}
 <button
 onClick={() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  setDateFrom(fmt(start));
  setDateTo(fmt(end));
 }}
 className="px-2 py-1.5 sm:px-3 sm:py-1.5 rounded text-[11px] sm:text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
 >
 Last Month
 </button>
 {/* This Month */}
 <button
 onClick={() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  setDateFrom(fmt(start));
  setDateTo(fmt(end));
 }}
 className="px-2 py-1.5 sm:px-3 sm:py-1.5 rounded text-[11px] sm:text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
 >
 This Month
 </button>
 {/* Next Month */}
 <button
 onClick={() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  setDateFrom(fmt(start));
  setDateTo(fmt(end));
 }}
 className="px-2 py-1.5 sm:px-3 sm:py-1.5 rounded text-[11px] sm:text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
 >
 Next Month
 </button>
 {/* This Year */}
 <button
 onClick={() => {
  const y = new Date().getFullYear();
  setDateFrom(`${y}-01-01`);
  setDateTo(`${y}-12-31`);
 }}
 className="px-2 py-1.5 sm:px-3 sm:py-1.5 rounded text-[11px] sm:text-xs bg-gray-100 text-gray-600 hover:bg-gray-200"
 >
 This Year
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit overflow-x-auto">
 {ALL_TABS.filter((tab) => !tab.revenueOnly || canSeeRevenue).map((tab) => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap flex-1 sm:flex-none justify-center sm:justify-start ${
 activeTab === tab.id
 ? 'bg-white text-[#af4408] shadow-sm'
 : 'text-gray-500 hover:text-gray-700'
 }`}
 >
 <tab.icon className="w-3.5 h-3.5" /> {tab.label}
 </button>
 ))}
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-20">
 <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
 </div>
 ) : (
 <>
 {/* Overview Tab */}
 {activeTab === 'overview' && (
 <div className="space-y-6">
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
 <StatCard label="Total Parties" value={reportData?.total || 0} />
 <StatCard label="Confirmed" value={reportData?.confirmed || 0} color="text-green-600" />
 {canSeeRevenue && <StatCard label="Approx Bill" value={formatCurrency(reportData?.totalApproxBill || 0)} color="text-purple-600" />}
 {canSeeRevenue && <StatCard label="Final Bill" value={formatCurrency(reportData?.totalRevenue || 0)} color="text-[#af4408]" />}
 {canSeeRevenue && <StatCard label="Pending Dues" value={formatCurrency(reportData?.pendingDues || 0)} color="text-orange-500" />}
 </div>

 {/* Bar Chart */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Parties by Status</h3>
 {statusData.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={statusData}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis dataKey="name" tick={{ fontSize: 12 }} />
 <YAxis tick={{ fontSize: 12 }} />
 <Tooltip />
 <Bar dataKey="value" radius={[6, 6, 0, 0]}>
 {statusData.map((entry) => (
 <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-center text-gray-400 py-10">No data for selected range</p>
 )}
 </div>

 {/* Revenue Timeline with Approx & Final */}
 {canSeeRevenue && (
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Approx Bill vs Final Bill Timeline</h3>
 {revenueTimeline.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={revenueTimeline} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} tickFormatter={(d) => { const p = d.split('-'); return `${p[2]}/${p[1]}`; }} interval={Math.max(0, Math.floor(revenueTimeline.length / 12))} />
 <YAxis tick={{ fontSize: 10 }} width={55} tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`} />
 <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(d) => { const p = d.split('-'); return `${p[2]}-${p[1]}-${p[0]}`; }} />
 <Legend />
 <Bar dataKey="approxBill" name="Approx Bill" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
 <Bar dataKey="revenue" name="Final Bill" fill="#af4408" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-center text-gray-400 py-10">No revenue data for selected range</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* Financial Tab */}
 {activeTab === 'financial' && (() => {
 // Compute completed parties: confirmed + event date <= today
 const todayStr = new Date().toISOString().split('T')[0];
 const completedParties = allParties.filter((p) => {
  if (p.status !== 'Confirmed') return false;
  const d = p.date?.split('T')[0] || p.date;
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= todayStr;
 });
 const completedApprox = completedParties.reduce((s, p) => s + (parseFloat(p.approxBillAmount) || 0), 0);
 const completedFinal = completedParties.reduce((s, p) => s + (parseFloat(p.finalTotalAmount) || 0), 0);
 const varDiff = completedFinal - completedApprox;
 const varPct = completedApprox ? ((varDiff / completedApprox) * 100).toFixed(1) : null;

 return (
 <div className="space-y-6">
 {/* Row 1: Key financial cards */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
 <StatCard label="Approx Bill (Est.)" value={formatCurrency(reportData?.totalApproxBill || 0)} color="text-purple-600" />
 <StatCard label="Final Bill (Actual)" value={formatCurrency(reportData?.totalRevenue || 0)} color="text-[#af4408]" />
 <StatCard label="Advance Collected" value={formatCurrency(reportData?.totalAdvance || 0)} color="text-green-600" />
 <StatCard label="Amount Paid" value={formatCurrency(reportData?.amountPaid || 0)} color="text-blue-600" />
 <StatCard label="Pending Dues" value={formatCurrency(reportData?.pendingDues || 0)} color="text-orange-500" />
 <StatCard
  label="Variance (Completed)"
  value={varPct !== null ? `${varDiff >= 0 ? '+' : ''}${varPct}%` : '-'}
  color={completedFinal >= completedApprox ? 'text-green-600' : 'text-red-500'}
 />
 </div>

 {/* Row 2: Approx vs Final Comparison (Confirmed only) */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-1">Approx Bill vs Final Bill (Completed Parties)</h3>
 <p className="text-xs text-gray-400 mb-4">Comparing estimated billing vs actual billing for completed events only</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Visual comparison bars */}
  <div className="space-y-4">
  {(() => {
   const approx = completedApprox;
   const actual = completedFinal;
   const max = Math.max(approx, actual, 1);
   return (
   <>
    <div>
    <div className="flex items-center justify-between mb-1">
     <span className="text-xs font-medium text-purple-700">Approx Bill Amount</span>
     <span className="text-sm font-bold text-purple-700">{formatCurrency(approx)}</span>
    </div>
    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
     <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${(approx / max) * 100}%` }} />
    </div>
    </div>
    <div>
    <div className="flex items-center justify-between mb-1">
     <span className="text-xs font-medium text-[#af4408]">Final Bill Amount</span>
     <span className="text-sm font-bold text-[#af4408]">{formatCurrency(actual)}</span>
    </div>
    <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
     <div className="h-full bg-[#af4408] rounded-full transition-all" style={{ width: `${(actual / max) * 100}%` }} />
    </div>
    </div>
    <div className="pt-2 border-t border-gray-100">
    <div className="flex items-center justify-between">
     <span className="text-xs text-gray-500">Difference</span>
     <span className={`text-sm font-bold ${actual >= approx ? 'text-green-600' : 'text-red-500'}`}>
     {actual >= approx ? '+' : ''}{formatCurrency(actual - approx)}
     </span>
    </div>
    </div>
   </>
   );
  })()}
  </div>

  {/* Bar chart per date: Approx vs Final */}
  <div>
  {(() => {
   const compData = [];
   const dateMap = {};
   completedParties.forEach((p) => {
   const date = p.date?.split('T')[0] || p.date;
   if (!date || date.startsWith('TBC') || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
   if (!dateMap[date]) dateMap[date] = { date, approx: 0, final: 0 };
   dateMap[date].approx += parseFloat(p.approxBillAmount) || 0;
   dateMap[date].final += parseFloat(p.finalTotalAmount) || 0;
   });
   const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
   if (chartData.length === 0) return <p className="text-center text-gray-400 py-10 text-sm">No confirmed party data</p>;
   return (
   <ResponsiveContainer width="100%" height={200}>
    <BarChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} tickFormatter={(d) => { const p = d.split('-'); return `${p[2]}/${p[1]}`; }} />
    <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
    <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(d) => { const p = d.split('-'); return `${p[2]}-${p[1]}-${p[0]}`; }} />
    <Legend />
    <Bar dataKey="approx" name="Approx Bill" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
    <Bar dataKey="final" name="Final Bill" fill="#af4408" radius={[4, 4, 0, 0]} />
    </BarChart>
   </ResponsiveContainer>
   );
  })()}
  </div>
 </div>
 </div>

 {/* Row 3: Revenue Timeline (dual line) */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue Timeline</h3>
 {revenueTimeline.length > 0 ? (
 <ResponsiveContainer width="100%" height={350}>
 <LineChart data={revenueTimeline} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
 <XAxis
  dataKey="date"
  tick={{ fontSize: 9 }}
  angle={-45}
  textAnchor="end"
  height={60}
  tickFormatter={(d) => { const parts = d.split('-'); return `${parts[2]}/${parts[1]}`; }}
  interval={Math.max(0, Math.floor(revenueTimeline.length / 10))}
 />
 <YAxis
  tick={{ fontSize: 11 }}
  width={55}
  tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`}
 />
 <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(d) => { const parts = d.split('-'); return `${parts[2]}-${parts[1]}-${parts[0]}`; }} />
 <Legend />
 <Line type="monotone" dataKey="approxBill" name="Approx Bill" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 2 }} strokeDasharray="5 5" />
 <Line type="monotone" dataKey="revenue" name="Final Bill" stroke="#af4408" strokeWidth={2} dot={{ fill: '#af4408', r: 3 }} activeDot={{ r: 5 }} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-center text-gray-400 py-10">No revenue data for selected range</p>
 )}
 </div>
 </div>
 );
 })()}

 {/* Status Analysis Tab */}
 {activeTab === 'status' && (
 <div className="space-y-6">
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
 <StatCard label="Total Enquiries" value={reportData?.total || 0} color="text-gray-900" />
 <StatCard label="Enquiry" value={reportData?.enquiries || 0} color="text-yellow-500" />
 <StatCard label="Contacted" value={reportData?.contacted || 0} color="text-purple-500" />
 <StatCard label="Tentative" value={reportData?.tentative || 0} color="text-blue-500" />
 <StatCard label="Confirmed" value={reportData?.confirmed || 0} color="text-green-500" />
 <StatCard label="Cancelled" value={reportData?.cancelled || 0} color="text-red-500" />
 <StatCard label="Unknown" value={reportData?.unknown || 0} color="text-gray-500" />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
 {/* Pie chart */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Status Distribution</h3>
 {statusData.length > 0 ? (
 <ResponsiveContainer width="100%" height={300}>
 <PieChart>
 <Pie
 data={statusData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={4}
 dataKey="value"
 label={({ name, percent }) => window.innerWidth < 640 ? `${(percent * 100).toFixed(0)}%` : `${name} ${(percent * 100).toFixed(0)}%`}
 >
 {statusData.map((entry) => (
 <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
 ))}
 </Pie>
 <Tooltip />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-center text-gray-400 py-10">No data</p>
 )}
 </div>

 {/* Conversion rates */}
 <div className="bg-white rounded-xl border border-gray-200 p-5">
 <h3 className="text-sm font-semibold text-gray-800 mb-4">Total Enquiries vs Status Breakdown</h3>
 <div className="space-y-3">
 {(() => {
  const total = reportData?.total || 0;
  const statuses = [
   { label: 'Enquiry', count: reportData?.enquiries || 0, color: 'bg-yellow-400' },
   { label: 'Contacted', count: reportData?.contacted || 0, color: 'bg-purple-500' },
   { label: 'Tentative', count: reportData?.tentative || 0, color: 'bg-blue-500' },
   { label: 'Confirmed', count: reportData?.confirmed || 0, color: 'bg-green-500' },
   { label: 'Cancelled', count: reportData?.cancelled || 0, color: 'bg-red-500' },
   { label: 'Unknown', count: reportData?.unknown || 0, color: 'bg-gray-400' },
  ];
  return statuses.map((s) => {
   const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : 0;
   return (
    <div key={s.label}>
     <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium text-gray-700">{s.label}</span>
      <span className="text-xs font-bold text-gray-900">{s.count} / {total} ({pct}%)</span>
     </div>
     <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
     </div>
    </div>
   );
  });
 })()}
 </div>
 <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
 {[
  { label: 'Conversion Rate', value: reportData?.total ? `${((reportData.confirmed / reportData.total) * 100).toFixed(1)}%` : '0%', desc: 'Confirmed / Total Enquiries' },
  { label: 'Cancellation Rate', value: reportData?.total ? `${((reportData.cancelled / reportData.total) * 100).toFixed(1)}%` : '0%', desc: 'Cancelled / Total Enquiries' },
  ...(canSeeRevenue ? [{ label: 'Collection Rate', value: reportData?.totalRevenue ? `${(((reportData.totalAdvance || 0) / reportData.totalRevenue) * 100).toFixed(1)}%` : '0%', desc: 'Advance Collected / Total Revenue' }] : []),
 ].map((metric) => (
  <div key={metric.label} className="flex items-center justify-between py-1.5 gap-2">
   <div className="min-w-0">
    <p className="text-sm font-medium text-gray-900 truncate">{metric.label}</p>
    <p className="text-[11px] text-gray-500 truncate">{metric.desc}</p>
   </div>
   <p className="text-lg font-bold text-[#af4408] shrink-0">{metric.value}</p>
  </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Feedback Analytics Tab */}
 {activeTab === 'feedback' && (
 <FeedbackAnalytics data={feedbackData} loading={feedbackLoading} />
 )}
 </>
 )}
 </div>
 );
}

// =============================================================================
// FEEDBACK ANALYTICS COMPONENT
// =============================================================================
function FeedbackAnalytics({ data, loading }) {
 if (loading) {
 return (
  <div className="flex items-center justify-center py-20">
  <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
  </div>
 );
 }

 if (!data || data.length === 0) {
 return (
  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
  <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
  <h3 className="text-lg font-semibold text-gray-700 mb-1">No Feedback Yet</h3>
  <p className="text-sm text-gray-500">Feedback analytics will appear here once guests submit reviews.</p>
  </div>
 );
 }

 // ---- Compute analytics ----
 const total = data.length;

 // Helper: safe parse int
 const safeInt = (v) => parseInt(v) || 0;

 // Overall rating stats
 const overallRatings = data.map((f) => safeInt(f.overallRating)).filter((r) => r > 0);
 const avgOverall = overallRatings.length > 0 ? (overallRatings.reduce((a, b) => a + b, 0) / overallRatings.length) : 0;

 // Category averages
 const categoryFields = [
 { key: 'foodQualityRating', label: 'Food Quality', icon: '🍽️' },
 { key: 'staffBehaviorRating', label: 'Staff Behavior', icon: '👤' },
 { key: 'orderAccuracyRating', label: 'Order Accuracy', icon: '✅' },
 { key: 'servingSpeedRating', label: 'Serving Speed', icon: '⚡' },
 { key: 'beveragesRating', label: 'Beverages', icon: '🍷' },
 { key: 'cleanlinessRating', label: 'Cleanliness', icon: '✨' },
 { key: 'musicRating', label: 'Music & Entertainment', icon: '🎵' },
 { key: 'seatingComfortRating', label: 'Seating Comfort', icon: '💺' },
 ];
 const categoryAvgs = categoryFields.map((cf) => {
 const vals = data.map((f) => safeInt(f[cf.key])).filter((r) => r > 0);
 const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
 return { ...cf, avg, count: vals.length };
 }).filter((c) => c.count > 0);

 // Rating distribution (1-5)
 const ratingDist = [5, 4, 3, 2, 1].map((r) => ({
 rating: r,
 label: RATING_LABELS[r],
 count: overallRatings.filter((v) => v === r).length,
 pct: overallRatings.length > 0 ? ((overallRatings.filter((v) => v === r).length / overallRatings.length) * 100) : 0,
 }));

 // Per-item dish ratings (parse JSON arrays)
 const allDishRatings = [];
 const parseItemRatings = (jsonStr) => {
 if (!jsonStr) return [];
 try {
  const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  return Array.isArray(parsed) ? parsed : [];
 } catch { return []; }
 };
 data.forEach((f) => {
 ['startersItemRatings', 'mainCourseItemRatings', 'sidesItemRatings', 'dessertItemRatings', 'addonItemRatings'].forEach((field) => {
  parseItemRatings(f[field]).forEach((item) => {
  if (item.item && safeInt(item.rating) > 0) {
   allDishRatings.push({ name: item.item, rating: safeInt(item.rating), comment: item.comment || '' });
  }
  });
 });
 });

 // Aggregate dish averages
 const dishMap = {};
 allDishRatings.forEach((d) => {
 if (!dishMap[d.name]) dishMap[d.name] = { name: d.name, total: 0, count: 0 };
 dishMap[d.name].total += d.rating;
 dishMap[d.name].count += 1;
 });
 const dishAvgs = Object.values(dishMap).map((d) => ({ ...d, avg: d.total / d.count }));
 const topDishes = [...dishAvgs].sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 8);
 const bottomDishes = [...dishAvgs].sort((a, b) => a.avg - b.avg || b.count - a.count).slice(0, 8);

 // Package performance
 const pkgMap = {};
 data.forEach((f) => {
 const pkg = f.packageType || 'Unknown';
 const r = safeInt(f.overallRating);
 if (r <= 0) return;
 if (!pkgMap[pkg]) pkgMap[pkg] = { name: pkg, total: 0, count: 0 };
 pkgMap[pkg].total += r;
 pkgMap[pkg].count += 1;
 });
 const pkgPerf = Object.values(pkgMap).map((p) => ({ ...p, avg: p.total / p.count })).sort((a, b) => b.avg - a.avg);

 // Complaints & suggestions
 const complaints = data.filter((f) => f.complaint && f.complaint.trim()).map((f) => ({
 guest: f.guestName || f.reviewerName || 'Guest',
 date: f.dateOfEvent || f.submittedAt || '',
 text: f.complaint,
 wantsCallback: f.wantsCallback === 'Yes',
 rating: safeInt(f.overallRating),
 package: f.packageType || '',
 }));
 const suggestions = data.filter((f) => f.suggestion && f.suggestion.trim()).map((f) => ({
 guest: f.guestName || f.reviewerName || 'Guest',
 date: f.dateOfEvent || f.submittedAt || '',
 text: f.suggestion,
 rating: safeInt(f.overallRating),
 }));
 const callbackNeeded = data.filter((f) => f.wantsCallback === 'Yes');

 // Stars renderer
 const StarsSmall = ({ value }) => {
 const r = Math.round(parseFloat(value) || 0);
 return (
  <div className="flex items-center gap-0.5">
  {[1, 2, 3, 4, 5].map((i) => (
   <Star key={i} className={`w-3.5 h-3.5 ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
  ))}
  </div>
 );
 };

 // Rating bar color
 const ratingBarColor = (avg) => avg >= 4 ? 'bg-green-500' : avg >= 3 ? 'bg-amber-400' : avg >= 2 ? 'bg-orange-500' : 'bg-red-500';
 const ratingTextColor = (avg) => avg >= 4 ? 'text-green-600' : avg >= 3 ? 'text-amber-600' : avg >= 2 ? 'text-orange-600' : 'text-red-600';

 return (
 <div className="space-y-6">

 {/* Row 1: Overall Score + Rating Distribution */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Overall Score Card */}
  <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center">
  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Overall Satisfaction</p>
  <div className={`text-5xl font-black ${ratingTextColor(avgOverall)}`}>
   {avgOverall.toFixed(1)}
  </div>
  <div className="flex items-center gap-0.5 mt-2">
   {[1, 2, 3, 4, 5].map((i) => (
   <Star key={i} className={`w-6 h-6 ${i <= Math.round(avgOverall) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
   ))}
  </div>
  <p className="text-sm text-gray-500 mt-2">{total} review{total !== 1 ? 's' : ''}</p>
  <p className={`text-sm font-semibold mt-1 ${ratingTextColor(avgOverall)}`}>
   {avgOverall >= 4.5 ? 'Outstanding' : avgOverall >= 4 ? 'Very Good' : avgOverall >= 3 ? 'Average' : avgOverall >= 2 ? 'Needs Improvement' : avgOverall > 0 ? 'Poor' : '-'}
  </p>
  </div>

  {/* Rating Distribution */}
  <div className="bg-white rounded-xl border border-gray-200 p-5 md:col-span-2">
  <h3 className="text-sm font-semibold text-gray-800 mb-4">Rating Distribution</h3>
  <div className="space-y-2.5">
   {ratingDist.map((rd) => (
   <div key={rd.rating} className="flex items-center gap-3">
    <div className="flex items-center gap-1 w-20 shrink-0">
    <span className="text-sm font-semibold text-gray-700">{rd.rating}</span>
    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
    <span className="text-[10px] text-gray-400">{rd.label}</span>
    </div>
    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
    <div
     className="h-full rounded-full transition-all"
     style={{ width: `${rd.pct}%`, backgroundColor: RATING_COLORS[rd.rating] }}
    />
    </div>
    <span className="text-xs font-semibold text-gray-600 w-16 text-right">{rd.count} ({rd.pct.toFixed(0)}%)</span>
   </div>
   ))}
  </div>
  </div>
 </div>

 {/* Row 2: Category Breakdown */}
 {categoryAvgs.length > 0 && (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
  <h3 className="text-sm font-semibold text-gray-800 mb-4">Category Ratings</h3>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
   {categoryAvgs.map((cat) => (
   <div key={cat.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
    <span className="text-xl">{cat.icon}</span>
    <div className="flex-1 min-w-0">
    <p className="text-xs font-medium text-gray-700 truncate">{cat.label}</p>
    <div className="flex items-center gap-2 mt-1">
     <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
     <div className={`h-full rounded-full ${ratingBarColor(cat.avg)}`} style={{ width: `${(cat.avg / 5) * 100}%` }} />
     </div>
     <span className={`text-sm font-bold ${ratingTextColor(cat.avg)}`}>{cat.avg.toFixed(1)}</span>
    </div>
    <p className="text-[10px] text-gray-400 mt-0.5">{cat.count} reviews</p>
    </div>
   </div>
   ))}
  </div>
  </div>
 )}

 {/* Row 3: Top Dishes + Bottom Dishes */}
 {dishAvgs.length > 0 && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Top Rated */}
  <div className="bg-white rounded-xl border border-gray-200 p-5">
   <div className="flex items-center gap-2 mb-4">
   <ThumbsUp className="w-4 h-4 text-green-600" />
   <h3 className="text-sm font-semibold text-gray-800">Top Rated Dishes</h3>
   </div>
   <div className="space-y-2">
   {topDishes.map((d, i) => (
    <div key={d.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
    <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${i < 3 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
    <p className="text-sm text-gray-800 flex-1 truncate">{d.name}</p>
    <StarsSmall value={d.avg} />
    <span className={`text-sm font-bold ${ratingTextColor(d.avg)}`}>{d.avg.toFixed(1)}</span>
    <span className="text-[10px] text-gray-400">({d.count})</span>
    </div>
   ))}
   </div>
  </div>

  {/* Bottom Rated */}
  <div className="bg-white rounded-xl border border-gray-200 p-5">
   <div className="flex items-center gap-2 mb-4">
   <ThumbsDown className="w-4 h-4 text-red-500" />
   <h3 className="text-sm font-semibold text-gray-800">Needs Improvement</h3>
   </div>
   <div className="space-y-2">
   {bottomDishes.map((d, i) => (
    <div key={d.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
    <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${i < 3 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
    <p className="text-sm text-gray-800 flex-1 truncate">{d.name}</p>
    <StarsSmall value={d.avg} />
    <span className={`text-sm font-bold ${ratingTextColor(d.avg)}`}>{d.avg.toFixed(1)}</span>
    <span className="text-[10px] text-gray-400">({d.count})</span>
    </div>
   ))}
   </div>
  </div>
  </div>
 )}

 {/* Row 4: Package Performance */}
 {pkgPerf.length > 0 && (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
  <div className="flex items-center gap-2 mb-4">
   <ChefHat className="w-4 h-4 text-[#af4408]" />
   <h3 className="text-sm font-semibold text-gray-800">Package Performance</h3>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
   {pkgPerf.map((pkg) => (
   <div key={pkg.name} className="p-4 rounded-lg border border-gray-100 bg-gray-50">
    <p className="text-sm font-semibold text-gray-800 truncate">{pkg.name}</p>
    <div className="flex items-center gap-2 mt-2">
    <span className={`text-2xl font-black ${ratingTextColor(pkg.avg)}`}>{pkg.avg.toFixed(1)}</span>
    <div className="flex items-center gap-0.5">
     {[1, 2, 3, 4, 5].map((i) => (
     <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(pkg.avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
     ))}
    </div>
    </div>
    <p className="text-[10px] text-gray-400 mt-1">{pkg.count} review{pkg.count !== 1 ? 's' : ''}</p>
   </div>
   ))}
  </div>
  </div>
 )}

 {/* Row 5: Complaints & Callback Needed */}
 {(complaints.length > 0 || callbackNeeded.length > 0) && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Complaints */}
  {complaints.length > 0 && (
   <div className="bg-white rounded-xl border border-red-200 p-5">
   <div className="flex items-center gap-2 mb-4">
    <AlertTriangle className="w-4 h-4 text-red-500" />
    <h3 className="text-sm font-semibold text-red-800">Complaints ({complaints.length})</h3>
   </div>
   <div className="space-y-3 max-h-[400px] overflow-y-auto">
    {complaints.map((c, i) => (
    <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-100">
     <div className="flex items-center justify-between gap-2 mb-1">
     <p className="text-xs font-semibold text-gray-800">{c.guest}</p>
     <div className="flex items-center gap-2">
      {c.wantsCallback && (
      <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
       <PhoneCall className="w-3 h-3" /> Callback
      </span>
      )}
      <StarsSmall value={c.rating} />
     </div>
     </div>
     <p className="text-sm text-gray-700">{c.text}</p>
     {c.package && <p className="text-[10px] text-gray-400 mt-1">Package: {c.package}</p>}
    </div>
    ))}
   </div>
   </div>
  )}

  {/* Suggestions */}
  {suggestions.length > 0 && (
   <div className="bg-white rounded-xl border border-blue-200 p-5">
   <div className="flex items-center gap-2 mb-4">
    <MessageSquare className="w-4 h-4 text-blue-500" />
    <h3 className="text-sm font-semibold text-blue-800">Suggestions ({suggestions.length})</h3>
   </div>
   <div className="space-y-3 max-h-[400px] overflow-y-auto">
    {suggestions.map((s, i) => (
    <div key={i} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
     <div className="flex items-center justify-between gap-2 mb-1">
     <p className="text-xs font-semibold text-gray-800">{s.guest}</p>
     <StarsSmall value={s.rating} />
     </div>
     <p className="text-sm text-gray-700">{s.text}</p>
    </div>
    ))}
   </div>
   </div>
  )}
  </div>
 )}

 {/* Callback Needed Alert */}
 {callbackNeeded.length > 0 && (
  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
  <div className="flex items-center gap-2 mb-3">
   <PhoneCall className="w-4 h-4 text-orange-600" />
   <h3 className="text-sm font-semibold text-orange-800">Callback Requested ({callbackNeeded.length})</h3>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
   {callbackNeeded.map((f, i) => (
   <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-100">
    <div className="min-w-0 flex-1">
    <p className="text-sm font-medium text-gray-800 truncate">{f.guestName || f.reviewerName || 'Guest'}</p>
    <p className="text-[10px] text-gray-500">{f.phone || ''} {f.dateOfEvent ? `• ${f.dateOfEvent}` : ''}</p>
    </div>
    <StarsSmall value={safeInt(f.overallRating)} />
   </div>
   ))}
  </div>
  </div>
 )}

 </div>
 );
}
