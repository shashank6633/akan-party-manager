import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Download, ChevronDown, ChevronUp, AlertTriangle, Check, Mail,
} from 'lucide-react';
import { fpAPI, notificationAPI, partyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FULL_MENU, PACKAGES, ADDONS, DISCLAIMERS, MENU_CATEGORIES,
} from '../data/menuTemplates';
import { generateFpPdf } from '../utils/fpPdfGenerator';

const STATUS_OPTIONS = ['Draft', 'Issued', 'Approved', 'Revised'];

// Categories where ALL items are auto-included (no selection)
const AUTO_INCLUDE_CATEGORIES = ['accompaniments'];

// ---- Stable sub-components (defined outside to prevent re-mount on every render) ----
function SectionBtn({ sectionKey, title, icon, badge, expanded, onToggle }) {
  return (
    <button
      onClick={() => onToggle(sectionKey)}
      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {badge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#af4408]/10 text-[#af4408]">{badge}</span>}
      </div>
      {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  );
}

function Field({ label, field, type = 'text', placeholder, readOnly = false, value, onChange, canEdit }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly || !canEdit}
        className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 ${
          readOnly || !canEdit ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-gray-200 text-gray-900'
        }`}
      />
    </div>
  );
}

function ItemCheck({ item, selected, disabled, color = 'amber', onToggle }) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
        selected
          ? `bg-${color}-50 border-${color}-300 text-${color}-900 font-medium`
          : disabled
          ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
          : `bg-white border-gray-200 text-gray-700 hover:border-${color}-200 hover:bg-${color}-50/50`
      }`}
    >
      <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} className="sr-only" />
      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
        selected ? `bg-${color}-500 border-${color}-500` : 'border-gray-300'
      }`}>
        {selected && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="truncate">{item}</span>
    </label>
  );
}

export default function FPEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isNew = !id || id === 'new';
  const partyUniqueId = searchParams.get('partyId');

  const [form, setForm] = useState({
    status: 'Draft',
    dateOfBooking: '',
    dateOfEvent: '',
    dayOfEvent: '',
    timeOfEvent: '',
    advancePayment: '',
    allocatedArea: '',
    ratePerHead: '',
    company: '',
    minimumGuarantee: '',
    contactPerson: '',
    paxExpected: '',
    phone: '',
    packageType: '',
    reference: '',
    modeOfPayment: '',
    showSpiceLevels: false,
    spiceLevel: '',
    jainFood: false,
    jainFoodPax: '',
    veganFood: false,
    veganFoodPax: '',
    vegStarters: [],
    nonVegStarters: [],
    vegMainCourse: [],
    nonVegMainCourse: [],
    rice: [],
    dal: [],
    salad: [],
    accompaniments: [],
    desserts: [],
    addonMuttonStarters: [],
    addonMuttonMainCourse: [],
    addonPrawnsStarters: [],
    addonPrawnsMainCourse: [],
    addonExtras: [],
    otherItems: {},
    approxBillAmount: '',
    dj: '',
    mc: '',
    mics: '',
    decor: '',
    seatingArrangements: '',
    barNotes: '',
    drinksStartTime: '',
    drinksEndTime: '',
    managerName: '',
    guestName: '',
    fpMadeBy: '',
    kitchenDept: '',
    serviceDept: '',
    barDept: '',
    storesDept: '',
    maintenance: '',
    frontOffice: '',
  });

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [fetchingParty, setFetchingParty] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fpId, setFpId] = useState('');
  const [fpOverrides, setFpOverrides] = useState({});
  const [liquorOverrides, setLiquorOverrides] = useState({});
  const [menuOverrides, setMenuOverrides] = useState({});
  const [customTc, setCustomTc] = useState(null); // custom T&C from settings
  // Preset Menu free-text fields (for parties < 30 pax or custom preset)
  const [presetMenuText, setPresetMenuText] = useState({
    vegStarters: '', nonVegStarters: '', vegMainCourse: '', nonVegMainCourse: '',
    rice: '', dal: '', salad: '', desserts: '', accompaniments: '',
  });
  const [expandedSections, setExpandedSections] = useState({
    event: true, guest: true, package: true, menu: true, addons: false, drinks: false, bar: false, signoff: false,
  });

  const canEdit = ['SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
  const isPresetMenu = form.packageType === 'Preset Menu';
  const selectedPkg = isPresetMenu ? null : (PACKAGES[form.packageType] || null);

  // Merge liquor overrides with selected package
  const effectivePkg = selectedPkg ? (() => {
    const lo = liquorOverrides[form.packageType];
    if (!lo) return selectedPkg;
    return {
      ...selectedPkg,
      drinks: lo.drinks || selectedPkg.drinks,
      cocktails: lo.cocktails !== undefined ? lo.cocktails : selectedPkg.cocktails,
      mocktails: lo.mocktails !== undefined ? lo.mocktails : selectedPkg.mocktails,
      softDrinks: lo.softDrinks !== undefined ? lo.softDrinks : selectedPkg.softDrinks,
    };
  })() : null;

  // Merge menu overrides with FULL_MENU
  const effectiveMenu = {};
  for (const catKey of MENU_CATEGORIES) {
    const def = FULL_MENU[catKey];
    const ov = menuOverrides[catKey];
    if (!ov) { effectiveMenu[catKey] = def; continue; }
    if (def.subcategories) {
      const mergedSubs = {};
      for (const subKey of Object.keys(def.subcategories)) {
        mergedSubs[subKey] = ov.subcategories?.[subKey] || def.subcategories[subKey];
      }
      effectiveMenu[catKey] = { ...def, subcategories: mergedSubs };
    } else {
      effectiveMenu[catKey] = { ...def, items: ov.items || def.items };
    }
  }

  // Compute effective limits = package defaults merged with admin overrides
  const getEffectiveLimit = useCallback((category) => {
    // Admin override takes priority
    if (fpOverrides[category] !== undefined && fpOverrides[category] !== null) {
      return fpOverrides[category];
    }
    // Otherwise use package default
    return selectedPkg?.limits[category] ?? 999;
  }, [fpOverrides, selectedPkg]);

  useEffect(() => {
    if (!isNew) fetchRecord();
    // Load F&P settings overrides + custom T&C
    notificationAPI.getFpSettings().then((res) => {
      const s = res.data.settings || {};
      setFpOverrides(s.overrides || {});
      if (s.customTc && s.customTc.length > 0) setCustomTc(s.customTc);
      if (s.liquorOverrides) setLiquorOverrides(s.liquorOverrides);
      if (s.menuOverrides) setMenuOverrides(s.menuOverrides);
    }).catch(() => {});

    // Auto-retrieve party details when creating a new F&P
    if (isNew && partyUniqueId) {
      setFetchingParty(true);
      partyAPI.lookup(partyUniqueId).then((res) => {
        const p = res.data.party || res.data.data || {};
        setForm((prev) => ({
          ...prev,
          dateOfBooking: p.enquiredAt ? p.enquiredAt.split('T')[0] : (p.date || prev.dateOfBooking),
          dateOfEvent: p.date || prev.dateOfEvent,
          dayOfEvent: p.day || prev.dayOfEvent || (() => {
            if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
              const d = new Date(p.date + 'T00:00:00');
              return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
            }
            return '';
          })(),
          allocatedArea: p.place || p.allocatedArea || prev.allocatedArea,
          advancePayment: p.totalAdvancePaid || p.advancePayment || prev.advancePayment,
          ratePerHead: p.finalRate || p.approxBillAmount || p.ratePerHead || prev.ratePerHead,
          minimumGuarantee: p.minimumGuarantee || p.expectedPax || prev.minimumGuarantee,
          contactPerson: p.hostName || prev.contactPerson,
          phone: p.phoneNumber || prev.phone,
          company: p.company || prev.company,
          paxExpected: p.expectedPax || prev.paxExpected,
          reference: p.handledBy || prev.reference,
          packageType: p.packageSelected || prev.packageType,
        }));
      }).catch(() => {}).finally(() => setFetchingParty(false));
    }
  }, [id]);

  // Auto-calculate Approx Bill Amount = Minimum Guarantee × Rate Per Head
  useEffect(() => {
    const minG = parseFloat(form.minimumGuarantee) || 0;
    const rate = parseFloat(form.ratePerHead) || 0;
    const approx = minG > 0 && rate > 0 ? Math.round(minG * rate) : '';
    setForm((prev) => {
      if (String(prev.approxBillAmount) === String(approx)) return prev;
      return { ...prev, approxBillAmount: approx };
    });
  }, [form.minimumGuarantee, form.ratePerHead]);

  // Auto-include accompaniments when package or preset menu is selected
  useEffect(() => {
    if ((selectedPkg && selectedPkg.limits.accompaniments > 0) || isPresetMenu) {
      const accItems = (effectiveMenu.accompaniments || FULL_MENU.accompaniments)?.items || [];
      setForm((prev) => ({ ...prev, accompaniments: [...accItems] }));
    }
  }, [form.packageType]);

  const fetchRecord = async () => {
    setLoading(true);
    try {
      const res = await fpAPI.getById(id);
      const data = res.data.data;
      setFpId(data.fpId || '');
      const mapped = { ...form };
      for (const key of Object.keys(mapped)) {
        if (data[key] !== undefined && data[key] !== null) mapped[key] = data[key];
      }
      const arrayFields = [
        ...MENU_CATEGORIES,
        'addonMuttonStarters', 'addonMuttonMainCourse',
        'addonPrawnsStarters', 'addonPrawnsMainCourse', 'addonExtras',
      ];
      arrayFields.forEach((f) => {
        if (!Array.isArray(mapped[f])) {
          try { mapped[f] = JSON.parse(mapped[f]); } catch { /* ignore */ }
          if (!Array.isArray(mapped[f])) {
            mapped[f] = mapped[f] ? String(mapped[f]).split(',').map((s) => s.trim()).filter(Boolean) : [];
          }
        }
      });
      // Parse otherItems — may be JSON object string or old plain text
      if (typeof mapped.otherItems === 'string') {
        try {
          const parsed = JSON.parse(mapped.otherItems);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            mapped.otherItems = parsed;
          } else {
            mapped.otherItems = {};
          }
        } catch {
          // Old format: plain text — migrate to empty object (old data lost but was freeform)
          mapped.otherItems = {};
        }
      }
      if (!mapped.otherItems || typeof mapped.otherItems !== 'object') mapped.otherItems = {};
      // Parse boolean fields (stored as strings in Sheets)
      ['showSpiceLevels', 'jainFood', 'veganFood'].forEach((bf) => {
        if (typeof mapped[bf] === 'string') mapped[bf] = mapped[bf] === 'true';
      });
      setForm(mapped);
      // Restore preset menu text if this was a preset menu
      if (mapped.packageType === 'Preset Menu' && data.presetMenuText) {
        try {
          const pmt = typeof data.presetMenuText === 'string' ? JSON.parse(data.presetMenuText) : data.presetMenuText;
          setPresetMenuText((prev) => ({ ...prev, ...pmt }));
        } catch { /* ignore */ }
      }
    } catch {
      setError('Failed to load F&P record.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'dateOfEvent' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const d = new Date(value + 'T00:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        updated.dayOfEvent = days[d.getDay()];
      }
      if (field === 'packageType') {
        const pkg = PACKAGES[value];
        if (pkg) {
          MENU_CATEGORIES.forEach((cat) => {
            if (AUTO_INCLUDE_CATEGORIES.includes(cat)) return;
            // Use admin override if set, otherwise package default
            const limit = fpOverrides[cat] !== undefined ? fpOverrides[cat] : (pkg.limits[cat] || 0);
            if (limit === 0) updated[cat] = [];
            else if (updated[cat].length > limit) updated[cat] = updated[cat].slice(0, limit);
          });
        }
      }
      return updated;
    });
  }, []);

  const toggleMenuItem = useCallback((category, itemName) => {
    if (!canEdit) return;
    setForm((prev) => {
      const pkg = PACKAGES[prev.packageType];
      // Use admin override if set, otherwise package default
      const limit = fpOverrides[category] !== undefined ? fpOverrides[category] : (pkg?.limits[category] ?? 99);
      const current = prev[category] || [];
      if (current.includes(itemName)) {
        return { ...prev, [category]: current.filter((i) => i !== itemName) };
      }
      if (current.length >= limit) return prev;
      return { ...prev, [category]: [...current, itemName] };
    });
  }, [canEdit, fpOverrides]);

  const toggleAddon = useCallback((field, itemName) => {
    if (!canEdit) return;
    setForm((prev) => {
      const current = prev[field] || [];
      if (current.includes(itemName)) {
        return { ...prev, [field]: current.filter((i) => i !== itemName) };
      }
      return { ...prev, [field]: [...current, itemName] };
    });
  }, [canEdit]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      // Stringify otherItems object for storage
      if (payload.otherItems && typeof payload.otherItems === 'object') {
        payload.otherItems = JSON.stringify(payload.otherItems);
      }
      // Include preset menu text for Preset Menu type
      if (isPresetMenu) {
        payload.presetMenuText = JSON.stringify(presetMenuText);
      }
      if (isNew) {
        if (!partyUniqueId) { setError('Party ID is required.'); setSaving(false); return; }
        const res = await fpAPI.create({ partyUniqueId, ...payload });
        navigate(`/fp/${res.data.data.rowIndex}`, { replace: true });
      } else {
        await fpAPI.update(id, payload);
        await fetchRecord();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save F&P record.';
      const validationErrs = err.response?.data?.errors;
      const detail = validationErrs ? validationErrs.map((e) => e.msg || e.message).join(', ') : '';
      setError(detail ? `${msg} (${detail})` : msg);
    } finally {
      setSaving(false);
    }
  };

  const activeTc = customTc || DISCLAIMERS;
  const handleDownloadPdf = () => generateFpPdf({ ...form, fpId, selectedPkg: effectivePkg, customTc: activeTc, presetMenuText: isPresetMenu ? presetMenuText : null });

  const handleSendEmail = async () => {
    if (!form.phone && !form.contactPerson) {
      setError('Contact details required to send email.');
      return;
    }
    const emailTo = prompt('Enter email address to send F&P PDF:');
    if (!emailTo || !emailTo.includes('@')) return;
    setSendingEmail(true);
    setError('');
    try {
      await fpAPI.sendEmail(id, { to: emailTo });
      setSuccess(`F&P email sent to ${emailTo}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send email.';
      setError(msg);
    } finally {
      setSendingEmail(false);
    }
  };
  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
      </div>
    );
  }

  // ---- Shorthand helpers that pass component state as props ----
  const fieldProps = (field, extra = {}) => ({ field, value: form[field], onChange: updateField, canEdit, ...extra });
  const sectionProps = (key) => ({ sectionKey: key, expanded: expandedSections[key], onToggle: toggleSection });

  // Render a full menu category inline (fixes scroll issue)
  const renderMenuCategory = (categoryKey) => {
    const catDef = effectiveMenu[categoryKey] || FULL_MENU[categoryKey];
    if (!catDef) return null;

    const isAutoInclude = AUTO_INCLUDE_CATEGORIES.includes(categoryKey);
    const limitNum = getEffectiveLimit(categoryKey);
    const selected = form[categoryKey] || [];
    const atLimit = selected.length >= limitNum;

    // Other item input for this category
    const otherVal = (form.otherItems || {})[categoryKey] || '';
    const otherTags = otherVal.split(',').map((s) => s.trim()).filter(Boolean);
    const otherItemInput = (
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-500 font-semibold shrink-0">+ Other:</span>
          <input
            type="text"
            value={otherVal}
            onChange={(e) => {
              const updated = { ...(form.otherItems || {}), [categoryKey]: e.target.value };
              updateField('otherItems', updated);
            }}
            readOnly={!canEdit}
            placeholder={`Guest request items (comma separated)...`}
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30 placeholder:text-gray-300"
          />
        </div>
        {otherTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 ml-12">
            {otherTags.map((tag, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800 font-medium">
                {tag} <span className="text-amber-400">*</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );

    // Auto-included: show as static list
    if (isAutoInclude) {
      const items = catDef.items || [];
      return (
        <div key={categoryKey} className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{catDef.label}</h4>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">All Included</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <span key={item} className="px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                {item}
              </span>
            ))}
          </div>
          {otherItemInput}
        </div>
      );
    }

    return (
      <div key={categoryKey} className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{catDef.label}</h4>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            selected.length === limitNum ? 'bg-green-100 text-green-700' :
            selected.length > limitNum ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {selected.length} / {limitNum}
          </span>
        </div>

        {catDef.subcategories ? (
          Object.entries(catDef.subcategories).map(([subName, items]) => (
            <div key={subName} className="mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5 pl-1">{subName}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {items.map((item) => {
                  const isSelected = selected.includes(item);
                  const dis = !isSelected && atLimit;
                  return (
                    <ItemCheck
                      key={item}
                      item={item}
                      selected={isSelected}
                      disabled={dis || !canEdit}
                      onToggle={() => toggleMenuItem(categoryKey, item)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {catDef.items.map((item) => {
              const isSelected = selected.includes(item);
              const dis = !isSelected && atLimit;
              return (
                <ItemCheck
                  key={item}
                  item={item}
                  selected={isSelected}
                  disabled={dis || !canEdit}
                  onToggle={() => toggleMenuItem(categoryKey, item)}
                />
              );
            })}
          </div>
        )}
        {otherItemInput}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{isNew ? 'New F&P' : 'Edit F&P'}</h1>
            {fpId && <span className="text-xs font-mono text-gray-400">{fpId}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isNew && (
            <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors min-h-[44px]">
              <Download className="w-4 h-4" /> PDF
            </button>
          )}
          {!isNew && canEdit && (
            <button onClick={handleSendEmail} disabled={sendingEmail} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 min-h-[44px]">
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Email
            </button>
          )}
          {canEdit && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50 min-h-[44px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save F&P'}
            </button>
          )}
        </div>
      </div>

      {fetchingParty && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Retrieving party details...
        </div>
      )}
      {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2"><Check className="w-4 h-4" />{success}</div>}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border-2 border-red-300 text-sm text-red-700 flex items-start gap-2">
          <span className="text-red-500 font-bold shrink-0 mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="font-semibold">Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0 ml-2 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Status + Package */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={form.status} onChange={(e) => updateField('status', e.target.value)} disabled={!canEdit}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#af4408]/30">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Package / Menu Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {/* Preset Menu option */}
              <button onClick={() => canEdit && updateField('packageType', 'Preset Menu')} disabled={!canEdit}
                className={`px-2 py-2 rounded-lg text-[11px] font-medium border transition-all text-center leading-tight ${
                  isPresetMenu ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50'
                }`}>
                <div className="font-semibold">Preset Menu</div>
                <div className="opacity-70 text-[10px]">Custom</div>
              </button>
              {Object.entries(PACKAGES).map(([key, pkg]) => (
                <button key={key} onClick={() => canEdit && updateField('packageType', key)} disabled={!canEdit}
                  className={`px-2 py-2 rounded-lg text-[11px] font-medium border transition-all text-center leading-tight ${
                    form.packageType === key ? 'bg-[#af4408] text-white border-[#af4408] shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-[#af4408]/40 hover:bg-[#af4408]/5'
                  }`}>
                  <div className="font-semibold">{pkg.label}</div>
                  <div className="opacity-70 text-[10px]">{pkg.price}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        {isPresetMenu && (
          <div className="mt-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-[11px] text-emerald-800">
              <strong>Preset Menu</strong> — Not a package. Write in menu items manually (fill-in-the-blanks). Ideal for small parties below 30 pax.
            </p>
          </div>
        )}
        {selectedPkg && (
          <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-[11px] text-amber-800">
              <strong>{selectedPkg.label}</strong> — Serving: {selectedPkg.serving}
              {selectedPkg.limits.nonVegStarters === 0 && ' | Veg Only'}
            </p>
          </div>
        )}
        {partyUniqueId && isNew && <p className="text-xs text-gray-400 mt-2">Creating for party: <span className="font-mono">{partyUniqueId}</span></p>}

        {/* Food Preferences: Spice Levels + Jain/Vegan */}
        {(selectedPkg || isPresetMenu) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">🌶️ Food Preferences</p>
            <div className="flex flex-wrap items-start gap-4">
              {/* Spice Levels Toggle */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showSpiceLevels || false}
                    onChange={(e) => {
                      updateField('showSpiceLevels', e.target.checked);
                      if (!e.target.checked) updateField('spiceLevel', '');
                    }}
                    disabled={!canEdit}
                    className="w-4 h-4 rounded border-gray-300 text-[#af4408] focus:ring-[#af4408]/30"
                  />
                  <span className="text-xs font-medium text-gray-700">Show Spice Levels</span>
                </label>
                {form.showSpiceLevels && (
                  <select
                    value={form.spiceLevel || ''}
                    onChange={(e) => updateField('spiceLevel', e.target.value)}
                    disabled={!canEdit}
                    className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 text-xs font-medium text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  >
                    <option value="">Select Level</option>
                    <option value="Mild">🟢 Mild</option>
                    <option value="Medium">🟡 Medium</option>
                    <option value="Spicy">🟠 Spicy</option>
                    <option value="Extra Spicy">🔴 Extra Spicy</option>
                  </select>
                )}
              </div>

              {/* Jain Food */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.jainFood || false}
                    onChange={(e) => {
                      updateField('jainFood', e.target.checked);
                      if (!e.target.checked) updateField('jainFoodPax', '');
                    }}
                    disabled={!canEdit}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500/30"
                  />
                  <span className="text-xs font-medium text-gray-700">Jain Food</span>
                </label>
                {form.jainFood && (
                  <input
                    type="number"
                    value={form.jainFoodPax || ''}
                    onChange={(e) => updateField('jainFoodPax', e.target.value)}
                    disabled={!canEdit}
                    placeholder="Pax"
                    className="w-16 px-2 py-1 rounded-lg border border-green-300 bg-green-50 text-xs font-medium text-green-800 text-center focus:outline-none focus:ring-2 focus:ring-green-400/30 placeholder:text-green-400"
                  />
                )}
              </div>

              {/* Vegan Food */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.veganFood || false}
                    onChange={(e) => {
                      updateField('veganFood', e.target.checked);
                      if (!e.target.checked) updateField('veganFoodPax', '');
                    }}
                    disabled={!canEdit}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30"
                  />
                  <span className="text-xs font-medium text-gray-700">Vegan Food</span>
                </label>
                {form.veganFood && (
                  <input
                    type="number"
                    value={form.veganFoodPax || ''}
                    onChange={(e) => updateField('veganFoodPax', e.target.value)}
                    disabled={!canEdit}
                    placeholder="Pax"
                    className="w-16 px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-medium text-emerald-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-400/30 placeholder:text-emerald-400"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Event Details */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('event')} title="Event Details" icon="📅" />
          {expandedSections.event && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field {...fieldProps('dateOfBooking')} label="Date of Booking" type="date" />
                <Field {...fieldProps('dateOfEvent')} label="Date of Event" type="date" />
                <Field {...fieldProps('dayOfEvent')} label="Day of Event" readOnly />
                <Field {...fieldProps('timeOfEvent')} label="Time of Event" placeholder="e.g. 7:00 PM" />
                <Field {...fieldProps('allocatedArea')} label="Allocated Area" placeholder="e.g. Hall A, Terrace" />
                <Field {...fieldProps('advancePayment')} label="Advance Payment" placeholder="₹" />
                <Field {...fieldProps('ratePerHead')} label="Rate Per Head" placeholder="₹" />
                <Field {...fieldProps('minimumGuarantee')} label="Minimum Guarantee" placeholder="Min pax" />
                <Field {...fieldProps('modeOfPayment')} label="Mode of Payment" placeholder="e.g. Cash, UPI, Card" />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Approx Bill Amount</label>
                  <div className="w-full px-3 py-2 rounded-lg border border-dashed border-green-300 bg-green-50 text-sm font-bold text-green-800">
                    {form.approxBillAmount ? `₹${Number(form.approxBillAmount).toLocaleString('en-IN')}` : '—'}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Auto: Min Guarantee × Rate/Head</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Guest & Contact */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('guest')} title="Guest & Contact" icon="👤" />
          {expandedSections.guest && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field {...fieldProps('contactPerson')} label="Guest / Contact Name" />
                <Field {...fieldProps('phone')} label="Phone" />
                <Field {...fieldProps('company')} label="Company" />
                <Field {...fieldProps('paxExpected')} label="Pax Expected" />
                <Field {...fieldProps('reference')} label="Reference" />
              </div>
            </div>
          )}
        </div>

        {/* Menu Selection — inline rendered to prevent scroll jump */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('menu')} title="Menu Selection" icon="🍽️" badge={isPresetMenu ? 'Preset Menu (Write-In)' : selectedPkg ? selectedPkg.label : 'Select package first'} />
          {expandedSections.menu && (
            <div className="px-5 pb-5 border-t border-gray-100 mt-4">
              {!selectedPkg && !isPresetMenu ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Please select a package or Preset Menu first.
                </div>
              ) : isPresetMenu ? (
                /* Preset Menu — Fill in the blanks for each category */
                <div>
                  <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-800">
                      <strong>Preset Menu</strong> — Write in menu items for each category. One item per line.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'vegStarters', label: 'Veg Starters' },
                      { key: 'nonVegStarters', label: 'Non-Veg Starters' },
                      { key: 'vegMainCourse', label: 'Veg Main Course' },
                      { key: 'nonVegMainCourse', label: 'Non-Veg Main Course' },
                      { key: 'rice', label: 'Rice' },
                      { key: 'dal', label: 'Dal' },
                      { key: 'salad', label: 'Salad' },
                      { key: 'desserts', label: 'Desserts' },
                      { key: 'accompaniments', label: 'Accompaniments' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">{label}</label>
                        <textarea
                          value={presetMenuText[key] || ''}
                          onChange={(e) => setPresetMenuText((prev) => ({ ...prev, [key]: e.target.value }))}
                          readOnly={!canEdit}
                          rows={3}
                          placeholder={`Enter ${label.toLowerCase()} items (one per line)...`}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 placeholder:text-gray-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                MENU_CATEGORIES.map((cat) => {
                  const limit = getEffectiveLimit(cat);
                  if (limit === 0 && !AUTO_INCLUDE_CATEGORIES.includes(cat)) return null;
                  return renderMenuCategory(cat);
                })
              )}

              {/* General Other Item — for items outside any category */}
              {(selectedPkg || isPresetMenu) && (
                <div className="mt-5 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">📝 Other Item (Outside Menu)</h4>
                    <span className="text-[10px] text-gray-400">Item not in any category above</span>
                  </div>
                  <input
                    type="text"
                    value={(form.otherItems || {})._general || ''}
                    onChange={(e) => {
                      const updated = { ...(form.otherItems || {}), _general: e.target.value };
                      updateField('otherItems', updated);
                    }}
                    readOnly={!canEdit}
                    placeholder="Any other guest request not listed above..."
                    className="w-full px-3 py-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 placeholder:text-gray-300"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Addons */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('addons')} title="Addons (Extra Charges)" icon="➕" />
          {expandedSections.addons && (
            <div className="px-5 pb-5 border-t border-gray-100 mt-4 space-y-5">
              {/* Mutton */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-1">🐑 Mutton Addons <span className="font-normal text-gray-400">(₹{ADDONS.mutton.pricePerHead}/person)</span></h4>
                <p className="text-[10px] text-gray-400 mb-2">Starters</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
                  {ADDONS.mutton.starters.map((item) => (
                    <ItemCheck key={item} item={item} selected={(form.addonMuttonStarters || []).includes(item)} disabled={!canEdit} color="orange" onToggle={() => toggleAddon('addonMuttonStarters', item)} />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mb-2">Main Course</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {ADDONS.mutton.mainCourse.map((item) => (
                    <ItemCheck key={item} item={item} selected={(form.addonMuttonMainCourse || []).includes(item)} disabled={!canEdit} color="orange" onToggle={() => toggleAddon('addonMuttonMainCourse', item)} />
                  ))}
                </div>
              </div>

              {/* Prawns */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-1">🦐 Prawns Addons <span className="font-normal text-gray-400">(₹{ADDONS.prawns.pricePerHead}/person)</span></h4>
                <p className="text-[10px] text-gray-400 mb-2">Starters</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
                  {ADDONS.prawns.starters.map((item) => (
                    <ItemCheck key={item} item={item} selected={(form.addonPrawnsStarters || []).includes(item)} disabled={!canEdit} color="orange" onToggle={() => toggleAddon('addonPrawnsStarters', item)} />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mb-2">Main Course</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {ADDONS.prawns.mainCourse.map((item) => (
                    <ItemCheck key={item} item={item} selected={(form.addonPrawnsMainCourse || []).includes(item)} disabled={!canEdit} color="orange" onToggle={() => toggleAddon('addonPrawnsMainCourse', item)} />
                  ))}
                </div>
              </div>

              {/* Extra Addons */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">📋 Extra Addons</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {ADDONS.extras.items.map((addon) => {
                    const sel = (form.addonExtras || []).includes(addon.name);
                    return (
                      <label key={addon.name} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        sel ? 'bg-orange-50 border-orange-300 text-orange-900 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={sel} onChange={() => toggleAddon('addonExtras', addon.name)} className="sr-only" disabled={!canEdit} />
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>
                            {sel && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span>{addon.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-400">₹{addon.price}/pp</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drinks (read-only per package) + Bar Timing + Bar Notes */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('drinks')} title="Drinks & Bar" icon="🍷" badge={isPresetMenu ? 'Preset Menu' : effectivePkg ? `${effectivePkg.serving} Serving` : null} />
          {expandedSections.drinks && (
            <div className="px-5 pb-5 border-t border-gray-100 mt-4">
              {isPresetMenu ? (
                <p className="text-sm text-gray-500 mb-3">Preset Menu — drinks will be arranged as discussed.</p>
              ) : !effectivePkg ? (
                <p className="text-sm text-gray-400 italic">Select a package to see included drinks.</p>
              ) : effectivePkg.drinks.length === 0 && !effectivePkg.mocktails ? (
                <p className="text-sm text-gray-400 italic">No alcoholic drinks included in this package.</p>
              ) : (
                <>
                  {effectivePkg.drinks.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold text-gray-700 mb-2 uppercase">Alcoholic Drinks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {effectivePkg.drinks.map((d) => (
                          <span key={d} className="px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-800">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
                    {effectivePkg.cocktails && <span className="px-2 py-1 bg-pink-50 border border-pink-200 rounded-lg">{effectivePkg.cocktails}</span>}
                    {effectivePkg.mocktails && <span className="px-2 py-1 bg-green-50 border border-green-200 rounded-lg">{effectivePkg.mocktails}</span>}
                    {effectivePkg.softDrinks && <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg">{effectivePkg.softDrinks}</span>}
                  </div>
                </>
              )}

              {/* Bar Timing & Notes (moved from Entertainment) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <Field {...fieldProps('drinksStartTime')} label="Drinks Start Time" placeholder="e.g. 7:00 PM" />
                <Field {...fieldProps('drinksEndTime')} label="Drinks End Time" placeholder="e.g. 10:00 PM" />
              </div>
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">Bar Notes</label>
                <textarea value={form.barNotes || ''} onChange={(e) => updateField('barNotes', e.target.value)} readOnly={!canEdit} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                  placeholder="Additional bar instructions..." />
              </div>

              <div className="mt-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-[11px] text-yellow-800 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Drinks are subject to availability. Not included: Breezer, Shots, Redbull, Ginger Ale & Tonic Water.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Entertainment & Arrangements (without drink timing/bar notes) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('bar')} title="Entertainment & Arrangements" icon="🎵" />
          {expandedSections.bar && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field {...fieldProps('dj')} label="DJ" placeholder="Yes / No / Details" />
                <Field {...fieldProps('mc')} label="MC (Emcee)" placeholder="Yes / No / Name" />
                <Field {...fieldProps('mics')} label="Mics" placeholder="e.g. 2 wireless" />
                <Field {...fieldProps('decor')} label="Decor" placeholder="Decor details" />
                <Field {...fieldProps('seatingArrangements')} label="Seating Arrangements" placeholder="e.g. Round tables" />
              </div>
            </div>
          )}
        </div>

        {/* Sign-off */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <SectionBtn {...sectionProps('signoff')} title="Sign-Off & Distribution" icon="✍️" />
          {expandedSections.signoff && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Field {...fieldProps('fpMadeBy')} label="F&P Made By" />
                <Field {...fieldProps('managerName')} label="Manager Name" />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Guest Name (Sign-off)</label>
                  <div className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-600">
                    {form.contactPerson || '—'}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Auto-filled from Guest / Contact Name</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Department Distribution</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { field: 'kitchenDept', label: 'Kitchen' },
                    { field: 'serviceDept', label: 'Service' },
                    { field: 'barDept', label: 'Bar' },
                    { field: 'storesDept', label: 'Stores' },
                    { field: 'maintenance', label: 'Maintenance' },
                    { field: 'frontOffice', label: 'Front Office' },
                  ].map(({ field, label }) => (
                    <div key={field}>
                      <label className="block text-xs text-gray-400 mb-1">{label}</label>
                      <input type="text" value={form[field] || ''} onChange={(e) => updateField(field, e.target.value)} readOnly={!canEdit}
                        placeholder="Name / Signature"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#af4408]/30" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* T&C */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Terms & Conditions</p>
          <ul className="space-y-1">
            {activeTc.map((t, i) => <li key={i} className="text-[11px] text-gray-500">{t}</li>)}
          </ul>
        </div>
      </div>

      {/* Bottom save bar */}
      {canEdit && (
        <div className="sticky bottom-0 mt-6 py-4 bg-[#FFF8F0]/90 backdrop-blur border-t border-gray-200 flex items-center justify-end gap-3">
          <button onClick={() => navigate(-1)} className="px-4 py-2.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save F&P'}
          </button>
        </div>
      )}
    </div>
  );
}
