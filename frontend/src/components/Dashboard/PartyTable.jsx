import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 ChevronUp,
 ChevronDown,
 ChevronLeft,
 ChevronRight,
 MoreHorizontal,
 CheckCircle,
 XCircle,
 IndianRupee,
 LayoutGrid,
 List,
} from 'lucide-react';
import StatusBadge from '../Party/StatusBadge';
import PartyCard from '../Party/PartyCard';
import { formatDate, isTBCDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function PartyTable({ parties, loading, onQuickAction, page, totalPages, onPageChange }) {
 const navigate = useNavigate();
 const { user } = useAuth();
 const isGRE = user?.role === 'GRE';
 const isViewer = user?.role === 'VIEWER';
 const hideActions = isGRE || isViewer;
 const [sortField, setSortField] = useState('date');
 const [sortDir, setSortDir] = useState('asc');
 const [viewMode, setViewMode] = useState('table');
 const [actionMenuId, setActionMenuId] = useState(null);

 const handleSort = (field) => {
  if (sortField === field) {
   setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
  } else {
   setSortField(field);
   setSortDir('desc');
  }
 };

 const sorted = [...(parties || [])].sort((a, b) => {
  let aVal = a[sortField] || '';
  let bVal = b[sortField] || '';
  if (sortField === 'date') {
   aVal = new Date(aVal);
   bVal = new Date(bVal);
  }
  if (sortField === 'expectedPax' || sortField === 'finalTotalAmount') {
   aVal = parseFloat(aVal) || 0;
   bVal = parseFloat(bVal) || 0;
  }
  if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
  if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
  return 0;
 });

 const SortIcon = ({ field }) => {
  if (sortField !== field) return null;
  return sortDir === 'asc' ? (
   <ChevronUp className="w-3.5 h-3.5" />
  ) : (
   <ChevronDown className="w-3.5 h-3.5" />
  );
 };

 const ThCell = ({ field, children, className = '' }) => (
  <th
   onClick={() => handleSort(field)}
   className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none ${className}`}
  >
   <div className="flex items-center gap-1">
    {children}
    <SortIcon field={field} />
   </div>
  </th>
 );

 if (loading) {
  return (
   <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="animate-pulse p-4 space-y-4">
     {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex gap-4">
       <div className="h-4 w-20 bg-gray-200 rounded" />
       <div className="h-4 w-32 bg-gray-200 rounded" />
       <div className="h-4 w-24 bg-gray-200 rounded" />
       <div className="h-4 w-16 bg-gray-200 rounded flex-1" />
      </div>
     ))}
    </div>
   </div>
  );
 }

 if (!parties || parties.length === 0) {
  return (
   <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
     <List className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-semibold text-gray-700 mb-1">No parties found</h3>
    <p className="text-sm text-gray-500">Try adjusting your filters or add a new party.</p>
   </div>
  );
 }

 // Card view for mobile / toggle
 if (viewMode === 'grid') {
  return (
   <div>
    <div className="flex justify-end mb-3">
     <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
     {sorted.map((party) => (
      <PartyCard key={party.rowIndex} party={party} onQuickAction={hideActions ? null : onQuickAction} />
     ))}
    </div>
    <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
   </div>
  );
 }

 return (
  <div>
   <div className="flex justify-end mb-3">
    <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
   </div>

   {/* Desktop table */}
   <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="overflow-x-auto">
     <table className="w-full">
      <thead className="bg-gray-50">
       <tr>
        <ThCell field="date">Date</ThCell>
        <ThCell field="hostName">Host</ThCell>
        <ThCell field="phoneNumber">Phone</ThCell>
        <ThCell field="status">Status</ThCell>
        <ThCell field="expectedPax">Pax</ThCell>
        <ThCell field="handledBy">Handled By</ThCell>
        {!hideActions && <th className="px-4 py-3 w-10" />}
       </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
       {sorted.map((party) => {
        return (
         <tr
          key={party.rowIndex}
          onClick={() => navigate(`/parties/${party.rowIndex}`)}
          className="hover:bg-gray-50 cursor-pointer transition-colors"
         >
          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
           <div className="flex items-center gap-1.5">
           {isTBCDate(party.date) ? (
            <span className="inline-flex items-center gap-1">
             <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">TBC</span>
             <span className="text-xs text-gray-500">{party.date.replace('TBC: ', '')}</span>
            </span>
           ) : (
            formatDate(party.date)
           )}
           {party.day && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#af4408]/10 text-[#af4408]">{party.day.slice(0, 3)}</span>}
           </div>
           {(party.partyTime || party.place) && (
            <span className="flex items-center gap-1 mt-0.5">
             {party.partyTime && <span className="text-[10px] font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">{party.partyTime}</span>}
             {party.place && <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{party.place}</span>}
            </span>
           )}
          </td>
          <td className="px-4 py-3">
           <p className="text-sm font-medium text-gray-900 truncate max-w-[200px] lg:max-w-xs">
            {party.hostName || '-'}
           </p>
           {party.company && (
            <p className="text-xs text-gray-500 truncate max-w-[200px] lg:max-w-xs">{party.company}</p>
           )}
          </td>
          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
           {party.phoneNumber || '-'}
          </td>
          <td className="px-4 py-3">
           <StatusBadge status={party.status} size="xs" />
          </td>
          <td className="px-4 py-3 text-sm text-gray-900">
           {party.expectedPax || '-'}
          </td>
          <td className="px-4 py-3 text-sm text-gray-700 truncate max-w-[160px] lg:max-w-[200px]">
           {party.handledBy || '-'}
           {party.createdBy && (
            <span className="block text-[10px] text-blue-500 mt-0.5">Added: {party.createdBy}</span>
           )}
          </td>
          {!hideActions && (
           <td className="px-4 py-3 relative">
            <button
             onClick={(e) => {
              e.stopPropagation();
              setActionMenuId(actionMenuId === party.rowIndex ? null : party.rowIndex);
             }}
             className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
             <MoreHorizontal className="w-4 h-4 text-gray-400" />
            </button>
            {actionMenuId === party.rowIndex && (
             <div className="absolute right-4 top-10 z-10 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              {party.status !== 'Confirmed' && party.status !== 'Cancelled' && (
               <button
                onClick={(e) => { e.stopPropagation(); onQuickAction(party, 'confirm'); setActionMenuId(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
               >
                <CheckCircle className="w-4 h-4" /> Confirm
               </button>
              )}
              {party.status !== 'Cancelled' && (
               <button
                onClick={(e) => { e.stopPropagation(); onQuickAction(party, 'cancel'); setActionMenuId(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
               >
                <XCircle className="w-4 h-4" /> Cancel
               </button>
              )}
              <button
               onClick={(e) => { e.stopPropagation(); onQuickAction(party, 'payment'); setActionMenuId(null); }}
               className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#af4408] hover:bg-[#af4408]/10"
              >
               <IndianRupee className="w-4 h-4" /> Add Payment
              </button>
             </div>
            )}
           </td>
          )}
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
   </div>

   {/* Mobile card view */}
   <div className="md:hidden grid grid-cols-1 gap-3 px-0">
    {sorted.map((party) => (
     <PartyCard key={party.rowIndex} party={party} onQuickAction={hideActions ? null : onQuickAction} />
    ))}
   </div>

   <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
  </div>
 );
}

function ViewToggle({ viewMode, setViewMode }) {
 return (
  <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-0.5">
   <button
    onClick={() => setViewMode('table')}
    className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
   >
    <List className="w-4 h-4" />
   </button>
   <button
    onClick={() => setViewMode('grid')}
    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
   >
    <LayoutGrid className="w-4 h-4" />
   </button>
  </div>
 );
}

function Pagination({ page, totalPages, onPageChange }) {
 if (!totalPages || totalPages <= 1) return null;
 return (
  <div className="flex items-center justify-between mt-4 px-1">
   <p className="text-sm text-gray-500">
    Page {page} of {totalPages}
   </p>
   <div className="flex items-center gap-2">
    <button
     onClick={() => onPageChange(page - 1)}
     disabled={page <= 1}
     className="p-2.5 sm:p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
    >
     <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
    </button>
    <button
     onClick={() => onPageChange(page + 1)}
     disabled={page >= totalPages}
     className="p-2.5 sm:p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
    >
     <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
    </button>
   </div>
  </div>
 );
}
