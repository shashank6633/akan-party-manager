import { useState } from 'react';
import {
  UserCheck,
  Clock,
  Mail,
  MailCheck,
  QrCode,
  Trash2,
  Edit3,
  MoreVertical,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Undo2,
} from 'lucide-react';

export default function GuestListTable({
  guests,
  onGenerateQr,
  onSendInvite,
  onManualCheckin,
  onUndoCheckin,
  onEditGuest,
  onDeleteGuest,
  canManage,
  canInvite,
  canUndoCheckin,
  loading,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | checked-in | pending
  const [activeMenu, setActiveMenu] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // guestId

  const filtered = guests.filter((g) => {
    if (filter === 'checked-in' && !g.checkedIn) return false;
    if (filter === 'pending' && g.checkedIn) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (g.name || '').toLowerCase().includes(s) ||
        (g.phone || '').includes(s) ||
        (g.email || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleAction = async (action, guest) => {
    if (!action) return;
    setActionLoading(guest.id);
    setActiveMenu(null);
    try {
      await action(guest);
    } catch (err) {
      console.error('Action error:', err);
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search guests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#af4408]/20 focus:border-[#af4408] outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {['all', 'checked-in', 'pending'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f ? 'bg-[#af4408] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? `All (${guests.length})` : f === 'checked-in' ? `Arrived (${guests.filter((g) => g.checkedIn).length})` : `Pending (${guests.filter((g) => !g.checkedIn).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Guest List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">{guests.length === 0 ? 'No guests added yet' : 'No matching guests'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((guest) => (
            <div
              key={guest.id}
              className={`rounded-xl border p-3 transition-all ${
                guest.checkedIn
                  ? 'bg-green-50/50 border-green-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Status icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    guest.checkedIn ? 'bg-green-100' : 'bg-gray-100'
                  }`}
                >
                  {guest.checkedIn ? (
                    <UserCheck className="w-4 h-4 text-green-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Guest info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm text-gray-900 truncate">{guest.name}</h4>
                    {guest.plusOnes > 0 && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                        {guest.checkedIn && guest.actualPlusOnes !== undefined && guest.actualPlusOnes !== null
                          ? `+${guest.actualPlusOnes}/${guest.plusOnes}`
                          : `+${guest.plusOnes}`}
                      </span>
                    )}
                    {guest.inviteSent && (
                      <MailCheck className="w-3.5 h-3.5 text-purple-500" title="Invite sent" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                    {guest.phone && <span>{guest.phone}</span>}
                    {guest.email && <span className="truncate">{guest.email}</span>}
                    {guest.notes && <span className="italic truncate">{guest.notes}</span>}
                  </div>
                  {guest.checkedIn && guest.checkedInAt && (
                    <p className="text-[10px] text-green-600 mt-0.5">
                      Checked in {guest.checkedInBy ? `by ${guest.checkedInBy}` : ''}{' '}
                      {typeof guest.checkedInAt === 'string'
                        ? new Date(guest.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : guest.checkedInAt?.toDate
                        ? guest.checkedInAt.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {actionLoading === guest.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#af4408]" />
                  ) : (
                    <>
                      {/* Manual check-in button */}
                      {!guest.checkedIn && canManage && (
                        <button
                          onClick={() => handleAction(onManualCheckin, guest)}
                          className="p-2 rounded-lg hover:bg-green-100 text-green-600 transition-colors"
                          title="Manual check-in"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      {/* QR generate / view */}
                      {canManage && (
                        <button
                          onClick={() => handleAction(onGenerateQr, guest)}
                          className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                          title={guest.qrToken ? 'View QR' : 'Generate QR'}
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      )}

                      {/* Send invite */}
                      {guest.qrToken && guest.email && !guest.inviteSent && canInvite && (
                        <button
                          onClick={() => handleAction(onSendInvite, guest)}
                          className="p-2 rounded-lg hover:bg-purple-100 text-purple-600 transition-colors"
                          title="Send e-invite"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}

                      {/* More menu */}
                      {canManage && (
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === guest.id ? null : guest.id)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activeMenu === guest.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 min-w-[140px]">
                                <button
                                  onClick={() => { setActiveMenu(null); onEditGuest(guest); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Edit
                                </button>
                                {guest.checkedIn && canUndoCheckin && (
                                  <button
                                    onClick={() => handleAction(onUndoCheckin, guest)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-amber-50 text-amber-600"
                                  >
                                    <Undo2 className="w-3.5 h-3.5" /> Undo Check-in
                                  </button>
                                )}
                                <button
                                  onClick={() => handleAction(onDeleteGuest, guest)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Remove
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
