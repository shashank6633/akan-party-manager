import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Loader2, ArrowLeft, Download, TrendingUp, TrendingDown, Minus, ChefHat, Wine, MessageSquare, AlertTriangle } from 'lucide-react';
import { preTastingAPI, feedbackAPI, fpAPI } from '../services/api';
import { generatePreTastingPdf } from '../utils/preTastingPdfGenerator';

function Stars({ value, size = 'sm' }) {
  const r = parseInt(value) || 0;
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${sz} ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

function DeltaArrow({ pre, post }) {
  const p = parseInt(pre) || 0;
  const f = parseInt(post) || 0;
  if (!p || !f) return <Minus className="w-4 h-4 text-gray-300" />;
  const d = f - p;
  if (d > 0) return <span className="flex items-center gap-0.5 text-green-600 font-semibold text-xs"><TrendingUp className="w-3.5 h-3.5" />+{d}</span>;
  if (d < 0) return <span className="flex items-center gap-0.5 text-red-600 font-semibold text-xs"><TrendingDown className="w-3.5 h-3.5" />{d}</span>;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export default function PreTastingDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pt, setPt] = useState(null);
  const [feedback, setFeedback] = useState([]); // may be multiple post-event reviews
  const [fp, setFp] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await preTastingAPI.getById(id);
        const rec = res.data.preTasting;
        setPt(rec);

        // Fetch linked Feedback (post-event) + F&P
        const promises = [];
        if (rec.fpId) promises.push(feedbackAPI.getByFp(rec.fpId).catch(() => null));
        if (rec.fpId) promises.push(fpAPI.getAll().catch(() => null));
        const [fbRes, fpRes] = await Promise.all(promises);
        if (fbRes) setFeedback(fbRes.data.feedback || []);
        if (fpRes) {
          const list = fpRes.data.data || fpRes.data.records || fpRes.data.fps || [];
          setFp(list.find((f) => f.fpId === rec.fpId) || null);
        }
      } catch (err) {
        setError('Failed to load pre-tasting record.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#af4408]" /></div>;
  }
  if (error || !pt) {
    return <div className="max-w-lg mx-auto py-20 text-center text-red-600">{error || 'Record not found'}</div>;
  }

  // Pick latest feedback (newest first from API)
  const latestFeedback = feedback && feedback.length > 0 ? feedback[0] : null;
  const hasComparison = !!latestFeedback;

  const parseItems = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return []; }
  };

  const buildComparison = (preKey, postKey) => {
    const preItems = parseItems(pt[preKey]);
    const postItems = parseItems(latestFeedback?.[postKey] || []);
    const byItem = {};
    preItems.forEach((r) => { byItem[r.item] = { pre: r, post: null }; });
    postItems.forEach((r) => {
      byItem[r.item] = byItem[r.item] || { pre: null, post: null };
      byItem[r.item].post = r;
    });
    return Object.entries(byItem).map(([item, pair]) => ({ item, ...pair }));
  };

  const sections = [
    { title: 'Starters', preKey: 'startersItemRatings', postKey: 'startersItemRatings' },
    { title: 'Main Course', preKey: 'mainCourseItemRatings', postKey: 'mainCourseItemRatings' },
    { title: 'Sides', preKey: 'sidesItemRatings', postKey: 'sidesItemRatings' },
    { title: 'Desserts', preKey: 'dessertItemRatings', postKey: 'dessertItemRatings' },
    { title: 'Add-ons', preKey: 'addonItemRatings', postKey: 'addonItemRatings' },
  ];

  const handleDownloadPdf = () => {
    if (!fp) return;
    generatePreTastingPdf({ fp, preTasting: pt });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <button onClick={() => navigate('/pre-tasting')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Pre-Tasting
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{pt.preTastingId}</span>
              {pt.fpId && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{pt.fpId}</span>}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{pt.guestName || '-'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {[pt.company, pt.packageType, pt.eventDate && `Event: ${pt.eventDate}`, pt.tastingDate && `Tasted: ${pt.tastingDate}`].filter(Boolean).join('  •  ')}
            </p>
            <p className="text-xs text-gray-500 mt-1">Reviewed by <strong>{pt.reviewerName}</strong> on {pt.submittedAt}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Stars value={pt.overallRating} size="md" />
            <span className="text-xs text-gray-400">Overall ({pt.overallRating || 0}/5)</span>
            {fp && (
              <button
                onClick={handleDownloadPdf}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 border border-[#af4408] text-[#af4408] rounded-lg text-xs hover:bg-orange-50"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comparison banner */}
      <div className={`rounded-xl border p-4 ${hasComparison ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
        {hasComparison ? (
          <p className="text-sm text-blue-900">
            <strong>Comparison available</strong> — showing Pre-Tasting rating vs Post-Event Feedback from <strong>{latestFeedback.reviewerName || latestFeedback.guestName}</strong>
            {feedback.length > 1 && ` (and ${feedback.length - 1} other feedback ${feedback.length - 1 === 1 ? 'record' : 'records'})`}.
          </p>
        ) : (
          <p className="text-sm text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>No post-event feedback collected yet for this F&P. Comparison will appear automatically after feedback is submitted.</span>
          </p>
        )}
      </div>

      {/* Ratings summary with deltas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ChefHat className="w-5 h-5 text-[#af4408]" />
          <h3 className="font-bold text-gray-900">Ratings Overview</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overall', pre: pt.overallRating, post: latestFeedback?.overallRating },
            { label: 'Food Quality', pre: pt.foodQualityRating, post: latestFeedback?.foodQualityRating },
            { label: 'Beverages', pre: pt.beveragesRating, post: latestFeedback?.beveragesRating },
          ].map((m) => (
            <div key={m.label} className="p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{m.label}</p>
              <div className="flex items-center justify-between mt-1.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Stars value={m.pre} size="sm" />
                    <span className="text-xs text-gray-500">Pre</span>
                  </div>
                  {hasComparison && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Stars value={m.post} size="sm" />
                      <span className="text-xs text-gray-500">Post</span>
                    </div>
                  )}
                </div>
                {hasComparison && <DeltaArrow pre={m.pre} post={m.post} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-item comparison tables */}
      {sections.map((sec) => {
        const rows = buildComparison(sec.preKey, sec.postKey);
        if (rows.length === 0) return null;
        return (
          <div key={sec.title} className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3">{sec.title}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="py-2 pr-3 text-xs font-semibold text-gray-500">Item</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">Pre-Tasting</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-500">Pre Comment</th>
                    {hasComparison && <>
                      <th className="py-2 px-3 text-xs font-semibold text-gray-500">Post-Event</th>
                      <th className="py-2 px-3 text-xs font-semibold text-gray-500">Post Comment</th>
                      <th className="py-2 px-3 text-xs font-semibold text-gray-500">Δ</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-800">{r.item}</td>
                      <td className="py-2 px-3"><Stars value={r.pre?.rating} /></td>
                      <td className="py-2 px-3 text-xs text-gray-600">{r.pre?.comment || '-'}</td>
                      {hasComparison && <>
                        <td className="py-2 px-3"><Stars value={r.post?.rating} /></td>
                        <td className="py-2 px-3 text-xs text-gray-600">{r.post?.comment || '-'}</td>
                        <td className="py-2 px-3"><DeltaArrow pre={r.pre?.rating} post={r.post?.rating} /></td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Notes section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Items to Change</p>
          <p className="text-sm text-gray-800">{pt.itemsToChange || <span className="text-gray-400 italic">None flagged</span>}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Complaint</p>
          <p className="text-sm text-gray-800">{pt.complaint || <span className="text-gray-400 italic">None</span>}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Suggestion</p>
          <p className="text-sm text-gray-800">{pt.suggestion || <span className="text-gray-400 italic">None</span>}</p>
        </div>
      </div>
    </div>
  );
}
