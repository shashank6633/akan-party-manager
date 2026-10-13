import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Loader2, RefreshCw, Copy, Check, MessageCircle, Activity, CalendarClock, CalendarRange, Eye, EyeOff,
} from 'lucide-react';
import { partyAPI } from '../services/api';
import { copyToClipboard } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

import {
  TITLES, fmtDate, todayNote, upcomingNote, extrasLine, whatsappShareUrl,
  buildTodayText, buildNext7Text, buildNext30Text, buildFullText,
} from '../utils/dailySummaryText';

const STATUS_PILL = {
  Confirmed: 'bg-green-100 text-green-800',
  Tentative: 'bg-blue-100 text-blue-800',
  Contacted: 'bg-purple-100 text-purple-800',
  Enquiry: 'bg-amber-100 text-amber-800',
  Cancelled: 'bg-red-100 text-red-800',
  'Ala Carte': 'bg-teal-100 text-teal-800',
};

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
function CopyButton({ text, label = 'Copy', id, copiedId, onCopy }) {
  const done = copiedId === id;
  return (
    <button
      onClick={() => onCopy(id, text)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
        done ? 'bg-green-600 text-white' : 'bg-[#af4408]/10 text-[#af4408] hover:bg-[#af4408]/20'
      }`}
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

// Same 3 lines as the WhatsApp text: name – company / date · phone / 📝 note
function PartyCard({ p, note, onOpen }) {
  const when = p.daysAway === 0 ? 'Today' : p.daysAway === 1 ? 'Tomorrow' : '';
  return (
    <div
      onClick={() => onOpen(p)}
      className="p-3 rounded-lg border border-gray-200 bg-white hover:border-[#af4408]/40 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 truncate min-w-0">
          {p.hostName || 'Unnamed'}
          {p.company && <span className="font-normal text-gray-500"> – {p.company}</span>}
        </p>
        {p.status && (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_PILL[p.status] || 'bg-gray-100 text-gray-700'}`}>
            {p.status}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5">
        📅 {fmtDate(p.date)}
        {when && <> · <span className="font-semibold text-[#af4408]">{when}</span></>}
        {p.phoneNumber && <> · 📞 {p.phoneNumber}</>}
      </p>
      {p.extras?.length > 0 && (
        <p className="text-[11px] text-gray-500 mt-0.5">ℹ️ {extrasLine(p)}</p>
      )}
      <p className={`mt-1 text-[11px] ${note === 'No follow-up yet' ? 'text-amber-600 italic' : 'text-gray-600'}`}>
        📝 {note || '—'}
      </p>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, count, text, id, copiedId, onCopy, children }) {
  const [showText, setShowText] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#af4408]/10"><Icon className="w-4 h-4 text-[#af4408]" /></div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">{title} <span className="text-gray-400 font-medium">({count})</span></h3>
            {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowText((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 min-h-[36px]"
            title="Preview the exact WhatsApp text"
          >
            {showText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showText ? 'Hide text' : 'Preview text'}</span>
          </button>
          <CopyButton text={text} id={id} copiedId={copiedId} onCopy={onCopy} />
        </div>
      </div>
      {showText && (
        <pre className="mx-4 mt-3 p-3 rounded-lg bg-[#e7f6e7] border border-green-200 text-[11px] text-gray-800 whitespace-pre-wrap break-words font-sans max-h-80 overflow-y-auto">
          {text}
        </pre>
      )}
      <div className="p-4 space-y-2">
        {count === 0 ? <p className="text-xs text-gray-400 italic text-center py-4">Nothing here.</p> : children}
      </div>
    </div>
  );
}

export default function DailySummary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await partyAPI.getDailySummary();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load daily summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCopy = async (id, text) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1800);
    }
  };

  const openParty = (p) => {
    if (p.rowIndex) navigate(`/parties/${p.rowIndex}`, { state: { from: 'daily-summary' } });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#af4408]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button onClick={() => load()} className="px-4 py-2 rounded-lg bg-[#af4408] text-white text-sm font-semibold">Retry</button>
      </div>
    );
  }

  const todayText = buildTodayText(data);
  const next7Text = buildNext7Text(data);
  const next30Text = buildNext30Text(data);
  const fullText = buildFullText(data);
  const range = (r) => (r ? `${fmtDate(r.from)} → ${fmtDate(r.to)}` : '');
  // Older backends don't send settings — fall back to the original default
  const hidden = data.settings?.hiddenStatuses ?? ['Confirmed', 'Cancelled', 'Ala Carte'];
  const hiddenNote = hidden.length === 0
    ? 'All statuses shown'
    : `${hidden.length === 1 ? hidden[0] : `${hidden.slice(0, -1).join(', ')} & ${hidden[hidden.length - 1]}`} hidden`;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Daily Summary</h2>
          <p className="text-xs text-gray-500">
            {fmtDate(data.today)} · {hiddenNote}
            {isAdmin && (
              <> · <Link to="/settings?tab=daily-summary" className="text-[#af4408] font-semibold hover:underline">Change in Settings</Link></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 min-h-[36px] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <CopyButton text={fullText} label="Copy Full Summary" id="all" copiedId={copiedId} onCopy={onCopy} />
          <a
            href={whatsappShareUrl(fullText)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 min-h-[36px]"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Share on WhatsApp
          </a>
        </div>
      </div>

      <Section
        icon={Activity}
        title={TITLES.today}
        count={data.todayActivity.length}
        text={todayText}
        id="today"
        copiedId={copiedId}
        onCopy={onCopy}
      >
        {data.todayActivity.map((p) => (
          <PartyCard key={p.uniqueId} p={p} note={todayNote(p, data.today)} onOpen={openParty} />
        ))}
      </Section>

      <Section
        icon={CalendarClock}
        title={TITLES.next7}
        subtitle={range(data.ranges?.next7)}
        count={data.next7.length}
        text={next7Text}
        id="next7"
        copiedId={copiedId}
        onCopy={onCopy}
      >
        {data.next7.map((p) => (
          <PartyCard key={p.uniqueId || p.rowIndex} p={p} note={upcomingNote(p)} onOpen={openParty} />
        ))}
      </Section>

      <Section
        icon={CalendarRange}
        title={TITLES.next30}
        subtitle={range(data.ranges?.next30)}
        count={data.next30.length}
        text={next30Text}
        id="next30"
        copiedId={copiedId}
        onCopy={onCopy}
      >
        {data.next30.map((p) => (
          <PartyCard key={p.uniqueId || p.rowIndex} p={p} note={upcomingNote(p)} onOpen={openParty} />
        ))}
      </Section>
    </div>
  );
}
