import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Phone, MapPin, IndianRupee } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatCurrency, formatDate, getPaymentStatus, isTBCDate } from '../../utils/helpers';

export default function PartyCard({ party, onQuickAction }) {
 const navigate = useNavigate();
 const payment = getPaymentStatus(
  parseFloat(party.approxBillAmount) || parseFloat(party.finalTotalAmount) || 0,
  parseFloat(party.totalAmountPaid) || 0
 );

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

   <div className="space-y-2 text-sm text-gray-600">
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
     {party.mealType && (
      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
       {party.mealType}
      </span>
     )}
    </div>
    {party.phoneNumber && (
     <div className="flex items-center gap-2">
      <Phone className="w-3.5 h-3.5 shrink-0" />
      <span>{party.phoneNumber}</span>
     </div>
    )}
    {party.place && (
     <div className="flex items-center gap-2">
      <MapPin className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{party.place}</span>
     </div>
    )}
    <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
     {party.expectedPax && (
      <div className="flex items-center gap-1">
       <Users className="w-3.5 h-3.5" />
       <span>{party.expectedPax} pax</span>
      </div>
     )}
     {(party.finalTotalAmount || party.approxBillAmount) && (
      <div className="flex items-center gap-1">
       <IndianRupee className="w-3.5 h-3.5" />
       <span>{formatCurrency(party.finalTotalAmount || party.approxBillAmount)}</span>
      </div>
     )}
    </div>
   </div>

   <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
    <div className="flex items-center gap-2 shrink-0">
     <span className={`text-xs font-medium ${payment.color}`}>{payment.label}</span>
     {party.paymentStatus && (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
       party.paymentStatus === 'Paid' ? 'bg-green-100 text-green-700' :
       party.paymentStatus === 'Partial' ? 'bg-amber-100 text-amber-700' :
       party.paymentStatus === 'Refunded' ? 'bg-blue-100 text-blue-700' :
       'bg-red-100 text-red-700'
      }`}>{party.paymentStatus}</span>
     )}
    </div>
    {party.packageSelected && (
     <span className="text-xs text-gray-500 truncate min-w-0">
      {party.packageSelected}
     </span>
    )}
   </div>

   {/* Quick actions */}
   {onQuickAction && party.status !== 'Cancelled' && (
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
