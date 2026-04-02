import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Phone, MapPin } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDate, isTBCDate } from '../../utils/helpers';

export default function PartyCard({ party, onQuickAction }) {
 const navigate = useNavigate();
 const isCancelled = party.status === 'Cancelled';

 // Cancelled parties on mobile: minimal compact card
 if (isCancelled) {
  return (
   <div
    onClick={() => navigate(`/parties/${party.rowIndex}`)}
    className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md transition-all cursor-pointer opacity-70"
   >
    <div className="flex items-center justify-between gap-2">
     <div className="min-w-0 flex-1">
      <h3 className="text-sm font-medium text-gray-700 truncate">{party.hostName || 'Untitled'}</h3>
      <div className="flex items-center gap-3 mt-1">
       {party.company && (
        <span className="text-xs text-gray-400 truncate">{party.company}</span>
       )}
       {party.expectedPax && (
        <span className="flex items-center gap-1 text-xs text-gray-400">
         <Users className="w-3 h-3" />{party.expectedPax}
        </span>
       )}
       {party.handledBy && party.handledBy.split(',').map((name, i) => (
        <span key={i} className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{name.trim()}</span>
       ))}
      </div>
     </div>
     <StatusBadge status={party.status} size="xs" />
    </div>
   </div>
  );
 }

 // Normal party card
 return (
  <div
   onClick={() => navigate(`/parties/${party.rowIndex}`)}
   className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-[#af4408]/30 transition-all cursor-pointer group"
  >
   <div className="flex items-start justify-between mb-3">
    <div className="min-w-0 flex-1">
     <h3 className="font-semibold text-gray-900 truncate group-hover:text-[#af4408] transition-colors">
      {party.hostName || 'Untitled Event'}
     </h3>
     {party.company && (
      <p className="text-xs text-gray-500 truncate">{party.company}</p>
     )}
    </div>
    <StatusBadge status={party.status} size="xs" />
   </div>

   <div className="space-y-1.5 text-sm text-gray-600">
    <div className="flex items-center gap-2">
     <Calendar className="w-3.5 h-3.5 shrink-0" />
     {isTBCDate(party.date) ? (
      <span className="inline-flex items-center gap-1">
       <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">TBC</span>
       <span className="text-xs text-gray-500">{party.date.replace('TBC: ', '')}</span>
      </span>
     ) : (
      <span>{formatDate(party.date)}</span>
     )}
     {party.day && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#af4408]/10 text-[#af4408]">{party.day.slice(0, 3)}</span>}
     {party.partyTime && (
      <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
       {party.partyTime}
      </span>
     )}
    </div>
    {party.phoneNumber && (
     <div className="flex items-center gap-2">
      <Phone className="w-3.5 h-3.5 shrink-0" />
      <a
       href={`tel:${party.phoneNumber}`}
       onClick={(e) => e.stopPropagation()}
       className="text-[#af4408] hover:underline"
      >
       {party.phoneNumber}
      </a>
     </div>
    )}
    {party.place && (
     <div className="flex items-center gap-2">
      <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-700" />
      <span className="truncate font-semibold text-blue-700">{party.place}</span>
     </div>
    )}
    {party.expectedPax && (
     <div className="flex items-center gap-2">
      <Users className="w-3.5 h-3.5 shrink-0" />
      <span>{party.expectedPax} pax</span>
     </div>
    )}
   </div>

   {/* Footer: package + handled by */}
   {(party.packageSelected || party.handledBy) && (
    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
     {party.handledBy && (
      <div className="flex items-center gap-1 flex-wrap">
       {party.handledBy.split(',').map((name, i) => (
        <span key={i} className="text-[10px] text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{name.trim()}</span>
       ))}
      </div>
     )}
     {party.packageSelected && (
      <span className="text-xs text-gray-500 truncate min-w-0">
       {party.packageSelected}
      </span>
     )}
    </div>
   )}
   {party.createdBy && (
    <div className="mt-1.5 text-[10px] text-blue-500">
     Added by: {party.createdBy}
    </div>
   )}

   {/* Quick actions */}
   {onQuickAction && (
    <div className="mt-2 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
     {party.status !== 'Confirmed' && (
      <button
       onClick={(e) => { e.stopPropagation(); onQuickAction(party, 'confirm'); }}
       className="flex-1 text-xs py-2.5 sm:py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors min-h-[44px] sm:min-h-0"
      >
       Confirm
      </button>
     )}
     <button
      onClick={(e) => { e.stopPropagation(); onQuickAction(party, 'cancel'); }}
      className="flex-1 text-xs py-2.5 sm:py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium transition-colors min-h-[44px] sm:min-h-0"
     >
      Cancel
     </button>
    </div>
   )}
  </div>
 );
}
