import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Star, Loader2, CheckCircle, ArrowLeft, Phone, Building2, Calendar, Users, ChefHat, Wine, Sparkles, MessageSquare, User } from 'lucide-react';
import { fpAPI, feedbackAPI } from '../services/api';

// ---------------------------------------------------------------------------
// Star Rating Component
// ---------------------------------------------------------------------------
function StarRating({ value, onChange, size = 'lg', showLabel = true }) {
  const [hover, setHover] = useState(0);
  const sz = size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const labels = { 5: 'Excellent', 4: 'Good', 3: 'Average', 2: 'Poor', 1: 'Very Poor' };
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`${sz} transition-colors ${
              i <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      {showLabel && value > 0 && (
        <span className={`ml-2 font-semibold ${
          value >= 4 ? 'text-green-600' : value >= 3 ? 'text-amber-600' : 'text-red-600'
        } ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {labels[value]}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------
function SectionHeader({ icon: Icon, title, subtitle, color = 'text-gray-900' }) {
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
// Per-Item Rating Row
// ---------------------------------------------------------------------------
function ItemRatingRow({ item, rating, comment, onRatingChange, onCommentChange }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 bg-white border border-gray-100 rounded-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-800">{item}</span>
        <StarRating value={rating} onChange={onRatingChange} size="sm" showLabel={false} />
      </div>
      <input
        type="text"
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Comment (optional)..."
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback Form Page
// ---------------------------------------------------------------------------
export default function FeedbackForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fpRowId = searchParams.get('fpRow');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fpData, setFpData] = useState(null);

  // Form state
  const [reviewerName, setReviewerName] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [overallComment, setOverallComment] = useState('');
  const [foodQualityRating, setFoodQualityRating] = useState(0);
  const [beveragesRating, setBeveragesRating] = useState(0);
  const [beveragesComment, setBeveragesComment] = useState('');
  const [staffBehaviorRating, setStaffBehaviorRating] = useState(0);
  const [orderAccuracyRating, setOrderAccuracyRating] = useState(0);
  const [servingSpeedRating, setServingSpeedRating] = useState(0);
  const [serviceComment, setServiceComment] = useState('');
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [musicRating, setMusicRating] = useState(0);
  const [seatingComfortRating, setSeatingComfortRating] = useState(0);
  const [ambienceComment, setAmbienceComment] = useState('');
  const [complaint, setComplaint] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [wantsCallback, setWantsCallback] = useState('No');

  // Per-item ratings: { "itemName": { rating: 0, comment: '' } }
  const [starterRatings, setStarterRatings] = useState({});
  const [mainCourseRatings, setMainCourseRatings] = useState({});
  const [sidesRatings, setSidesRatings] = useState({});
  const [dessertRatings, setDessertRatings] = useState({});
  const [addonRatings, setAddonRatings] = useState({});

  // Fetch F&P data
  useEffect(() => {
    if (!fpRowId) {
      setError('No F&P record specified.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fpAPI.getById(fpRowId);
        const fp = res.data.data || res.data.record || res.data.fp || res.data;
        setFpData(fp);

        // Initialize per-item rating objects from F&P menu items
        const initRatings = (items) => {
          const obj = {};
          items.forEach((item) => { obj[item] = { rating: 0, comment: '' }; });
          return obj;
        };

        const parse = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          try { return JSON.parse(val); } catch { return []; }
        };

        // Starters
        const allStarters = [
          ...parse(fp.vegStarters).map((i) => `${i}`),
          ...parse(fp.nonVegStarters).map((i) => `${i}`),
        ];
        setStarterRatings(initRatings(allStarters));

        // Main course
        const allMain = [
          ...parse(fp.vegMainCourse),
          ...parse(fp.nonVegMainCourse),
        ];
        setMainCourseRatings(initRatings(allMain));

        // Sides
        const allSides = [
          ...parse(fp.rice),
          ...parse(fp.dal),
          ...parse(fp.salad),
          ...parse(fp.accompaniments),
        ];
        setSidesRatings(initRatings(allSides));

        // Desserts
        setDessertRatings(initRatings(parse(fp.desserts)));

        // Addons
        const allAddons = [
          ...parse(fp.addonMuttonStarters),
          ...parse(fp.addonMuttonMainCourse),
          ...parse(fp.addonPrawnsStarters),
          ...parse(fp.addonPrawnsMainCourse),
          ...parse(fp.addonExtras),
        ];
        if (allAddons.length > 0) setAddonRatings(initRatings(allAddons));
      } catch (err) {
        setError('Failed to load F&P record.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fpRowId]);

  const updateItemRating = (setter, item, field, value) => {
    setter((prev) => ({
      ...prev,
      [item]: { ...prev[item], [field]: value },
    }));
  };

  // Convert item ratings object to JSON array: [{item, rating, comment}]
  const ratingsToArray = (ratings) => {
    return Object.entries(ratings).map(([item, data]) => ({
      item,
      rating: data.rating || 0,
      comment: data.comment || '',
    }));
  };

  const hasDrinks = fpData && fpData.packageType && !fpData.packageType.includes('Food Only');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!overallRating) {
      setError('Please provide an overall rating.');
      return;
    }
    if (!reviewerName.trim()) {
      setError('Please enter the reviewer name.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const submitData = {
        partyUniqueId: fpData?.partyUniqueId || '',
        fpId: fpData?.fpId || '',
        reviewerName: reviewerName.trim(),
        guestName: fpData?.contactPerson || fpData?.guestName || '',
        phone: fpData?.phone || '',
        company: fpData?.company || '',
        dateOfEvent: fpData?.dateOfEvent || '',
        packageType: fpData?.packageType || '',
        overallRating,
        overallComment,
        foodQualityRating,
        startersItemRatings: ratingsToArray(starterRatings),
        mainCourseItemRatings: ratingsToArray(mainCourseRatings),
        sidesItemRatings: ratingsToArray(sidesRatings),
        dessertItemRatings: ratingsToArray(dessertRatings),
        addonItemRatings: ratingsToArray(addonRatings),
        beveragesRating,
        beveragesComment,
        staffBehaviorRating,
        orderAccuracyRating,
        servingSpeedRating,
        serviceComment,
        cleanlinessRating,
        musicRating,
        seatingComfortRating,
        ambienceComment,
        complaint,
        suggestion,
        wantsCallback,
      };
      await feedbackAPI.submit(submitData);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Feedback Submitted!</h2>
        <p className="text-gray-500 mb-2">Thank you for collecting feedback from <strong>{reviewerName}</strong>.</p>
        <p className="text-sm text-gray-400 mb-6">You can collect more feedback from other guests for the same event.</p>
        {overallRating >= 4 && (
          <p className="text-sm text-green-600 bg-green-50 rounded-lg px-4 py-3 mb-4">
            Great rating! Consider requesting a Google Review from the guest.
          </p>
        )}
        {overallRating < 4 && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-3 mb-4">
            Feedback has been stored internally for review and improvement.
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate(`/feedback/new?fpId=${fpData?.fpId}&fpRow=${fpRowId}`)}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
          >
            + Add Another Review
          </button>
          <button
            onClick={() => navigate('/feedback')}
            className="px-5 py-2.5 bg-[#af4408] text-white rounded-lg font-medium hover:bg-[#8e3706] transition-colors text-sm"
          >
            Back to Feedback List
          </button>
        </div>
      </div>
    );
  }

  const renderItemSection = (title, ratings, setter, bgColor = 'bg-green-50/50') => {
    const items = Object.keys(ratings);
    if (items.length === 0) return null;
    return (
      <div className={`p-4 ${bgColor} rounded-lg mb-4`}>
        <p className="text-sm font-bold text-gray-800 mb-3">{title}</p>
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRatingRow
              key={item}
              item={item}
              rating={ratings[item]?.rating || 0}
              comment={ratings[item]?.comment || ''}
              onRatingChange={(v) => updateItemRating(setter, item, 'rating', v)}
              onCommentChange={(v) => updateItemRating(setter, item, 'comment', v)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back Button */}
      <button onClick={() => navigate('/feedback')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Feedback
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-1">Guest Feedback Form</h2>
      <p className="text-sm text-gray-500 mb-6">Collect feedback for the event below. Multiple reviews per event are encouraged!</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ================================================================ */}
        {/* SECTION 1: Guest & Reviewer Information */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Users} title="Guest & Event Information" subtitle="Auto-filled from Function & Prospectus" color="orange" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Host Name</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fpData?.contactPerson || fpData?.guestName || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fpData?.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Company</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fpData?.company || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Event Date</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{fpData?.dateOfEvent || '-'}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {fpData?.packageType && (
              <span className="px-3 py-1 bg-[#af4408]/10 text-[#af4408] rounded-full text-xs font-semibold">{fpData.packageType}</span>
            )}
            {fpData?.paxExpected && (
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">{fpData.paxExpected} Pax</span>
            )}
            {fpData?.fpId && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-mono">{fpData.fpId}</span>
            )}
          </div>

          {/* Reviewer Name */}
          <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-orange-600" />
              <label className="text-sm font-bold text-gray-800">Reviewer Name <span className="text-red-500">*</span></label>
            </div>
            <p className="text-xs text-gray-500 mb-2">Name of the person giving this feedback (can be different from the host)</p>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Enter the reviewer's name..."
              className="w-full px-3 py-2.5 border border-orange-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none bg-white"
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 2: Overall Experience Rating */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Star} title="Overall Experience" subtitle="How was the overall event experience?" color="orange" />
          <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
          <textarea
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            placeholder="Any overall comments about the experience..."
            rows={2}
            className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
          />
        </div>

        {/* ================================================================ */}
        {/* SECTION 3: Food Quality — per-item ratings */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={ChefHat} title="Food Quality" subtitle="Rate each dish individually — this helps us improve the menu" color="green" />

          {/* Overall Food Rating */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">Overall Food Quality</p>
            <StarRating value={foodQualityRating} onChange={setFoodQualityRating} size="md" />
          </div>

          {/* Per-item: Starters */}
          {renderItemSection('Starters', starterRatings, setStarterRatings)}

          {/* Per-item: Main Course */}
          {renderItemSection('Main Course', mainCourseRatings, setMainCourseRatings)}

          {/* Per-item: Sides (Rice, Dal, Salad, Accompaniments) */}
          {renderItemSection('Sides & Accompaniments', sidesRatings, setSidesRatings, 'bg-emerald-50/50')}

          {/* Per-item: Desserts */}
          {renderItemSection('Desserts', dessertRatings, setDessertRatings, 'bg-amber-50/50')}

          {/* Per-item: Addons */}
          {renderItemSection('Add-ons (Mutton, Prawns, Extras)', addonRatings, setAddonRatings, 'bg-rose-50/50')}
        </div>

        {/* ================================================================ */}
        {/* SECTION 4: Beverages */}
        {/* ================================================================ */}
        {hasDrinks && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={Wine} title="Beverages" subtitle="Rate the drinks and bar service" color="purple" />
            <div className="p-4 bg-purple-50/50 rounded-lg">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2.5 py-1 bg-white border border-purple-200 rounded-full text-xs text-purple-700 font-medium">
                  {fpData?.packageType}
                </span>
                {fpData?.drinksStartTime && (
                  <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
                    Bar: {fpData.drinksStartTime} - {fpData.drinksEndTime || '?'}
                  </span>
                )}
              </div>
              <StarRating value={beveragesRating} onChange={setBeveragesRating} size="sm" />
              <textarea
                value={beveragesComment}
                onChange={(e) => setBeveragesComment(e.target.value)}
                placeholder="Comments on beverages and bar service..."
                rows={1}
                className="mt-2 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION 5: Service */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Users} title="Service" subtitle="Rate the staff and service quality" color="blue" />
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700 font-medium">Staff Behavior</p>
              <StarRating value={staffBehaviorRating} onChange={setStaffBehaviorRating} size="sm" />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700 font-medium">Order Accuracy</p>
              <StarRating value={orderAccuracyRating} onChange={setOrderAccuracyRating} size="sm" />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700 font-medium">Serving Speed</p>
              <StarRating value={servingSpeedRating} onChange={setServingSpeedRating} size="sm" />
            </div>
            <textarea
              value={serviceComment}
              onChange={(e) => setServiceComment(e.target.value)}
              placeholder="Any comments about the service..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 6: Ambience */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Sparkles} title="Ambience" subtitle="Rate the venue and atmosphere" color="purple" />
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700 font-medium">Cleanliness</p>
              <StarRating value={cleanlinessRating} onChange={setCleanlinessRating} size="sm" />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700 font-medium">Music & Entertainment</p>
              <StarRating value={musicRating} onChange={setMusicRating} size="sm" />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-700 font-medium">Seating Comfort</p>
              <StarRating value={seatingComfortRating} onChange={setSeatingComfortRating} size="sm" />
            </div>
            <textarea
              value={ambienceComment}
              onChange={(e) => setAmbienceComment(e.target.value)}
              placeholder="Any comments about the ambience..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
            />
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 7: Complaint / Suggestion */}
        {/* ================================================================ */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={MessageSquare} title="Complaints & Suggestions" subtitle="Any issues or ideas for improvement?" />
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Complaint (if any)</label>
              <textarea
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="Describe any complaints or issues..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Suggestion</label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Any suggestions to improve our service..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Would the guest like a callback?</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWantsCallback('Yes')}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    wantsCallback === 'Yes'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setWantsCallback('No')}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    wantsCallback === 'No'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SUBMIT */}
        {/* ================================================================ */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/feedback')}
            className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !overallRating || !reviewerName.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Submit Feedback
          </button>
        </div>
      </form>
    </div>
  );
}
