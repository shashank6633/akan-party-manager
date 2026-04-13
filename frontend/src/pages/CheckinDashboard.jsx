import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Camera,
  Users,
  UserCheck,
  ArrowLeft,
  Loader2,
  Search,
  RefreshCw,
  QrCode,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkinAPI, partyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import QRScanner from '../components/Checkin/QRScanner';
import CheckinStats from '../components/Checkin/CheckinStats';
import GuestListTable from '../components/Checkin/GuestListTable';

export default function CheckinDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedPartyId = searchParams.get('partyId');

  const canManage = ['GRE', 'SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
  const canUndoCheckin = ['MANAGER', 'ADMIN'].includes(user?.role);

  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(preselectedPartyId || '');
  const [guests, setGuests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guestLoading, setGuestLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState(null);
  const [partySearch, setPartySearch] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch today's confirmed parties
  useEffect(() => {
    const fetchParties = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await partyAPI.getAll({ dateFrom: todayStr, dateTo: todayStr, status: 'Confirmed' });
        const allParties = res.data.parties || [];
        // Only show parties with Guest Checkin enabled
        const list = allParties.filter((p) => (p.guestCheckin || '').toLowerCase() === 'yes');
        setParties(list);

        // Auto-select if only one party or preselected
        if (preselectedPartyId) {
          setSelectedPartyId(preselectedPartyId);
        } else if (list.length === 1) {
          setSelectedPartyId(list[0].uniqueId);
        }
      } catch (err) {
        console.error('Failed to fetch parties:', err);
      }
      setLoading(false);
    };
    fetchParties();
  }, []);

  // Fetch guests when party selected
  useEffect(() => {
    if (!selectedPartyId) {
      setGuests([]);
      setStats(null);
      return;
    }
    fetchGuestsForParty();
  }, [selectedPartyId]);

  const fetchGuestsForParty = async () => {
    setGuestLoading(true);
    try {
      const [gRes, sRes] = await Promise.all([
        checkinAPI.getGuests(selectedPartyId),
        checkinAPI.getStats(selectedPartyId),
      ]);
      setGuests(gRes.data.guests || []);
      setStats(sRes.data.stats || null);
    } catch (err) {
      console.error('Failed to fetch guests:', err);
    }
    setGuestLoading(false);
  };

  const handleScanResult = async (qrToken) => {
    const res = await checkinAPI.scanQr(qrToken);
    if (res.data.success) {
      // Refresh if scanned guest belongs to selected party
      if (res.data.partyId === selectedPartyId) {
        fetchGuestsForParty();
      }
    }
    return res.data;
  };

  const handleManualCheckin = async (guest) => {
    try {
      await checkinAPI.manualCheckin(selectedPartyId, guest.id);
      fetchGuestsForParty();
      showToast(`${guest.name} checked in!`);
    } catch (err) {
      showToast('Check-in failed', 'error');
    }
  };

  const handleUndoCheckin = async (guest) => {
    try {
      await checkinAPI.undoCheckin(selectedPartyId, guest.id);
      fetchGuestsForParty();
      showToast(`${guest.name} check-in undone`);
    } catch (err) {
      showToast('Failed', 'error');
    }
  };

  const handleExportAttendance = () => {
    if (guests.length === 0) return;
    const exportData = guests.map((g, i) => ({
      '#': i + 1,
      'Name': g.name || '',
      'Phone': g.phone || '',
      'Email': g.email || '',
      'Plus Ones': g.plusOnes || 0,
      'Checked In': g.checkedIn ? 'Yes' : 'No',
      'Checked In At': g.checkedIn
        ? (typeof g.checkedInAt === 'string'
            ? new Date(g.checkedInAt).toLocaleString('en-IN')
            : g.checkedInAt?.toDate ? g.checkedInAt.toDate().toLocaleString('en-IN') : '')
        : '',
      'Checked In By': g.checkedInBy || '',
    }));
    const checked = guests.filter((g) => g.checkedIn).length;
    exportData.push({});
    exportData.push({ '#': '', 'Name': 'SUMMARY', 'Checked In': `${checked} / ${guests.length}` });
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Attendance_${selectedPartyId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Attendance exported!');
  };

  const filteredParties = parties.filter((p) => {
    if (!partySearch) return true;
    const s = partySearch.toLowerCase();
    return (
      (p.uniqueId || '').toLowerCase().includes(s) ||
      (p.hostName || '').toLowerCase().includes(s) ||
      (p.company || '').toLowerCase().includes(s)
    );
  });

  const selectedParty = parties.find((p) => p.uniqueId === selectedPartyId);

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#af4408]" />
            Guest Check-In
          </h2>
          <p className="text-sm text-gray-500">Scan QR codes or manually check in guests</p>
        </div>
        <button
          onClick={() => setShowScanner(!showScanner)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showScanner
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-[#af4408] text-white hover:bg-[#8e3706]'
          }`}
        >
          <Camera className="w-4 h-4" /> {showScanner ? 'Hide Scanner' : 'Open Scanner'}
        </button>
      </div>

      {/* QR Scanner (full-width at top) */}
      {showScanner && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
          <QRScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />
        </div>
      )}

      {/* Party Selector */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#af4408]" />
        </div>
      ) : parties.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No confirmed parties for today</p>
        </div>
      ) : (
        <>
          {/* Party selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Select Party</h3>
              {selectedParty && (
                <span className="text-xs bg-[#af4408]/10 text-[#af4408] px-2 py-0.5 rounded-full font-medium">
                  {selectedParty.uniqueId}
                </span>
              )}
            </div>

            {parties.length > 3 && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search parties..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
                />
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredParties.map((p) => (
                <button
                  key={p.uniqueId}
                  onClick={() => setSelectedPartyId(p.uniqueId)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedPartyId === p.uniqueId
                      ? 'border-[#af4408] bg-[#af4408]/5 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#af4408]">{p.uniqueId}</span>
                    <span className="text-[10px] text-gray-400">{p.partyTime || ''}</span>
                  </div>
                  <div className="font-medium text-sm text-gray-900 mt-1">{p.hostName || '-'}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {p.company && <span>{p.company}</span>}
                    {p.expectedPax && <span>{p.expectedPax} pax</span>}
                    {p.occasionType && <span>{p.occasionType}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Guest check-in for selected party */}
          {selectedPartyId && (
            <div className="space-y-4">
              {/* Stats */}
              {!guestLoading && <CheckinStats stats={stats} />}

              {/* Refresh */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Guest List {guests.length > 0 && `(${guests.length})`}
                </h3>
                <div className="flex items-center gap-2">
                  {guests.length > 0 && (
                    <button
                      onClick={handleExportAttendance}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200"
                    >
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                  )}
                  <button
                    onClick={fetchGuestsForParty}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              {guestLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[#af4408]" />
                </div>
              ) : (
                <GuestListTable
                  guests={guests}
                  onGenerateQr={() => {}}
                  onSendInvite={() => {}}
                  onManualCheckin={handleManualCheckin}
                  onUndoCheckin={handleUndoCheckin}
                  onEditGuest={() => {}}
                  onDeleteGuest={() => {}}
                  canManage={canManage}
                  canInvite={false}
                  canUndoCheckin={canUndoCheckin}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
