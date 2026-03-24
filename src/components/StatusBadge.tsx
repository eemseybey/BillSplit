import { isOverdue, isDueSoon } from '../lib/billCalculator';

interface StatusBadgeProps {
  month: string;
  isPaid: boolean;
}

export default function StatusBadge({ month, isPaid }: StatusBadgeProps) {
  if (isPaid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/20 text-success-400">
        Paid
      </span>
    );
  }

  if (isOverdue(month)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger-500/20 text-danger-400 animate-pulse">
        Overdue
      </span>
    );
  }

  if (isDueSoon(month)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-500/20 text-warning-400">
        Due Soon
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400">
      Pending
    </span>
  );
}
