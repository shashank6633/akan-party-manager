import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Star, Loader2, CheckCircle, ArrowLeft, Phone, Building2, Calendar, Users, ChefHat, Wine, MessageSquare, User, Download, Printer } from 'lucide-react';
import { fpAPI, preTastingAPI } from '../services/api';
import { generatePreTastingPdf } from '../utils/preTastingPdfGenerator';

// ---------------------------------------------------------------------------
// Star Rating
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
          <Star className={`${sz} transition-colors ${i <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
      {showLabel && value > 0 && (
        <span className={`ml-2 font-semibold ${value >= 4 ? 'text-green-600' : value >= 3 ? 'text-amber-600' : 'text-red-600'} ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {labels[value]}
        </span>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-gray-900' }) {
  const bgMap = { orange: 'bg-orange-100', blue: 'bg-blue-100', green: 'bg-green-100', purple: 'bg-purple-100', amber: 'bg-amber-100' };
  const textMap = { orange: 'text-orange-600', blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600', amber: 'text-amber-600' };
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
        placeholder="Taste notes / change requested (optional)..."
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-Tasting Form Page
// ---------------------------------------------------------------------------
export default function PreTastingForm() {
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
  const [itemsToChange, setItemsToChange] = useState('');
  const [complaint, setComplaint] = useState('');
  const [suggestion, setSuggestion] = useState('');

  const [starterRatings, setStarterRatings] = useState({});
  const [mainCourseRatings, setMainCourseRatings] = useState({});
  const [sidesRatings, setSidesRatings] = useState({});
  const [dessertRatings, setDessertRatings] = useState({});
  const [addonRatings, setAddonRatings] = useState({});

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
        let otherItemsObj = fp.otherItems || {};
        if (typeof otherItemsObj === 'string') {
          try { otherItemsObj = JSON.parse(otherItemsObj); } catch { otherItemsObj = {}; }
        }
        const getOther = (catKey) => {
          const raw = otherItemsObj[catKey] && otherItemsObj[catKey].trim();
          if (!raw) return [];
          return raw.split(',').map((s) => s.trim()).filter(Boolean);
        };

        setStarterRatings(initRatings([
          ...parse(fp.vegStarters), ...getOther('vegStarters'),
          ...parse(fp.nonVegStarters), ...getOther('nonVegStarters'),
        ]));
        setMainCourseRatings(initRatings([
          ...parse(fp.vegMainCourse), ...getOther('vegMainCourse'),
          ...parse(fp.nonVegMainCourse), ...getOther('nonVegMainCourse'),
        ]));
        setSidesRatings(initRatings([
          ...parse(fp.rice), ...getOther('rice'),
          ...parse(fp.dal), ...getOther('dal'),
          ...parse(fp.salad), ...getOther('salad'),
          ...parse(fp.accompaniments), ...getOther('accompaniments'),
        ]));
        setDessertRatings(initRatings([...parse(fp.desserts), ...getOther('desserts')]));
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
    setter((prev) => ({ ...prev, [item]: { ...prev[item], [field]: value } }));
  };

  const ratingsToArray = (ratings) =>
    Object.entries(ratings).map(([item, data]) => ({
      item,
      rating: data.rating || 0,
      comment: data.comment || '',
    }));

  const hasDrinks = fpData && fpData.packageType && !fpData.packageType.includes('Food Only');

  const buildDraft = () => ({
    reviewerName: reviewerName.trim(),
    overallRating,
    overallComment,
    foodQualityRating,
    beveragesRating,
    beveragesComment,
    itemsToChange,
    complaint,
    suggestion,
    startersItemRatings: ratingsToArray(starterRatings),
    mainCourseItemRatings: ratingsToArray(mainCourseRatings),
    sidesItemRatings: ratingsToArray(sidesRatings),
    dessertItemRatings: ratingsToArray(dessertRatings),
    addonItemRatings: ratingsToArray(addonRatings),
  });

  const handleDownloadPdf = () => {
    if (!fpData) return;
    generatePreTastingPdf({ fp: fpData, preTasting: buildDraft() });
  };

  const handleDownloadBlank = () => {
    if (!fpData) return;
    generatePreTastingPdf({ fp: fpData, preTasting: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!overallRating) { setError('Please provide an overall rating.'); return; }
    if (!reviewerName.trim()) { setError('Please enter the reviewer name.'); return; }
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
        tastingDate: new Date().toISOString().slice(0, 10),
        eventDate: fpData?.dateOfEvent || '',
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
        itemsToChange,
        complaint,
        suggestion,
      };
      await preTastingAPI.submit(submitData);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit pre-tasting.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form state for "Add Another" without re-fetching F&P
  const resetForm = () => {
    setReviewerName('');
    setOverallRating(0);
    setOverallComment('');
    setFoodQualityRating(0);
    setBeveragesRating(0);
    setBeveragesComment('');
    setItemsToChange('');
    setComplaint('');
    setSuggestion('');
    const zero = (obj) => {
      const out = {};
      Object.keys(obj).forEach((k) => { out[k] = { rating: 0, comment: '' }; });
      return out;
    };
    setStarterRatings((prev) => zero(prev));
    setMainCourseRatings((prev) => zero(prev));
    setSidesRatings((prev) => zero(prev));
    setDessertRatings((prev) => zero(prev));
    setAddonRatings((prev) => zero(prev));
    setError('');
    setSuccess(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Pre-Tasting Saved!</h2>
        <p className="text-gray-500 mb-6">
          Recorded by <strong>{reviewerName}</strong>. After the party, the post-event feedback will be compared against this.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={resetForm}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm"
          >
            + Add Another
          </button>
          <button
            onClick={() => navigate('/pre-tasting')}
            className="px-5 py-2.5 bg-[#af4408] text-white rounded-lg font-medium hover:bg-[#8e3706] text-sm"
          >
            Back to Pre-Tasting List
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
      <button onClick={() => navigate('/pre-tasting')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Pre-Tasting
      </button>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Pre-Tasting Review</h2>
          <p className="text-sm text-gray-500">Pre-event food review — will be compared against the post-party feedback</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownloadBlank}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            title="Print a blank landscape form for manual entry"
          >
            <Printer className="w-4 h-4" /> Blank PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-3 py-2 border border-[#af4408] text-[#af4408] rounded-lg text-sm hover:bg-orange-50"
            title="Download landscape PDF with current draft pre-filled"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Event Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Users} title="Event Information" subtitle="Auto-filled from Function & Prospectus" color="orange" />
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
            {fpData?.packageType && <span className="px-3 py-1 bg-[#af4408]/10 text-[#af4408] rounded-full text-xs font-semibold">{fpData.packageType}</span>}
            {fpData?.paxExpected && <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">{fpData.paxExpected} Pax</span>}
            {fpData?.fpId && <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-mono">{fpData.fpId}</span>}
          </div>

          <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-orange-600" />
              <label className="text-sm font-bold text-gray-800">Reviewer Name <span className="text-red-500">*</span></label>
            </div>
            <p className="text-xs text-gray-500 mb-2">Team member conducting the pre-tasting</p>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-3 py-2.5 border border-orange-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none bg-white"
            />
          </div>
        </div>

        {/* Overall */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={Star} title="Overall Tasting" subtitle="How was the menu overall during tasting?" color="orange" />
          <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
          <textarea
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            placeholder="Overall tasting notes..."
            rows={2}
            className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
          />
        </div>

        {/* Food Quality per-item */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={ChefHat} title="Food Quality" subtitle="Rate each dish — flag anything that needs to change before the party" color="green" />
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">Overall Food Quality</p>
            <StarRating value={foodQualityRating} onChange={setFoodQualityRating} size="md" />
          </div>
          {renderItemSection('Starters', starterRatings, setStarterRatings)}
          {renderItemSection('Main Course', mainCourseRatings, setMainCourseRatings)}
          {renderItemSection('Sides & Accompaniments', sidesRatings, setSidesRatings, 'bg-emerald-50/50')}
          {renderItemSection('Desserts', dessertRatings, setDessertRatings, 'bg-amber-50/50')}
          {renderItemSection('Add-ons', addonRatings, setAddonRatings, 'bg-rose-50/50')}
        </div>

        {/* Beverages */}
        {hasDrinks && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader icon={Wine} title="Beverages" subtitle="Rate the drinks served during tasting" color="purple" />
            <div className="p-4 bg-purple-50/50 rounded-lg">
              <StarRating value={beveragesRating} onChange={setBeveragesRating} size="sm" />
              <textarea
                value={beveragesComment}
                onChange={(e) => setBeveragesComment(e.target.value)}
                placeholder="Beverages notes..."
                rows={1}
                className="mt-2 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Changes / Complaint / Suggestion */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHeader icon={MessageSquare} title="Changes, Complaints & Suggestions" subtitle="Flag items to change before the actual party" color="amber" />
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Items to Change / Replace</label>
              <p className="text-[11px] text-gray-500 mb-1.5">e.g. "Replace paneer tikka with malai tikka; reduce salt in dal"</p>
              <textarea
                value={itemsToChange}
                onChange={(e) => setItemsToChange(e.target.value)}
                placeholder="List items that need adjustment before the party..."
                rows={3}
                className="w-full px-3 py-2 border border-amber-200 bg-amber-50/30 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Complaint (if any)</label>
              <textarea
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="Any complaints from tasting..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Suggestion</label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Suggestions to improve before the party..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/pre-tasting')}
            className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !overallRating || !reviewerName.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Save Pre-Tasting
          </button>
        </div>
      </form>
    </div>
  );
}
