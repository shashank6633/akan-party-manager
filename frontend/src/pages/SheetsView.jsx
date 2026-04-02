import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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
  { key: 'occasionType', label: 'Occasion', width: 110 },
  { key: 'partyTime', label: 'Party Time', width: 130 },
  { key: 'expectedPax', label: 'Exp. Pax', width: 80 },
  { key: 'packageSelected', label: 'Package', width: 130 },
  { key: 'specialRequirements', label: 'Special Req.', width: 180 },
  { key: 'status', label: 'Status', width: 100 },
  { key: 'guestVisited', label: 'Visited', width: 80 },
  { key: 'lostReason', label: 'Lost Reason', width: 150 },
  { key: 'cancelledDate', label: 'Cancelled Date', width: 120 },
  { key: 'approxBillAmount', label: 'Approx Bill', width: 110 },
  { key: 'approxBalanceAmount', label: 'Approx Balance', width: 120 },
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
};

const PAGE_SIZE = 100;

export default function SheetsView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const tableRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE, sort: 'date', order: 'desc' };
      if (search) params.search = search;
      if (statusFilter !== 'All') params.status = statusFilter;
      const res = await partyAPI.getAll(params);
      const data = res.data?.data || res.data || [];
      setParties(Array.isArray(data) ? data : data.parties || []);
      setTotalCount(data.total || data.length || 0);
    } catch (err) {
      console.error('Failed to fetch parties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchData(); }, 400);
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
          {['All', 'Enquiry', 'Contacted', 'Tentative', 'Confirmed', 'Cancelled'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => { setPage(1); fetchData(); }}
          className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-[11px] text-gray-500 ml-auto">
          {totalCount} records
        </span>
      </div>

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
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/parties/${party._rowIndex || rowIdx + 2}`)}
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
