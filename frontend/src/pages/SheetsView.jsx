import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Search, ChevronLeft, ChevronRight, Calendar, SlidersHorizontal, X } from 'lucide-react';
import { partyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SHEET_COLUMNS = [
  { key: 'uniqueId', label: 'Unique ID', width: 130 },
  { key: 'date', label: 'Date', width: 110 },
  { key: 'day', label: 'Day', width: 70 },
  { key: 'hostName', label: 'Host Name', width: 160, frozen: true },
  { key: 'phoneNumber', label: 'Phone', width: 120 },
  { key: 'company', label: 'Company', width: 150 },
  { key: 'place', label: 'Place', width: 130 },
  { key: 'handledBy', label: 'Handled By', width: 140 },
  // Pax + Status pulled up here so planners can scan load & status without scrolling
  { key: 'expectedPax', label: 'Exp. Pax', width: 80 },
  { key: 'status', label: 'Status', width: 100 },
  { key: 'occasionType', label: 'Occasion', width: 110 },
  { key: 'partyTime', label: 'Party Time', width: 130 },
  { key: 'packageSelected', label: 'Package', width: 130 },
  { key: 'specialRequirements', label: 'Special Req.', width: 180 },
  { key: 'guestVisited', label: 'Visited', width: 80 },
  { key: 'lostReason', label: 'Lost Reason', width: 150 },
  { key: 'cancelledDate', label: 'Cancelled Date', width: 120 },
  { key: 'approxBillAmount', label: 'Approx Bill', width: 110 },
  { key: 'confirmedFinalRate', label: 'Confirmed Final Rate', width: 140 },
  { key: 'confirmedPax', label: 'Conf. Pax', width: 90 },
  { key: 'finalRate', label: 'Final Rate', width: 100 },
  { key: 'finalTotalAmount', label: 'Final Total', width: 110 },
  { key: 'totalAdvancePaid', label: 'Advance Paid', width: 110 },
  { key: 'totalPaid', label: 'Total Paid', width: 100 },
  { key: 'totalAmountPaid', label: 'Amount Paid', width: 110 },
  { key: 'dueAmount', label: 'Due Amount', width: 100 },
  { key: 'paymentStatus', label: 'Pay Status', width: 100 },
  { key: 'followUpNotes', label: 'Follow Up Notes', width: 200 },
  { key: 'lastFollowUpDate', label: 'Last Follow Up', width: 120 },
  { key: 'enquiredAt', label: 'Enquired At', width: 150 },
  { key: 'fpIssued', label: 'FP Issued', width: 80 },
  { key: 'remarks', label: 'Remarks', width: 180 },
  { key: 'altContact', label: 'Alt Contact', width: 140 },
  { key: 'guestEmail', label: 'Guest Email', width: 180 },
  { key: 'balancePaymentDate', label: 'Bal. Pay Date', width: 120 },
  { key: 'billOrderId', label: 'Bill Order ID', width: 120 },
  { key: 'createdBy', label: 'Created By', width: 140 },
];

const STATUS_COLORS = {
  Enquiry: 'bg-purple-100 text-purple-800',
  Contacted: 'bg-blue-100 text-blue-800',
  Tentative: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  'Ala Carte': 'bg-teal-100 text-teal-800',
};

const PAGE_SIZE = 100;

// Dropdown filters — keys match the server's query params (routes/parties.js EXACT_FILTERS)
const DROPDOWN_FILTERS = [
  { key: 'handledBy', label: 'Handled By' },
  { key: 'place', label: 'Place' },
  { key: 'occasionType', label: 'Occasion' },
  { key: 'enquirySource', label: 'Reference' },
  { key: 'paymentStatus', label: 'Pay Status' },
  { key: 'packageSelected', label: 'Package' },
  { key: 'fpIssued', label: 'FP Issued' },
];
const EMPTY_FILTERS = Object.fromEntries(DROPDOWN_FILTERS.map((f) => [f.key, '']));

export default function SheetsView() {
  const { user } = useAuth();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const tableRef = useRef(null);
  const reqSeq = useRef(0); // only the latest request may update the table

  // More filters (panel)
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pendingDues, setPendingDues] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' }); // custom date range; overrides month
  const [filterOptions, setFilterOptions] = useState(null);
  const [optionsError, setOptionsError] = useState(false);
  const [blankToken, setBlankToken] = useState('__blank__');
  // Date inputs emit partial years while typing (e.g. "0002-10-15") — ignore until valid
  const validDate = (d) => /^(19|20)\d{2}-\d{2}-\d{2}$/.test(d);
  const rangeFrom = validDate(range.from) ? range.from : '';
  const rangeTo = validDate(range.to) ? range.to : '';
  const customRange = !!(rangeFrom || rangeTo);
  const activeCount = Object.values(filters).filter(Boolean).length + (pendingDues ? 1 : 0) + (customRange ? 1 : 0);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPendingDues(false);
    setRange({ from: '', to: '' });
    setPage(1);
  };

  useEffect(() => {
    if (!showFilters || filterOptions || optionsError) return;
    partyAPI.getFilterOptions()
      .then((res) => { setFilterOptions(res.data.options || {}); if (res.data.blank) setBlankToken(res.data.blank); })
      .catch(() => setOptionsError(true));
  }, [showFilters, filterOptions, optionsError]);

  // Month filter: null = all, or { year, month (0-indexed) } — default to This Month
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const getMonthRange = (year, month) => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last = new Date(year, month + 1, 0);
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
    return { from, to };
  };

  const monthLabel = monthFilter
    ? new Date(monthFilter.year, monthFilter.month).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    : 'All Time';

  const shiftMonth = (dir) => {
    setPage(1);
    if (!monthFilter) {
      const now = new Date();
      setMonthFilter({ year: now.getFullYear(), month: now.getMonth() });
      return;
    }
    let { year, month } = monthFilter;
    month += dir;
    if (month > 11) { month = 0; year++; }
    if (month < 0) { month = 11; year--; }
    setMonthFilter({ year, month });
  };

  const fetchData = async () => {
    const my = ++reqSeq.current;
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE, sort: 'date', order: 'asc' };
      if (debouncedSearch) { params.search = debouncedSearch; params.searchAll = 'true'; }
      if (statusFilter !== 'All') params.status = statusFilter;
      if (customRange) {
        if (rangeFrom) params.dateFrom = rangeFrom;
        if (rangeTo) params.dateTo = rangeTo;
      } else if (monthFilter) {
        const { from, to } = getMonthRange(monthFilter.year, monthFilter.month);
        params.dateFrom = from;
        params.dateTo = to;
      }
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      if (pendingDues) params.pendingDues = 'true';
      const res = await partyAPI.getAll(params);
      if (my !== reqSeq.current) return; // a newer request superseded this one
      const data = res.data?.data || res.data || [];
      setParties(Array.isArray(data) ? data : data.parties || []);
      setTotalCount(data.total || data.length || 0);
    } catch (err) {
      if (my === reqSeq.current) console.error('Failed to fetch parties:', err);
    } finally {
      if (my === reqSeq.current) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter, monthFilter, filters, pendingDues, rangeFrom, rangeTo, debouncedSearch]);

  // Debounce typing; the main effect above does the fetch
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // Row number width
  const ROW_NUM_WIDTH = 48;
  // Frozen columns: row # + Unique ID + Date + Day + Host Name
  const FROZEN_COLS = SHEET_COLUMNS.slice(0, 4);
  const SCROLL_COLS = SHEET_COLUMNS.slice(4);
  const frozenWidth = FROZEN_COLS.reduce((sum, c) => sum + c.width, 0);

  const getCellValue = (party, key) => {
    const val = party[key];
    if (val === null || val === undefined || val === '') return '';
    return String(val);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0 flex-wrap">
        <h1 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 bg-green-600 rounded text-white text-[10px] flex items-center justify-center font-bold">S</span>
          Party Bookings Sheet
        </h1>
        <div className="relative flex-1 max-w-xs min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search all columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded border border-gray-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-2 py-1.5 rounded border border-gray-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          {['All', 'Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled', 'Ala Carte'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {/* More filters toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-semibold transition-colors ${
            showFilters || activeCount ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-green-600 text-white text-[10px] leading-4 text-center">{activeCount}</span>
          )}
        </button>
        {/* Custom date range replaces the month picker while set */}
        {customRange ? (
          <span className="flex items-center gap-1 px-2 py-1 rounded border border-green-300 bg-green-50 text-[11px] font-semibold text-green-700">
            <Calendar className="w-3 h-3" />
            {rangeFrom || '…'} → {rangeTo || '…'}
            <button onClick={() => { setRange({ from: '', to: '' }); setPage(1); }} title="Clear date range" className="ml-0.5 hover:text-green-900">
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (<>
        {/* Month Filter */}
        <div className="flex items-center gap-1 border border-gray-300 rounded bg-white">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-l transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={() => {
              if (monthFilter) { setMonthFilter(null); } else {
                const now = new Date();
                setMonthFilter({ year: now.getFullYear(), month: now.getMonth() });
              }
              setPage(1);
            }}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold transition-colors ${monthFilter ? 'text-green-700 bg-green-50' : 'text-gray-600'}`}
          >
            <Calendar className="w-3 h-3" />
            {monthLabel}
          </button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 hover:bg-gray-100 rounded-r transition-colors">
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
        {monthFilter && (
          <button
            onClick={() => { const now = new Date(); setMonthFilter({ year: now.getFullYear(), month: now.getMonth() }); setPage(1); }}
            className="px-2 py-1 rounded border border-green-300 bg-green-50 text-[11px] font-semibold text-green-700 hover:bg-green-100 transition-colors"
          >
            This Month
          </button>
        )}
        </>)}
        <button
          onClick={() => { setPage(1); fetchData(); }}
          className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-[11px] text-gray-500 ml-auto">
          {totalCount} records{customRange ? ' in date range' : monthFilter ? ` in ${monthLabel}` : ''}
        </span>
      </div>

      {/* More filters panel */}
      {showFilters && (
        <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {DROPDOWN_FILTERS.map((f) => {
              const opts = filterOptions?.[f.key] || [];
              const blanks = filterOptions?.[`${f.key}Blank`] || 0;
              return (
                <label key={f.key} className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{f.label}</span>
                  <select
                    value={filters[f.key]}
                    onChange={(e) => setFilter(f.key, e.target.value)}
                    disabled={!filterOptions}
                    className={`w-full px-2 py-1.5 rounded border text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500 ${
                      filters[f.key] ? 'border-green-500 text-green-800 font-semibold' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    <option value="">{filterOptions ? 'All' : optionsError ? 'Unavailable' : 'Loading…'}</option>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>{o.value} ({o.count})</option>
                    ))}
                    {blanks > 0 && <option value={blankToken}>(Blank) ({blanks})</option>}
                  </select>
                </label>
              );
            })}
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date From</span>
              <input
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPage(1); }}
                className={`w-full px-2 py-1 rounded border text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500 ${range.from ? 'border-green-500' : 'border-gray-300'}`}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date To</span>
              <input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPage(1); }}
                className={`w-full px-2 py-1 rounded border text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500 ${range.to ? 'border-green-500' : 'border-gray-300'}`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pendingDues}
                onChange={(e) => { setPendingDues(e.target.checked); setPage(1); }}
                className="w-3.5 h-3.5 accent-green-600"
              />
              Pending dues only (Due &gt; 0)
            </label>
            <span className="text-[10px] text-gray-400">Date From/To overrides the month picker · search looks in every column</span>
            {optionsError && (
              <span className="text-[11px] text-red-600">
                Couldn&apos;t load filter options.{' '}
                <button onClick={() => setOptionsError(false)} className="font-semibold underline hover:text-red-800">Retry</button>
              </span>
            )}
            {activeCount > 0 && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-[11px] font-semibold text-gray-600 hover:bg-gray-100"
              >
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Column letter bar + Sheet */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={tableRef} className="h-full overflow-auto">
          <table className="border-collapse" style={{ minWidth: ROW_NUM_WIDTH + frozenWidth + SCROLL_COLS.reduce((s, c) => s + c.width, 0) }}>
            {/* Frozen Header Row */}
            <thead>
              <tr>
                {/* Row number header */}
                <th
                  className="sticky top-0 left-0 z-30 bg-gray-100 border border-gray-300 text-[10px] text-gray-500 font-medium text-center select-none"
                  style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                />
                {/* Frozen column headers */}
                {FROZEN_COLS.map((col, i) => (
                  <th
                    key={col.key}
                    className="sticky top-0 z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-[11px] font-bold text-gray-700 text-left select-none whitespace-nowrap"
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      left: ROW_NUM_WIDTH + FROZEN_COLS.slice(0, i).reduce((s, c) => s + c.width, 0),
                      position: 'sticky',
                      zIndex: 30,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                {/* Scrollable column headers */}
                {SCROLL_COLS.map((col) => (
                  <th
                    key={col.key}
                    className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-2 py-2 text-[11px] font-bold text-gray-700 text-left select-none whitespace-nowrap"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && parties.length === 0 ? (
                <tr>
                  <td colSpan={SHEET_COLUMNS.length + 1} className="text-center py-12 text-sm text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={SHEET_COLUMNS.length + 1} className="text-center py-12 text-sm text-gray-400">
                    No records found
                  </td>
                </tr>
              ) : (
                parties.map((party, rowIdx) => {
                  const rowNum = (page - 1) * PAGE_SIZE + rowIdx + 1;
                  return (
                    <tr
                      key={party.uniqueId || rowIdx}
                      className="hover:bg-blue-50/40 transition-colors group"
                    >
                      {/* Row number */}
                      <td
                        className="sticky left-0 z-10 bg-gray-50 group-hover:bg-blue-50/60 border border-gray-200 text-[10px] text-gray-400 text-center font-mono select-none"
                        style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                      >
                        {rowNum}
                      </td>
                      {/* Frozen cells */}
                      {FROZEN_COLS.map((col, i) => {
                        const val = getCellValue(party, col.key);
                        return (
                          <td
                            key={col.key}
                            className="sticky z-10 bg-white group-hover:bg-blue-50/60 border border-gray-200 px-2 py-1.5 text-xs text-gray-800 truncate"
                            style={{
                              width: col.width,
                              minWidth: col.width,
                              maxWidth: col.width,
                              left: ROW_NUM_WIDTH + FROZEN_COLS.slice(0, i).reduce((s, c) => s + c.width, 0),
                            }}
                            title={val}
                          >
                            {col.key === 'hostName' ? (
                              <span className="font-semibold text-gray-900">{val}</span>
                            ) : val}
                          </td>
                        );
                      })}
                      {/* Scrollable cells */}
                      {SCROLL_COLS.map((col) => {
                        const val = getCellValue(party, col.key);
                        return (
                          <td
                            key={col.key}
                            className="border border-gray-200 px-2 py-1.5 text-xs text-gray-700 truncate"
                            style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                            title={val}
                          >
                            {col.key === 'status' && val ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[val] || 'bg-gray-100 text-gray-700'}`}>
                                {val}
                              </span>
                            ) : col.key === 'dueAmount' && parseFloat(val) > 0 ? (
                              <span className="text-red-600 font-semibold">{val}</span>
                            ) : col.key === 'paymentStatus' && val === 'Paid' ? (
                              <span className="text-green-600 font-semibold">{val}</span>
                            ) : val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer - pagination like sheet tabs */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-green-600 text-white text-[11px] font-semibold px-3 py-1 rounded-t-sm">
            Party Bookings
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-[11px] text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
