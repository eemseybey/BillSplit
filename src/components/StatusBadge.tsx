import type { UtilityType } from '../types';
import { isBillDueSoon, isBillOverdue } from '../lib/billCalculator';
import { useSettings } from '../hooks/useFirestore';

interface StatusBadgeProps {
  month: string;
  dueDate?: string;
  utility: UtilityType;
  isPaid: boolean;
}

export default function StatusBadge({ month, dueDate, utility, isPaid }: StatusBadgeProps) {
  const { settings } = useSettings();
  const billLike = { month, dueDate: dueDate ?? '', utility };
  if (isPaid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-500/20 text-success-400">
        Paid
      </span>
    );
  }

  if (isBillOverdue(billLike, settings?.utilityDueDays)) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger-500/20 text-danger-400 animate-pulse">
        Overdue
      </span>
    );
  }

  if (isBillDueSoon(billLike, settings?.utilityDueDays)) {
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
