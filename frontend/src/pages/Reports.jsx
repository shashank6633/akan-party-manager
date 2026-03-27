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
} from 'lucide-react';
import {
 BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 PieChart, Pie, Cell, Legend,
 LineChart, Line,
} from 'recharts';
import { reportAPI, partyAPI } from '../services/api';
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

const TABS = [
 { id: 'overview', label: 'Overview', icon: BarChart3 },
 { id: 'financial', label: 'Financial', icon: TrendingUp },
 { id: 'status', label: 'Status Analysis', icon: PieIcon },
];

export default function Reports() {
 const { user } = useAuth();
 const [activeTab, setActiveTab] = useState('overview');
 const [dateFrom, setDateFrom] = useState(() => {
 return `${new Date().getFullYear()}-01-01`;
 });
 const [dateTo, setDateTo] = useState(() => {
 return `${new Date().getFullYear()}-12-31`;
 });
 const [reportData, setReportData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [sendingReport, setSendingReport] = useState(false);
 const [allParties, setAllParties] = useState([]);

 useEffect(() => {
 fetchReport();
 }, [dateFrom, dateTo]);

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
 if (!dailyRevenue[date]) dailyRevenue[date] = { date, revenue: 0, count: 0 };
 dailyRevenue[date].revenue += parseFloat(p.finalTotalAmount) || 0;
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
 {TABS.map((tab) => (
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
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
 <StatCard label="Total Parties" value={reportData?.total || 0} />
 <StatCard label="Confirmed" value={reportData?.confirmed || 0} color="text-green-600" />
 <StatCard label="Total Revenue" value={formatCurrency(reportData?.totalRevenue || 0)} color="text-[#af4408]" />
 <StatCard label="Pending Dues" value={formatCurrency(reportData?.pendingDues || 0)} color="text-orange-500" />
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
 </div>
 )}

 {/* Financial Tab */}
 {activeTab === 'financial' && (
 <div className="space-y-6">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
 <StatCard label="Total Revenue" value={formatCurrency(reportData?.totalRevenue || 0)} color="text-[#af4408]" />
 <StatCard label="Advance Collected" value={formatCurrency(reportData?.totalAdvance || 0)} color="text-green-600" />
 <StatCard label="Amount Paid" value={formatCurrency(reportData?.amountPaid || 0)} color="text-blue-600" />
 <StatCard label="Pending Dues" value={formatCurrency(reportData?.pendingDues || 0)} color="text-orange-500" />
 </div>

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
 <Line type="monotone" dataKey="revenue" stroke="#af4408" strokeWidth={2} dot={{ fill: '#af4408', r: 3 }} activeDot={{ r: 5 }} />
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <p className="text-center text-gray-400 py-10">No revenue data for selected range</p>
 )}
 </div>
 </div>
 )}

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
  { label: 'Collection Rate', value: reportData?.totalRevenue ? `${(((reportData.totalAdvance || 0) / reportData.totalRevenue) * 100).toFixed(1)}%` : '0%', desc: 'Advance Collected / Total Revenue' },
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
 </>
 )}
 </div>
 );
}
