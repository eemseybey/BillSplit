import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { FamilyName, UtilityType } from '../types';
import { FAMILY_COLORS } from '../lib/constants';
import { formatCurrency } from '../lib/billCalculator';

interface MarkPaidDialogProps {
  open: boolean;
  family: FamilyName;
  utility: UtilityType;
  amount: number;
  otherFamilies: FamilyName[];
  onSelect: (paidTo?: FamilyName) => void;
  onCancel: () => void;
}

export default function MarkPaidDialog({
  open,
  family,
  utility,
  amount,
  otherFamilies,
  onSelect,
  onCancel,
}: MarkPaidDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-paid-title"
        className="w-full max-w-sm rounded-2xl glass-heavy p-4 space-y-3 fade-slide-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="mark-paid-title" className="text-base font-semibold text-white">
              Who paid {family}&apos;s share?
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {utility} • {formatCurrency(amount)}
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-slate-400 hover:text-white interactive-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => onSelect(undefined)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-success-500/15 border border-success-500/40 text-success-200 hover:bg-success-500/25 transition-colors interactive-press"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: FAMILY_COLORS[family] }}
            />
            <span className="text-sm font-medium text-left">
              {family} paid it themselves
            </span>
          </button>

          {otherFamilies.length > 0 && (
            <p className="text-[11px] uppercase tracking-wide text-slate-500 px-1 pt-2">
              Or borrowed from
            </p>
          )}

          {otherFamilies.map((other) => (
            <button
              key={other}
              type="button"
              onClick={() => onSelect(other)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-900/60 border border-slate-700 hover:border-primary-500/60 hover:bg-slate-800 transition-colors interactive-press"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: FAMILY_COLORS[other] }}
              />
              <span className="text-sm font-medium text-left">
                Borrowed from {other}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors text-sm interactive-press"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
