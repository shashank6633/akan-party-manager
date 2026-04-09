import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Loader2,
  Plus,
  Trash2,
  Users,
  Phone,
  User,
  Building2,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  UserPlus,
} from 'lucide-react';
import { partyAPI, guestContactAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';

export default function GuestContacts() {
  const { user } = useAuth();
  const canAdd = ['GRE', 'SALES', 'MANAGER', 'ADMIN'].includes(user?.role);

  // Tabs
  const [activeTab, setActiveTab] = useState(canAdd ? 'add' : 'list');

  // Add tab — party selection
  const [recentParties, setRecentParties] = useState([]);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);

  // Add tab — guest entries
  // Each contact: { guestName, guestPhone, saved, rowIndex (from sheet), locked (loaded from API, cannot edit) }
  const [contacts, setContacts] = useState([{ guestName: '', guestPhone: '', saved: false, rowIndex: null, locked: false }]);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimers = useRef({});
  const savingRows = useRef(new Set());

  // List tab
  const [allContacts, setAllContacts] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [expandedParty, setExpandedParty] = useState(null);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Stats
  const [stats, setStats] = useState(null);

  // Load recent parties on mount (for easy selection)
  useEffect(() => {
    if (canAdd) loadRecentParties();
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'list') fetchContacts();
  }, [activeTab]);

  const loadRecentParties = async () => {
    setPartiesLoading(true);
    try {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const res = await partyAPI.getAll({ limit: 200, order: 'desc', status: 'Confirmed', dateTo: todayStr });
      setRecentParties(res.data.parties || []);
    } catch { /* ignore */ }
    finally { setPartiesLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await guestContactAPI.getStats();
      setStats(res.data.stats);
    } catch { /* ignore */ }
  };

  const fetchContacts = async () => {
    setListLoading(true);
    try {
      const params = {};
      if (listSearch) params.search = listSearch;
      const res = await guestContactAPI.getAll(params);
      setAllContacts(res.data.data || []);
    } catch {
      setError('Failed to fetch contacts.');
    } finally {
      setListLoading(false);
    }
  };

  const selectParty = async (p) => {
    setSelectedParty(p);
    setError('');
    // Clear any pending auto-save timers
    Object.values(autoSaveTimers.current).forEach(clearTimeout);
    autoSaveTimers.current = {};
    savingRows.current.clear();

    // Fetch existing contacts for this party
    let existingContacts = [];
    try {
      const res = await guestContactAPI.getAll({ partyId: p.uniqueId });
      existingContacts = (res.data.data || []).map((c) => ({
        guestName: c.guestName || '',
        guestPhone: c.guestPhone || '',
        saved: true,
        rowIndex: c.rowIndex || null,
        locked: true, // Loaded from API — cannot edit
      }));
    } catch { /* ignore */ }

    // Calculate remaining empty rows
    const pax = parseInt(p.confirmedPax) || parseInt(p.expectedPax) || 5;
    const remaining = Math.max(pax - existingContacts.length, 3);
    const emptyRows = Array.from({ length: remaining }, () => ({ guestName: '', guestPhone: '', saved: false, rowIndex: null, locked: false }));

    setContacts([...existingContacts, ...emptyRows]);
  };

  const addContactRow = () => {
    setContacts((prev) => [...prev, { guestName: '', guestPhone: '', saved: false, rowIndex: null, locked: false }]);
  };

  const removeContactRow = (index) => {
    if (autoSaveTimers.current[index]) clearTimeout(autoSaveTimers.current[index]);
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  // Ref to always have latest contacts for auto-save reads
  const contactsRef = useRef(contacts);
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  // Auto-save a single row (create new or update existing)
  const autoSaveRow = useCallback(async (index) => {
    if (!selectedParty) return;
    if (savingRows.current.has(index)) return;

    // Read current contact data from ref (always up-to-date)
    const c = contactsRef.current[index];
    if (!c || c.locked || !c.guestName?.trim() || !c.guestPhone || c.guestPhone.length !== 10) return;

    const contactData = { guestName: c.guestName, guestPhone: c.guestPhone };

    savingRows.current.add(index);
    setAutoSaving(true);

    try {
      if (c.saved && c.rowIndex) {
        // Update existing row
        await guestContactAPI.update(c.rowIndex, {
          ...contactData,
          partyUniqueId: selectedParty.uniqueId,
          partyDate: selectedParty.date || '',
          hostName: selectedParty.hostName || '',
          company: selectedParty.company || '',
        });
        setContacts((prev) => prev.map((r, i) => i === index ? { ...r, saved: true } : r));
      } else if (!c.saved) {
        // Create new row
        const res = await guestContactAPI.create({
          partyUniqueId: selectedParty.uniqueId,
          partyDate: selectedParty.date || '',
          hostName: selectedParty.hostName || '',
          company: selectedParty.company || '',
          contacts: [contactData],
        });
        // Get the rowIndex from the returned contacts
        const savedContacts = res.data.contacts || [];
        const match = savedContacts.find((sc) =>
          sc.guestName === contactData.guestName && sc.guestPhone === contactData.guestPhone
        );
        setContacts((prev) => prev.map((r, i) => i === index ? { ...r, saved: true, rowIndex: match?.rowIndex || null } : r));
      }
      fetchStats();
    } catch (err) {
      console.error('Auto-save failed:', err);
      setError('Auto-save failed. Please try again.');
    } finally {
      savingRows.current.delete(index);
      setAutoSaving(false);
    }
  }, [selectedParty]);

  const updateContact = (index, field, value) => {
    setContacts((prev) => prev.map((c, i) => {
      if (i !== index) return c;
      // If locked (loaded from API / previous session), don't allow edit
      if (c.locked) return c;
      return { ...c, [field]: value };
    }));

    // Debounced auto-save: 1.5s after last keystroke
    if (autoSaveTimers.current[index]) clearTimeout(autoSaveTimers.current[index]);
    autoSaveTimers.current[index] = setTimeout(() => {
      autoSaveRow(index);
    }, 1500);
  };

  const handleDelete = async (rowIndex) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await guestContactAPI.delete(rowIndex);
      setAllContacts((prev) => prev.filter((c) => c.rowIndex !== rowIndex));
      fetchStats();
    } catch {
      setError('Failed to delete contact.');
    }
  };

  // Filter parties by search
  const filteredParties = recentParties.filter((p) => {
    if (!partySearch) return true;
    const s = partySearch.toLowerCase();
    return (
      (p.hostName || '').toLowerCase().includes(s) ||
      (p.company || '').toLowerCase().includes(s) ||
      (p.phoneNumber || '').includes(s) ||
      (p.uniqueId || '').toLowerCase().includes(s)
    );
  });

  // Group contacts by party for list view
  const groupedContacts = {};
  allContacts.forEach((c) => {
    const key = c.partyUniqueId || 'Unknown';
    if (!groupedContacts[key]) {
      groupedContacts[key] = {
        partyUniqueId: c.partyUniqueId,
        partyDate: c.partyDate,
        hostName: c.hostName,
        company: c.company,
        contacts: [],
      };
    }
    groupedContacts[key].contacts.push(c);
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guest Contacts</h1>
          <p className="text-sm text-gray-500">Store guest details collected at the entrance</p>
        </div>
        {stats && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {stats.totalContacts} contacts</span>
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {stats.partiesWithContacts} parties</span>
          </div>
        )}
      </div>

      {/* Messages */}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {canAdd && (
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
              activeTab === 'add' ? 'bg-white text-[#af4408] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Add Contacts
          </button>
        )}
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors ${
            activeTab === 'list' ? 'bg-white text-[#af4408] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" /> All Contacts
        </button>
      </div>

      {/* ==================== ADD TAB ==================== */}
      {activeTab === 'add' && canAdd && (
        <div className="space-y-5">

          {/* Step 1: Select Party */}
          {!selectedParty ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Step 1: Select Party</h3>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  placeholder="Search by Host Name, Company, Phone..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30 focus:border-[#af4408] transition-colors"
                />
              </div>

              {/* Party list */}
              {partiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : filteredParties.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">No parties found</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredParties.map((p) => (
                    <button
                      key={p.rowIndex || p.uniqueId}
                      onClick={() => selectParty(p)}
                      className="w-full text-left p-4 rounded-lg border border-gray-100 hover:border-[#af4408]/30 hover:bg-[#af4408]/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">{p.hostName || 'No Host'}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                          p.status === 'Tentative' ? 'bg-blue-100 text-blue-700' :
                          p.status === 'Contacted' ? 'bg-purple-100 text-purple-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{p.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {p.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {p.company}
                          </span>
                        )}
                        <span>{formatDate(p.date)}</span>
                        {p.place && <span>{p.place}</span>}
                        <span className="font-semibold text-[#af4408]">{p.confirmedPax || p.expectedPax || '?'} Pax</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Selected Party Card */}
              <div className="bg-white rounded-xl border-2 border-[#af4408]/20 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Selected Party</h3>
                  <button
                    onClick={() => { setSelectedParty(null); setPartySearch(''); setContacts([{ guestName: '', guestPhone: '', saved: false }]); Object.values(autoSaveTimers.current).forEach(clearTimeout); autoSaveTimers.current = {}; }}
                    className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Change
                  </button>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#af4408]" />
                    <span className="text-sm font-semibold text-gray-900">{selectedParty.hostName || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#af4408]" />
                    <span className="text-sm text-gray-700">{selectedParty.company || '-'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(selectedParty.date)}</span>
                  <span className="text-xs font-bold text-[#af4408] bg-[#af4408]/10 px-2 py-0.5 rounded-full">
                    {selectedParty.confirmedPax || selectedParty.expectedPax || '?'} Pax
                  </span>
                </div>
              </div>

              {/* Step 2: Enter Guest Details */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-800">Step 2: Enter Guest Details</h3>
                    {autoSaving && (
                      <span className="flex items-center gap-1 text-xs text-[#af4408]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Auto-saving...
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    <span className="font-bold text-green-600">{contacts.filter((c) => c.saved).length}</span>
                    <span className="text-gray-400"> saved</span>
                    <span className="mx-1 text-gray-300">|</span>
                    <span className="font-bold text-[#af4408]">{contacts.filter((c) => (c.guestName || c.guestPhone) && !c.saved).length}</span>
                    <span className="text-gray-400"> pending</span>
                    <span className="mx-1 text-gray-300">|</span>
                    {contacts.length} total
                  </span>
                </div>

                <p className="text-[10px] text-gray-400 mb-3">Enter Name + 10-digit Mobile — auto-saves after 1.5s</p>

                <div className="space-y-2">
                  {contacts.map((contact, index) => (
                    <div key={index} className={`flex items-center gap-2 ${contact.locked ? 'opacity-60' : ''}`}>
                      {contact.locked ? (
                        <CheckCircle className="w-5 h-5 text-gray-400 shrink-0" />
                      ) : contact.saved ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <span className="text-xs font-bold text-gray-300 w-5 text-center shrink-0">{index + 1}</span>
                      )}
                      <input
                        type="text"
                        value={contact.guestName}
                        onChange={(e) => updateContact(index, 'guestName', e.target.value)}
                        placeholder="Guest Name"
                        readOnly={contact.locked}
                        className={`flex-1 px-3 py-3 rounded-lg border text-sm transition-colors ${
                          contact.locked
                            ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                            : contact.saved
                            ? 'border-green-200 bg-green-50 text-green-800 focus:outline-none focus:ring-2 focus:ring-green-300'
                            : 'border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30'
                        }`}
                      />
                      <input
                        type="tel"
                        value={contact.guestPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          updateContact(index, 'guestPhone', val);
                        }}
                        placeholder="Mobile Number"
                        maxLength={10}
                        readOnly={contact.locked}
                        className={`flex-1 px-3 py-3 rounded-lg border text-sm transition-colors ${
                          contact.locked
                            ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                            : contact.saved
                            ? 'border-green-200 bg-green-50 text-green-800 focus:outline-none focus:ring-2 focus:ring-green-300'
                            : contact.guestPhone && contact.guestPhone.length !== 10
                            ? 'border-red-300 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30'
                            : 'border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30'
                        }`}
                      />
                      {!contact.saved && !contact.locked && contacts.filter(c => !c.saved && !c.locked).length > 1 && (
                        <button
                          onClick={() => removeContactRow(index)}
                          className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {contact.locked && (
                        <span className="text-[10px] text-gray-400 font-semibold shrink-0 w-10 text-center">Locked</span>
                      )}
                      {contact.saved && !contact.locked && (
                        <span className="text-[10px] text-green-600 font-semibold shrink-0 w-10 text-center">Saved</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add more row */}
                <div className="mt-4">
                  <button
                    onClick={addContactRow}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add More Rows
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== LIST TAB ==================== */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchContacts()}
                  placeholder="Search by guest name, phone, company, host..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#af4408]/30"
                />
              </div>
              <button
                onClick={fetchContacts}
                disabled={listLoading}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#af4408] text-white hover:bg-[#963a07] transition-colors disabled:opacity-50"
              >
                {listLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
          </div>

          {/* Results */}
          {listLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : Object.keys(groupedContacts).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No guest contacts found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedContacts).map(([partyId, group]) => (
                <div key={partyId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Party header */}
                  <button
                    onClick={() => setExpandedParty(expandedParty === partyId ? null : partyId)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{group.hostName || 'No Host'}</p>
                        {group.company && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{group.company}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(group.partyDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#af4408] bg-[#af4408]/10 px-2.5 py-1 rounded-full">
                        {group.contacts.length} guest{group.contacts.length !== 1 ? 's' : ''}
                      </span>
                      {expandedParty === partyId ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Guest contacts list */}
                  {expandedParty === partyId && (
                    <div className="border-t border-gray-100">
                      {group.contacts.map((c, i) => (
                        <div
                          key={c.rowIndex || i}
                          className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                              {(c.guestName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.guestName || '-'}</p>
                              {c.guestPhone && (
                                <a href={`tel:${c.guestPhone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#af4408]">
                                  <Phone className="w-3 h-3" /> {c.guestPhone}
                                </a>
                              )}
                            </div>
                          </div>
                          {user?.role === 'ADMIN' && c.rowIndex && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(c.rowIndex); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
