import { useEffect, useState } from 'react';
import {
 MessageSquare,
 CheckCircle2,
 Clock,
 XCircle,
 IndianRupee,
 PhoneCall,
 HelpCircle,
 AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

const cards = [
 { key: 'totalEnquiries', label: 'Total Enquiries', icon: MessageSquare, color: 'text-yellow-500', bg: 'bg-yellow-50' },
 { key: 'contacted', label: 'Contacted', icon: PhoneCall, color: 'text-purple-500', bg: 'bg-purple-50' },
 { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
 { key: 'tentative', label: 'Tentative', icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
 { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
 { key: 'unknown', label: 'Unknown', icon: HelpCircle, color: 'text-gray-500', bg: 'bg-gray-100' },
 { key: 'totalRevenue', label: 'Total Revenue', icon: IndianRupee, color: 'text-[#af4408]', bg: 'bg-[#af4408]/10', isCurrency: true, revenueOnly: true },
 { key: 'pendingDues', label: 'Pending Dues', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', isCurrency: true, revenueOnly: true },
];

function AnimatedNumber({ value, isCurrency }) {
 const [display, setDisplay] = useState(0);

 useEffect(() => {
  if (!value) { setDisplay(0); return; }
  const target = parseFloat(value) || 0;
  const duration = 600;
  const start = Date.now();
  const startVal = display;
  const tick = () => {
   const elapsed = Date.now() - start;
   const progress = Math.min(elapsed / duration, 1);
   const eased = 1 - Math.pow(1 - progress, 3);
   setDisplay(Math.round(startVal + (target - startVal) * eased));
   if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 }, [value]);

 return isCurrency ? formatCurrency(display) : display.toLocaleString('en-IN');
}

const cashierCards = [
 { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
 { key: 'totalRevenue', label: 'Total Revenue', icon: IndianRupee, color: 'text-[#af4408]', bg: 'bg-[#af4408]/10', isCurrency: true },
 { key: 'pendingDues', label: 'Pending Dues', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', isCurrency: true },
];

export default function StatsCards({ stats, loading, cashierView = false, showRevenue = true }) {
 const allCards = cashierView ? cashierCards : cards;
 const displayCards = showRevenue ? allCards : allCards.filter((c) => !c.revenueOnly);
 if (loading) {
  return (
   <div className={`grid grid-cols-2 ${cashierView ? 'md:grid-cols-3' : showRevenue ? 'md:grid-cols-4 xl:grid-cols-8' : 'md:grid-cols-3 xl:grid-cols-6'} gap-3 sm:gap-4`}>
    {Array.from({ length: displayCards.length }).map((_, i) => (
     <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 animate-pulse">
      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-200 rounded-lg mb-2 sm:mb-3" />
      <div className="h-3 sm:h-4 w-14 sm:w-16 bg-gray-200 rounded mb-2" />
      <div className="h-5 sm:h-6 w-10 sm:w-12 bg-gray-200 rounded" />
     </div>
    ))}
   </div>
  );
 }

 return (
  <div className={`grid grid-cols-2 ${cashierView ? 'md:grid-cols-3' : showRevenue ? 'md:grid-cols-4 xl:grid-cols-8' : 'md:grid-cols-3 xl:grid-cols-6'} gap-3 sm:gap-4`}>
   {displayCards.map((card) => (
    <div
     key={card.key}
     className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow"
    >
     <div className={`w-8 h-8 sm:w-10 sm:h-10 ${card.bg} rounded-lg flex items-center justify-center mb-2 sm:mb-3`}>
      <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
     </div>
     <p className="text-[11px] sm:text-xs text-gray-500 font-medium mb-0.5 sm:mb-1">{card.label}</p>
     <p className="text-base sm:text-xl font-bold text-gray-900 truncate">
      <AnimatedNumber value={stats?.[card.key]} isCurrency={card.isCurrency} />
     </p>
    </div>
   ))}
  </div>
 );
}
