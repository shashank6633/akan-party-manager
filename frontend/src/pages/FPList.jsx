import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, FileText, Search, Eye, Trash2 } from 'lucide-react';
import { fpAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';

const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-700',
  Issued: 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Revised: 'bg-amber-100 text-amber-700',
};

export default function FPList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState(null);

  const canCreate = ['SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
  const canDelete = ['MANAGER', 'ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fpAPI.getAll();
      setRecords(res.data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rowIndex, fpId) => {
    if (!confirm(`Delete F&P record ${fpId}? This cannot be undone.`)) return;
    setDeleting(rowIndex);
    try {
      await fpAPI.delete(rowIndex);
      setRecords((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
    } catch {
      alert('Failed to delete F&P record.');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.fpId || '').toLowerCase().includes(q) ||
      (r.partyUniqueId || '').toLowerCase().includes(q) ||
      (r.contactPerson || '').toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q) ||
      (r.guestName || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Function & Prospectus</h1>
          <p className="text-sm text-gray-500 mt-0.5">{records.length} record{records.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, company, contact, guest..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
          />
        </div>
        <div className="flex gap-2">
          {['', 'Draft', 'Issued', 'Approved', 'Revised'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#af4408] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No F&P records found.</p>
          {canCreate && (
            <p className="text-gray-400 text-xs mt-1">
              Create an F&P from a party's detail page.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.rowIndex}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#af4408]/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{r.fpId}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || STATUS_COLORS.Draft}`}>
                      {r.status || 'Draft'}
                    </span>
                    {r.partyUniqueId && (
                      <span className="text-[10px] text-gray-400">Party: {r.partyUniqueId}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-medium text-gray-900">{r.contactPerson || r.guestName || '-'}</span>
                    {r.company && <span className="text-gray-500">{r.company}</span>}
                    {r.dateOfEvent && <span className="text-gray-500">{formatDate(r.dateOfEvent)}</span>}
                    {r.paxExpected && <span className="text-gray-500">{r.paxExpected} pax</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    {r.packageType && <span>Package: {r.packageType}</span>}
                    {r.fpMadeBy && <span>By: {r.fpMadeBy}</span>}
                    {r.createdAt && <span>Created: {r.createdAt}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/fp/${r.rowIndex}`)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#af4408]/10 text-[#af4408] hover:bg-[#af4408]/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View / Edit
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(r.rowIndex, r.fpId)}
                      disabled={deleting === r.rowIndex}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleting === r.rowIndex ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
