import { Users, UserCheck, Clock, Mail, TrendingUp } from 'lucide-react';

export default function CheckinStats({ stats }) {
  if (!stats) return null;

  const cards = [
    {
      label: 'Total Expected',
      value: stats.totalExpected,
      sub: `${stats.totalGuests} guests + ${stats.totalPlusOnes} plus-ones`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Checked In',
      value: stats.totalArrived,
      sub: `${stats.checkedIn} guests + ${stats.checkedInPlusOnes} plus-ones`,
      icon: UserCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Pending',
      value: stats.pending,
      sub: 'guests not yet arrived',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Invites Sent',
      value: stats.invitesSent,
      sub: `of ${stats.totalGuests} guests`,
      icon: Mail,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Arrival Rate',
      value: `${stats.arrivalPercentage}%`,
      sub: `${stats.totalArrived} / ${stats.totalExpected}`,
      icon: TrendingUp,
      color: stats.arrivalPercentage >= 75 ? 'text-green-600' : stats.arrivalPercentage >= 50 ? 'text-amber-600' : 'text-red-600',
      bg: stats.arrivalPercentage >= 75 ? 'bg-green-50' : stats.arrivalPercentage >= 50 ? 'bg-amber-50' : 'bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div key={card.label} className={`${card.bg} rounded-xl p-3 border border-white/60`}>
          <div className="flex items-center gap-2 mb-1">
            <card.icon className={`w-4 h-4 ${card.color}`} />
            <span className="text-[11px] text-gray-500 font-medium">{card.label}</span>
          </div>
          <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
