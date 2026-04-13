import { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  UserPlus,
  Send,
  RefreshCw,
  Loader2,
  Camera,
  Download,
  AlertCircle,
  FileSpreadsheet,
  Table2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkinAPI } from '../../services/api';
import { useCheckinGuests, useCheckinStats } from '../../hooks/useCheckinRealtime';
import { useAuth } from '../../context/AuthContext';
import CheckinStats from './CheckinStats';
import GuestListTable from './GuestListTable';
import GuestInviteForm from './GuestInviteForm';
import QRScanner from './QRScanner';
import BulkUpload from './BulkUpload';

export default function CheckinTab({ party }) {
  const { user } = useAuth();
  const partyId = party?.uniqueId;
  const canManage = ['GRE', 'SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
  const canInvite = ['SALES', 'MANAGER', 'ADMIN'].includes(user?.role);
  const canUndoCheckin = ['MANAGER', 'ADMIN'].includes(user?.role);

  const [available, setAvailable] = useState(null); // null = checking, true/false
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [checkinPrompt, setCheckinPrompt] = useState(null); // { guest, actualPlusOnes, source: 'manual'|'scan' }

  const [showQrModal, setShowQrModal] = useState(null); // { qrDataUrl, guestName }
  const [addLoading, setAddLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Fetch guests via API (used as fallback if Firebase client isn't configured)
  const fetchGuests = useCallback(async (pid) => {
    const res = await checkinAPI.getGuests(pid);
    return res.data.guests || [];
  }, []);

  const { guests, loading: guestsLoading, isRealtime, setGuests } = useCheckinGuests(partyId, {
    fallbackFetch: fetchGuests,
    pollInterval: 5000,
  });

  const { stats } = useCheckinStats(partyId);

  // If Firebase client isn't configured, compute stats from guests
  const displayStats = stats || (guests.length > 0 ? computeStats(guests) : null);

  // Check module availability
  useEffect(() => {
    checkinAPI.getStatus()
      .then((res) => setAvailable(res.data.available))
      .catch(() => setAvailable(false));
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddGuest = async (guestData) => {
    setAddLoading(true);
    try {
      const res = await checkinAPI.addGuest(partyId, guestData);
      if (!isRealtime) {
        setGuests((prev) => [...prev, res.data.guest]);
      }
      setShowAddGuest(false);
      showToast(`${guestData.name} added`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add guest', 'error');
    }
    setAddLoading(false);
  };

  const handleBulkUpload = async (guestList) => {
    setBulkLoading(true);
    try {
      const res = await checkinAPI.addGuestsBulk(partyId, guestList);
      const count = res.data.count || guestList.length;
      if (!isRealtime) {
        const updated = await fetchGuests(partyId);
        setGuests(updated);
      }
      setShowBulkUpload(false);
      showToast(`${count} guests imported successfully!`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Bulk import failed', 'error');
    }
    setBulkLoading(false);
  };

  const handleGenerateQr = async (guest) => {
    try {
      const res = await checkinAPI.generateQr(partyId, guest.id);
      setShowQrModal({ qrDataUrl: res.data.qrDataUrl, guestName: guest.name });
      if (!isRealtime) {
        setGuests((prev) => prev.map((g) => g.id === guest.id ? { ...g, qrToken: res.data.qrToken } : g));
      }
    } catch (err) {
      showToast('Failed to generate QR', 'error');
    }
  };

  const handleSendInvite = async (guest) => {
    try {
      await checkinAPI.sendInvite(partyId, guest.id, {
        hostName: party?.hostName || '',
        eventDate: party?.date || '',
        eventTime: party?.partyTime || '',
        venue: party?.place || '',
        occasion: party?.occasionType || '',
        company: party?.company || '',
      });
      if (!isRealtime) {
        setGuests((prev) => prev.map((g) => g.id === guest.id ? { ...g, inviteSent: true, inviteSentAt: new Date().toISOString() } : g));
      }
      showToast(`Invite sent to ${guest.email}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send invite', 'error');
    }
  };

  const handleManualCheckin = async (guest) => {
    if (guest.plusOnes > 0) {
      // Show prompt for actual plus-ones count
      setCheckinPrompt({ guest, actualPlusOnes: guest.plusOnes, source: 'manual' });
      return;
    }
    // No plus-ones — check in directly
    await doCheckin(guest, 0);
  };

  const doCheckin = async (guest, actualPlusOnes) => {
    try {
      const res = await checkinAPI.manualCheckin(partyId, guest.id, actualPlusOnes);
      if (res.data.alreadyCheckedIn) {
        showToast(`${guest.name} already checked in`, 'warning');
      } else {
        if (!isRealtime) {
          setGuests((prev) => prev.map((g) => g.id === guest.id ? { ...g, checkedIn: true, checkedInAt: new Date().toISOString(), checkedInBy: user?.name, actualPlusOnes } : g));
        }
        const plusMsg = actualPlusOnes > 0 ? ` (+${actualPlusOnes})` : '';
        showToast(`${guest.name}${plusMsg} checked in!`);
      }
    } catch (err) {
      showToast('Check-in failed', 'error');
    }
    setCheckinPrompt(null);
  };

  const handleUndoCheckin = async (guest) => {
    try {
      await checkinAPI.undoCheckin(partyId, guest.id);
      if (!isRealtime) {
        setGuests((prev) => prev.map((g) => g.id === guest.id ? { ...g, checkedIn: false, checkedInAt: null, checkedInBy: null } : g));
      }
      showToast(`${guest.name} check-in undone`);
    } catch (err) {
      showToast('Failed to undo', 'error');
    }
  };

  const handleEditGuest = async (guest) => {
    const name = prompt('Guest name:', guest.name);
    if (!name || name === guest.name) return;
    try {
      await checkinAPI.updateGuest(partyId, guest.id, { name });
      if (!isRealtime) {
        setGuests((prev) => prev.map((g) => g.id === guest.id ? { ...g, name } : g));
      }
    } catch (err) {
      showToast('Update failed', 'error');
    }
  };

  const handleDeleteGuest = async (guest) => {
    if (!confirm(`Remove ${guest.name}?`)) return;
    try {
      await checkinAPI.deleteGuest(partyId, guest.id);
      if (!isRealtime) {
        setGuests((prev) => prev.filter((g) => g.id !== guest.id));
      }
      showToast(`${guest.name} removed`);
    } catch (err) {
      showToast('Remove failed', 'error');
    }
  };

  const handleScanResult = async (qrToken) => {
    // QR scan: check in with expected plus-ones (GRE can adjust later from guest list)
    const res = await checkinAPI.scanQr(qrToken);
    if (res.data.success && !isRealtime) {
      const updated = await fetchGuests(partyId);
      setGuests(updated);
    }
    return res.data;
  };

  const handleBulkInvite = async () => {
    const uninvited = guests.filter((g) => !g.inviteSent && g.email);
    if (uninvited.length === 0) {
      showToast('No uninvited guests with email', 'warning');
      return;
    }
    if (!confirm(`Send invites to ${uninvited.length} guests?`)) return;
    try {
      const res = await checkinAPI.bulkInvite(partyId, {
        hostName: party?.hostName || '',
        eventDate: party?.date || '',
        eventTime: party?.partyTime || '',
        venue: party?.place || '',
        occasion: party?.occasionType || '',
        company: party?.company || '',
      });
      showToast(res.data.message);
      if (!isRealtime) {
        // Refresh guest list
        const updated = await fetchGuests(partyId);
        setGuests(updated);
      }
    } catch (err) {
      showToast('Bulk invite failed', 'error');
    }
  };

  const handleRefresh = async () => {
    if (isRealtime) return; // real-time doesn't need manual refresh
    try {
      const data = await fetchGuests(partyId);
      setGuests(data);
    } catch (err) {
      showToast('Refresh failed', 'error');
    }
  };

  const handleSyncSheets = async () => {
    try {
      const res = await checkinAPI.syncSheets(partyId);
      showToast(res.data.message || 'Synced to Google Sheets!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Sync failed', 'error');
    }
  };

  const handleExportAttendance = () => {
    if (guests.length === 0) {
      showToast('No guests to export', 'warning');
      return;
    }

    const exportData = guests.map((g, i) => ({
      '#': i + 1,
      'Name': g.name || '',
      'Phone': g.phone || '',
      'Email': g.email || '',
      'Expected Plus Ones': g.plusOnes || 0,
      'Actual Plus Ones': g.checkedIn ? (g.actualPlusOnes !== undefined && g.actualPlusOnes !== null ? g.actualPlusOnes : g.plusOnes || 0) : '',
      'Notes': g.notes || '',
      'Invite Sent': g.inviteSent ? 'Yes' : 'No',
      'Checked In': g.checkedIn ? 'Yes' : 'No',
      'Checked In At': g.checkedIn
        ? (typeof g.checkedInAt === 'string'
            ? new Date(g.checkedInAt).toLocaleString('en-IN')
            : g.checkedInAt?.toDate
            ? g.checkedInAt.toDate().toLocaleString('en-IN')
            : '')
        : '',
      'Checked In By': g.checkedInBy || '',
    }));

    // Add summary row
    const stats = displayStats || {};
    exportData.push({});
    exportData.push({
      '#': '',
      'Name': 'SUMMARY',
      'Phone': '',
      'Email': '',
      'Plus Ones': '',
      'Notes': '',
      'Invite Sent': `${stats.invitesSent || 0} sent`,
      'Checked In': `${stats.checkedIn || 0} / ${stats.totalGuests || 0}`,
      'Checked In At': `Arrival: ${stats.arrivalPercentage || 0}%`,
      'Checked In By': `Total: ${stats.totalArrived || 0} / ${stats.totalExpected || 0}`,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 25 }, { wch: 10 },
      { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const fileName = `Attendance_${partyId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Attendance exported!');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (available === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#af4408]" />
      </div>
    );
  }

  if (available === false) {
    return (
      <div className="text-center py-16 text-gray-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Check-in Module Not Available</p>
        <p className="text-xs mt-1">Firebase is not configured. Contact admin to set up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-fade-in ${
          toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <CheckinStats stats={displayStats} />

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <button
              onClick={() => setShowAddGuest(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#af4408] text-white rounded-lg text-xs font-medium hover:bg-[#8e3706] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Guest
            </button>
            <button
              onClick={() => setShowBulkUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Upload CSV/Excel
            </button>
            <button
              onClick={() => setShowScanner(!showScanner)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                showScanner ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" /> {showScanner ? 'Hide Scanner' : 'Scan QR'}
            </button>
          </>
        )}
        {canInvite && guests.some((g) => !g.inviteSent && g.email) && (
          <button
            onClick={handleBulkInvite}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Send All Invites
          </button>
        )}
        {guests.length > 0 && (
          <>
            <button
              onClick={handleSyncSheets}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-100 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-200 transition-colors"
            >
              <Table2 className="w-3.5 h-3.5" /> Sync to Sheets
            </button>
            <button
              onClick={handleExportAttendance}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export Attendance
            </button>
          </>
        )}
        {!isRealtime && (
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 ml-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        )}
        {isRealtime && (
          <span className="text-[10px] text-green-600 font-medium ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
        )}
      </div>

      {/* QR Scanner */}
      {showScanner && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
          <QRScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />
        </div>
      )}

      {/* Guest List */}
      {guestsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#af4408]" />
        </div>
      ) : (
        <GuestListTable
          guests={guests}
          onGenerateQr={handleGenerateQr}
          onSendInvite={handleSendInvite}
          onManualCheckin={handleManualCheckin}
          onUndoCheckin={handleUndoCheckin}
          onEditGuest={handleEditGuest}
          onDeleteGuest={handleDeleteGuest}
          canManage={canManage}
          canInvite={canInvite}
          canUndoCheckin={canUndoCheckin}
        />
      )}

      {/* Add Guest Modal */}
      {showAddGuest && (
        <GuestInviteForm
          onSubmit={handleAddGuest}
          onClose={() => setShowAddGuest(false)}
          loading={addLoading}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUpload
          onUpload={handleBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          partyId={partyId}
          loading={bulkLoading}
        />
      )}

      {/* Check-in Plus Ones Prompt */}
      {checkinPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCheckinPrompt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-center mb-1">Check In Guest</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              <span className="font-semibold text-gray-800">{checkinPrompt.guest.name}</span>
              {' '}has <span className="font-semibold text-blue-600">{checkinPrompt.guest.plusOnes}</span> plus-one(s) registered
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2 text-center">
                How many plus-ones actually arrived?
              </label>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCheckinPrompt((p) => ({ ...p, actualPlusOnes: Math.max(0, p.actualPlusOnes - 1) }))}
                  className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-bold text-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-3xl font-bold text-[#af4408] w-12 text-center">{checkinPrompt.actualPlusOnes}</span>
                <button
                  onClick={() => setCheckinPrompt((p) => ({ ...p, actualPlusOnes: p.actualPlusOnes + 1 }))}
                  className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 font-bold text-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                Total entering: 1 (guest) + {checkinPrompt.actualPlusOnes} (plus-ones) = <strong>{1 + checkinPrompt.actualPlusOnes}</strong>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => doCheckin(checkinPrompt.guest, checkinPrompt.actualPlusOnes)}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Check In ({1 + checkinPrompt.actualPlusOnes} people)
              </button>
              <button
                onClick={() => setCheckinPrompt(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Preview Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowQrModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">{showQrModal.guestName}</h3>
            <p className="text-xs text-gray-500 mb-4">Check-in QR Code</p>
            <img src={showQrModal.qrDataUrl} alt="QR Code" className="mx-auto w-64 h-64 border rounded-xl" />
            <div className="mt-4 flex gap-2">
              <a
                href={showQrModal.qrDataUrl}
                download={`qr-${showQrModal.guestName.replace(/\s+/g, '-')}.png`}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706]"
              >
                <Download className="w-4 h-4" /> Download
              </a>
              <button
                onClick={() => setShowQrModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: compute stats from guest list (when Firebase realtime isn't available)
function computeStats(guests) {
  const totalGuests = guests.length;
  const checkedIn = guests.filter((g) => g.checkedIn).length;
  const invitesSent = guests.filter((g) => g.inviteSent).length;
  const totalPlusOnes = guests.reduce((s, g) => s + (parseInt(g.plusOnes) || 0), 0);
  const checkedInPlusOnes = guests.filter((g) => g.checkedIn).reduce((s, g) => {
    const actual = g.actualPlusOnes !== undefined && g.actualPlusOnes !== null ? parseInt(g.actualPlusOnes) : parseInt(g.plusOnes) || 0;
    return s + actual;
  }, 0);
  const totalExpected = totalGuests + totalPlusOnes;
  const totalArrived = checkedIn + checkedInPlusOnes;
  return {
    totalGuests,
    checkedIn,
    pending: totalGuests - checkedIn,
    invitesSent,
    totalPlusOnes,
    checkedInPlusOnes,
    totalExpected,
    totalArrived,
    arrivalPercentage: totalExpected > 0 ? Math.round((totalArrived / totalExpected) * 100) : 0,
  };
}
