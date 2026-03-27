import { getStatusColor } from '../../utils/helpers';

export default function StatusBadge({ status, size = 'sm' }) {
  const colors = getStatusColor(status);
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${colors.bg} ${colors.text} ${sizeClasses[size]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${
          status === 'Enquiry' ? 'animate-pulse' : ''
        }`}
      />
      {status}
    </span>
  );
}
