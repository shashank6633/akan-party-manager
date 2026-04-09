import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Star, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import { feedbackAPI, fpAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function FeedbackList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = ['SALES', 'MANAGER', 'FEEDBACK', 'ADMIN'].includes(user?.role);
  const isFeedbackRole = user?.role === 'FEEDBACK';

  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fpRecords, setFpRecords] = useState([]);
  const [showFpPicker, setShowFpPicker] = useState(false);
  const [fpSearch, setFpSearch] = useState('');
  const [fpFilterToday, setFpFilterToday] = useState(true);

  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await feedbackAPI.getAll(params);
      setFeedback(res.data.feedback || []);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchFeedback, 500);
    return () => clearTimeout(t);
  }, [search]);

  const handleNewFeedback = async () => {
    try {
      const res = await fpAPI.getAll();
      const records = (res.data.data || res.data.records || res.data.fps || [])
        .filter((r) => r.status === 'Issued' || r.status === 'Approved' || r.status === 'Draft');
      setFpRecords(records);
      setShowFpPicker(true);
    } catch (err) {
      console.error('Failed to fetch F&P records:', err);
    }
  };

  const selectFp = (fp) => {
    setShowFpPicker(false);
    navigate(`/feedback/new?fpId=${fp.fpId}&fpRow=${fp.rowIndex}`);
  };

  const renderStars = (rating) => {
    const r = parseInt(rating) || 0;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`w-3.5 h-3.5 ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        ))}
      </div>
    );
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredFps = fpRecords.filter((fp) => {
    if (fpFilterToday && fp.dateOfEvent !== todayStr) return false;
    if (!fpSearch) return true;
    const s = fpSearch.toLowerCase();
    return (
      (fp.fpId || '').toLowerCase().includes(s) ||
      (fp.contactPerson || '').toLowerCase().includes(s) ||
      (fp.company || '').toLowerCase().includes(s) ||
      (fp.partyUniqueId || '').toLowerCase().includes(s)
    );
  });
  const todayCount = fpRecords.filter((fp) => fp.dateOfEvent === todayStr).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Feedback</h2>
          <p className="text-sm text-gray-500">{isFeedbackRole ? "Collect feedback for today's confirmed parties" : 'Guest feedback from events'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchFeedback} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          {canCreate && (
            <button
              onClick={handleNewFeedback}
              className="flex items-center gap-2 px-4 py-2 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706] transition-colors"
            >
              <Plus className="w-4 h-4" /> New Feedback
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by guest, company, phone, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
        />
      </div>

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#af4408]" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No feedback records found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {feedback.map((fb) => (
            <div
              key={fb.rowIndex}
              onClick={() => navigate(`/feedback/${fb.rowIndex}`)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#af4408]/30 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{fb.feedbackId}</span>
                    {fb.fpId && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{fb.fpId}</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{fb.reviewerName || fb.guestName || 'Unknown Guest'}</h3>
                  {fb.reviewerName && fb.guestName && fb.reviewerName !== fb.guestName && (
                    <p className="text-xs text-gray-400">Host: {fb.guestName}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    {fb.company && <span>{fb.company}</span>}
                    {fb.dateOfEvent && <span>{fb.dateOfEvent}</span>}
                    {fb.packageType && <span>{fb.packageType}</span>}
                    {fb.phone && <span>{fb.phone}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {renderStars(fb.overallRating)}
                  <span className="text-[10px] text-gray-400">{fb.submittedAt}</span>
                </div>
              </div>
              {fb.overallComment && (
                <p className="mt-2 text-xs text-gray-600 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
                  &ldquo;{fb.overallComment}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* F&P Picker Modal */}
      {showFpPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowFpPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-900">Select F&P Record</h3>
              <p className="text-xs text-gray-500 mt-0.5">Choose the event to collect feedback for</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setFpFilterToday(true)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${fpFilterToday ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Today ({todayCount})
                </button>
                {!isFeedbackRole && (
                  <button
                    onClick={() => setFpFilterToday(false)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!fpFilterToday ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    All
                  </button>
                )}
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by F&P ID, contact, company..."
                  value={fpSearch}
                  onChange={(e) => setFpSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredFps.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">No F&P records found</p>
              ) : (
                filteredFps.map((fp) => (
                  <button
                    key={fp.rowIndex}
                    onClick={() => selectFp(fp)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-[#af4408]/40 hover:bg-orange-50/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#af4408]">{fp.fpId}</span>
                      <span className="text-[10px] text-gray-400">{fp.dateOfEvent}</span>
                    </div>
                    <div className="font-medium text-sm text-gray-900 mt-1">{fp.contactPerson || fp.guestName || '-'}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      {fp.company && <span>{fp.company}</span>}
                      {fp.packageType && <span>{fp.packageType}</span>}
                      {fp.paxExpected && <span>{fp.paxExpected} pax</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t">
              <button onClick={() => setShowFpPicker(false)} className="w-full py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
