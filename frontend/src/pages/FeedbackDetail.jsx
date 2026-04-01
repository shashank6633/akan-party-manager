import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Loader2, ArrowLeft, Phone, Building2, Calendar, Users, ChefHat, Wine, Sparkles, MessageSquare, User, AlertTriangle, PhoneCall } from 'lucide-react';
import { feedbackAPI } from '../services/api';

// ---------------------------------------------------------------------------
// Read-only Star Rating Display
// ---------------------------------------------------------------------------
function Stars({ value, size = 'sm' }) {
  const r = parseInt(value) || 0;
  const sz = size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  const labels = { 5: 'Excellent', 4: 'Good', 3: 'Average', 2: 'Poor', 1: 'Very Poor' };
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${sz} ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
      {r > 0 && (
        <span className={`ml-2 font-semibold ${
          r >= 4 ? 'text-green-600' : r >= 3 ? 'text-amber-600' : 'text-red-600'
        } ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {labels[r]}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------
function SectionHeader({ icon: Icon, title, subtitle, color = 'gray' }) {
  const bgMap = { orange: 'bg-orange-100', blue: 'bg-blue-100', green: 'bg-green-100', purple: 'bg-purple-100' };
  const textMap = { orange: 'text-orange-600', blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600' };
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-lg ${bgMap[color] || 'bg-gray-100'}`}>
        <Icon className={`w-5 h-5 ${textMap[color] || 'text-gray-600'}`} />
      </div>
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-Item Rating Display Row
// ---------------------------------------------------------------------------
function ItemRatingDisplay({ item, rating, comment }) {
  const r = parseInt(rating) || 0;
  if (r === 0 && !comment) return null;
  return (
    <div className="flex flex-col gap-1 p-3 bg-white border border-gray-100 rounded-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-800">{item}</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`w-4 h-4 ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          ))}
        </div>
      </div>
      {comment && <p className="text-xs text-gray-500 italic">{comment}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item Ratings Section (from JSON array)
// ---------------------------------------------------------------------------
function ItemRatingsSection({ title, ratings, bgColor = 'bg-green-50/50' }) {
  if (!ratings || !Array.isArray(ratings) || ratings.length === 0) return null;
  const hasAnyRating = ratings.some(r => (parseInt(r.rating) || 0) > 0 || r.comment);
  if (!hasAnyRating) return null;
  return (
    <div className={`p-4 ${bgColor} rounded-lg mb-4`}>
      <p className="text-sm font-bold text-gray-800 mb-3">{title}</p>
      <div className="space-y-2">
        {ratings.map((r, idx) => (
          <ItemRatingDisplay key={idx} item={r.item} rating={r.rating} comment={r.comment} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service / Ambience Rating Row
// ---------------------------------------------------------------------------
function RatingRow({ label, value }) {
  const r = parseInt(value) || 0;
  if (r === 0) return null;
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className="text-sm text-gray-700 font-medium">{label}</p>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`w-4 h-4 ${i <= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FeedbackDetail Page
// ---------------------------------------------------------------------------
export default function FeedbackDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fb, setFb] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await feedbackAPI.getById(id);
        setFb(res.data.feedback || res.data.data || res.data);
      } catch (err) {
        setError('Failed to load feedback.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Parse JSON fields safely
  const parseJson = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
      </div>
    );
  }

  if (error || !fb) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">{error || 'Feedback not found.'}</p>
        <button onClick={() => navigate('/feedback')} className="mt-4 text-sm text-[#af4408] hover:underline">Back to Feedback</button>
      </div>
    );
  }

  const overallRating = parseInt(fb.overallRating) || 0;
  const startersItemRatings = parseJson(fb.startersItemRatings);
  const mainCourseItemRatings = parseJson(fb.mainCourseItemRatings);
  const sidesItemRatings = parseJson(fb.sidesItemRatings);
  const dessertItemRatings = parseJson(fb.dessertItemRatings);
  const addonItemRatings = parseJson(fb.addonItemRatings);
  const hasFoodRatings = startersItemRatings.length > 0 || mainCourseItemRatings.length > 0 || sidesItemRatings.length > 0 || dessertItemRatings.length > 0 || addonItemRatings.length > 0 || (parseInt(fb.foodQualityRating) || 0) > 0;
  const hasServiceRatings = (parseInt(fb.staffBehaviorRating) || 0) > 0 || (parseInt(fb.orderAccuracyRating) || 0) > 0 || (parseInt(fb.servingSpeedRating) || 0) > 0;
  const hasAmbienceRatings = (parseInt(fb.cleanlinessRating) || 0) > 0 || (parseInt(fb.musicRating) || 0) > 0 || (parseInt(fb.seatingComfortRating) || 0) > 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/feedback')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Feedback
      </button>

      {/* Title + Meta */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Feedback Details</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs font-mono text-gray-400">{fb.feedbackId}</span>
            {fb.fpId && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{fb.fpId}</span>}
            {fb.submittedAt && <span className="text-xs text-gray-400">Submitted: {fb.submittedAt}</span>}
            {fb.submittedBy && <span className="text-xs text-gray-400">by {fb.submittedBy}</span>}
          </div>
        </div>
      </div>

      <div className="space-y-5">

        {/* ================================================================ */}
        {/* SECTION 1: Guest & Reviewer Info */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Users} title="Guest & Event Information" color="orange" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fb.reviewerName && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200 sm:col-span-2">
                <User className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-orange-500 uppercase tracking-wider">Reviewer</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{fb.reviewerName}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Host Name</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fb.guestName || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fb.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Company</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fb.company || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Event Date</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fb.dateOfEvent || '-'}</p>
              </div>
            </div>
          </div>
          {fb.packageType && (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-3 py-1 bg-[#af4408]/10 text-[#af4408] rounded-full text-xs font-semibold">{fb.packageType}</span>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* SECTION 2: Overall Experience */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Star} title="Overall Experience" color="orange" />
          <Stars value={fb.overallRating} size="lg" />
          {fb.overallComment && (
            <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 italic">
              &ldquo;{fb.overallComment}&rdquo;
            </p>
          )}
        </div>

        {/* ================================================================ */}
        {/* SECTION 3: Food Quality — per-item ratings */}
        {/* ================================================================ */}
        {hasFoodRatings && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={ChefHat} title="Food Quality" color="green" />

            {(parseInt(fb.foodQualityRating) || 0) > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Overall Food Quality</p>
                <Stars value={fb.foodQualityRating} size="md" />
              </div>
            )}

            <ItemRatingsSection title="Starters" ratings={startersItemRatings} />
            <ItemRatingsSection title="Main Course" ratings={mainCourseItemRatings} />
            <ItemRatingsSection title="Sides & Accompaniments" ratings={sidesItemRatings} bgColor="bg-emerald-50/50" />
            <ItemRatingsSection title="Desserts" ratings={dessertItemRatings} bgColor="bg-amber-50/50" />
            <ItemRatingsSection title="Add-ons" ratings={addonItemRatings} bgColor="bg-rose-50/50" />
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 4: Beverages */}
        {/* ================================================================ */}
        {(parseInt(fb.beveragesRating) || 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={Wine} title="Beverages" color="purple" />
            <Stars value={fb.beveragesRating} size="md" />
            {fb.beveragesComment && (
              <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{fb.beveragesComment}&rdquo;</p>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 5: Service */}
        {/* ================================================================ */}
        {hasServiceRatings && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={Users} title="Service" color="blue" />
            <div className="space-y-3">
              <RatingRow label="Staff Behavior" value={fb.staffBehaviorRating} />
              <RatingRow label="Order Accuracy" value={fb.orderAccuracyRating} />
              <RatingRow label="Serving Speed" value={fb.servingSpeedRating} />
            </div>
            {fb.serviceComment && (
              <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{fb.serviceComment}&rdquo;</p>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 6: Ambience */}
        {/* ================================================================ */}
        {hasAmbienceRatings && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={Sparkles} title="Ambience" color="purple" />
            <div className="space-y-3">
              <RatingRow label="Cleanliness" value={fb.cleanlinessRating} />
              <RatingRow label="Music & Entertainment" value={fb.musicRating} />
              <RatingRow label="Seating Comfort" value={fb.seatingComfortRating} />
            </div>
            {fb.ambienceComment && (
              <p className="mt-3 text-sm text-gray-600 italic">&ldquo;{fb.ambienceComment}&rdquo;</p>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 7: Complaints & Suggestions */}
        {/* ================================================================ */}
        {(fb.complaint || fb.suggestion || fb.wantsCallback === 'Yes') && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={MessageSquare} title="Complaints & Suggestions" />
            {fb.complaint && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-red-600 mb-1">Complaint</p>
                <p className="text-sm text-gray-700 bg-red-50 rounded-lg px-4 py-3">{fb.complaint}</p>
              </div>
            )}
            {fb.suggestion && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-blue-600 mb-1">Suggestion</p>
                <p className="text-sm text-gray-700 bg-blue-50 rounded-lg px-4 py-3">{fb.suggestion}</p>
              </div>
            )}
            {fb.wantsCallback === 'Yes' && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <PhoneCall className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Guest requested a callback</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Padding */}
      <div className="h-8" />
    </div>
  );
}
