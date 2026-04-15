import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { partyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isTBCDate } from '../utils/helpers';

const STATUS_COLORS = {
  Confirmed: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500' },
  Tentative: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  Contacted: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
  Enquiry: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' },
  Cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-500' },
};

const STATUS_ORDER = { Confirmed: 0, Tentative: 1, Contacted: 2, Enquiry: 3, Cancelled: 4 };
const sortByStatus = (a, b) => (STATUS_ORDER[(a.status || '').trim()] ?? 99) - (STATUS_ORDER[(b.status || '').trim()] ?? 99);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isViewOnly = user?.role === 'GRE' || user?.role === 'CASHIER' || user?.role === 'ACCOUNTS';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const startDay = monthStart.getDay(); // 0=Sun
  const totalDays = monthEnd.getDate();

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Fetch parties for this month. On first load show the full spinner; on
  // subsequent month changes keep the old grid visible and just show a subtle
  // "refreshing" indicator so paging feels instant.
  const fetchParties = useCallback(async () => {
    setParties((prev) => {
      if (prev.length === 0) setLoading(true);
      else setRefreshing(true);
      return prev;
    });
    try {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
      const res = await partyAPI.getAll({ dateFrom: from, dateTo: to, limit: 500 });
      setParties(res.data.parties || []);
    } catch (err) {
      console.error('Failed to fetch calendar parties:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month, totalDays]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  // Auto-refresh every 60s so newly added/edited parties from other users
  // appear without manual interaction. Pauses when the tab is hidden to
  // avoid wasted Sheets reads, and refreshes once on return.
  useEffect(() => {
    const INTERVAL_MS = 60000;
    let timer = null;

    const start = () => {
      stop();
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') fetchParties();
      }, INTERVAL_MS);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchParties();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchParties]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Group parties by day, sorted by status: Confirmed → Tentative → Contacted → Enquiry → Cancelled
  const partyMap = {};
  parties.forEach((p) => {
    const date = p.date;
    if (!date || isTBCDate(date)) return;
    const day = parseInt(date.split('-')[2], 10);
    if (!partyMap[day]) partyMap[day] = [];
    partyMap[day].push(p);
  });
  Object.values(partyMap).forEach((arr) => arr.sort(sortByStatus));

  // Build calendar grid cells
  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: null });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, parties: partyMap[d] || [] });
  }
  // Fill remaining cells to complete last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null });
  }

  const today = new Date();
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Count summary
  const confirmed = parties.filter((p) => (p.status || '').trim() === 'Confirmed').length;
  const tentative = parties.filter((p) => (p.status || '').trim() === 'Tentative').length;
  const enquiry = parties.filter((p) => (p.status || '').trim() === 'Enquiry').length;
  const contacted = parties.filter((p) => (p.status || '').trim() === 'Contacted').length;
  const cancelled = parties.filter((p) => (p.status || '').trim() === 'Cancelled').length;

  const selectedParties = selectedDay ? ([...(partyMap[selectedDay] || [])].sort(sortByStatus)) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 min-w-[180px] text-center flex items-center justify-center gap-2">
            {monthLabel}
            {refreshing && <Loader2 className="w-4 h-4 animate-spin text-[#af4408]" />}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={goToday} className="ml-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#af4408] text-white hover:bg-[#963a07] transition-colors">
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500"></span> Confirmed ({confirmed})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Tentative ({tentative})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Contacted ({contacted})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Enquiry ({enquiry})</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span> Cancelled ({cancelled})</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {DAY_NAMES.map((d, i) => (
                <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-gray-600 border-r border-gray-100 last:border-r-0">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{DAY_SHORT[i]}</span>
                </div>
              ))}
            </div>

            {/* Calendar rows */}
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => (
                <div
                  key={idx}
                  onClick={() => cell.day && cell.parties.length > 0 && setSelectedDay(selectedDay === cell.day ? null : cell.day)}
                  className={`min-h-[90px] sm:min-h-[120px] border-r border-b border-gray-100 last:border-r-0 p-1 sm:p-2 transition-colors ${
                    cell.day ? 'bg-white hover:bg-gray-50 cursor-pointer' : 'bg-gray-50/50'
                  } ${isToday(cell.day) ? 'bg-orange-50/50' : ''} ${selectedDay === cell.day ? 'ring-2 ring-[#af4408] ring-inset' : ''}`}
                >
                  {cell.day && (
                    <>
                      <div className={`text-xs sm:text-sm font-medium mb-1 ${isToday(cell.day) ? 'text-white bg-[#af4408] w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center' : 'text-gray-700'}`}>
                        {cell.day}
                      </div>
                      <div className="space-y-0.5 sm:space-y-1 max-h-[200px] overflow-y-auto">
                        {cell.parties.map((p, pi) => {
                          const status = (p.status || '').trim();
                          const colors = STATUS_COLORS[status] || STATUS_COLORS.Enquiry;
                          return (
                            <div
                              key={pi}
                              onClick={(e) => { e.stopPropagation(); if (!isViewOnly) navigate(`/parties/${p.rowIndex}`, { state: { from: 'calendar' } }); }}
                              className={`${colors.bg} ${colors.text} ${colors.border} border rounded px-1 py-0.5 text-[9px] sm:text-[11px] font-medium truncate ${isViewOnly ? '' : 'cursor-pointer hover:opacity-80'} transition-opacity`}
                              title={`${p.hostName} - ${status}`}
                            >
                              <span className="hidden sm:inline">{p.hostName}</span>
                              <span className="sm:hidden">{p.hostName?.substring(0, 8)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Selected day detail panel */}
          {selectedDay && selectedParties.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">
                  {selectedDay} {currentDate.toLocaleString('default', { month: 'long' })} {year} — {selectedParties.length} {selectedParties.length === 1 ? 'Party' : 'Parties'}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-500 hover:text-gray-700">Close</button>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectedParties.map((p, i) => {
                  const status = (p.status || '').trim();
                  const colors = STATUS_COLORS[status] || STATUS_COLORS.Enquiry;
                  return (
                    <div
                      key={i}
                      onClick={() => !isViewOnly && navigate(`/parties/${p.rowIndex}`, { state: { from: 'calendar' } })}
                      className={`flex items-center justify-between p-3 rounded-lg border ${colors.border} ${colors.bg} ${isViewOnly ? '' : 'cursor-pointer hover:opacity-90'} transition-opacity`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${colors.text}`}>{p.hostName}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          {p.phoneNumber && <span className="text-[11px] text-gray-600">{p.phoneNumber}</span>}
                          {p.company && <span className="text-[11px] text-gray-600">{p.company}</span>}
                          {p.occasionType && <span className="text-[11px] text-gray-600">{p.occasionType}</span>}
                          {p.partyTime && <span className="text-[11px] text-gray-600">{p.partyTime}</span>}
                          {p.expectedPax && <span className="text-[11px] text-gray-600">Pax: {p.expectedPax}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 ml-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                          {status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
