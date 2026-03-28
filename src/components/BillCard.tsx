import { useState } from 'react';
import { Zap, Wifi, Droplets, Check, Trash2, ImageIcon, X, Pencil } from 'lucide-react';
import type { Bill, FamilyName } from '../types';
import { formatCurrency } from '../lib/billCalculator';
import { FAMILY_COLORS } from '../lib/constants';
import StatusBadge from './StatusBadge';

const utilityIcons = {
  VECO: Zap,
  PLDT: Wifi,
  MCWD: Droplets,
};

const utilityColors = {
  VECO: 'text-yellow-400',
  PLDT: 'text-blue-400',
  MCWD: 'text-cyan-400',
};

interface BillCardProps {
  bill: Bill;
  onTogglePaid: (billId: string, family: FamilyName) => void;
  onDelete: (billId: string) => void;
  onTogglePaidToProvider: (billId: string) => void;
  onEdit: (bill: Bill) => void;
}

export default function BillCard({ bill, onTogglePaid, onDelete, onTogglePaidToProvider, onEdit }: BillCardProps) {
  const Icon = utilityIcons[bill.utility];
  const allSplitsPaid = bill.splits.every((s) => s.isPaid);
  const [showImage, setShowImage] = useState(false);

  return (
    <>
      <div className="glass-panel gradient-outline rounded-2xl p-4 hover-lift">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-700 flex items-center justify-center">
              <Icon className={`w-4.5 h-4.5 ${utilityColors[bill.utility]}`} />
            </div>
            <span className="font-semibold tracking-wide">{bill.utility}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge month={bill.month} dueDate={bill.dueDate} utility={bill.utility} isPaid={bill.isPaidToProvider} />
            {bill.imageUrl && (
              <button
                onClick={() => setShowImage(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-slate-800/70 transition-colors"
                title="View bill photo"
                aria-label={`View ${bill.utility} bill photo`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onEdit(bill)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/70 transition-colors"
              aria-label={`Edit ${bill.utility} bill`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(bill.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-danger-400 hover:bg-slate-800/70 transition-colors"
              aria-label={`Delete ${bill.utility} bill`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bill Photo Thumbnail */}
        {bill.imageUrl && (
          <button onClick={() => setShowImage(true)} className="w-full mb-3" aria-label={`Open ${bill.utility} bill image`}>
            <img
              src={bill.imageUrl}
              alt={`${bill.utility} bill`}
              className="w-full h-32 object-cover rounded-xl border border-slate-700/80 hover:border-primary-500/70 transition-colors"
            />
          </button>
        )}

        {/* Total */}
        <div className="text-2xl font-bold text-white mb-3">
          {formatCurrency(bill.totalAmount)}
        </div>

      {/* Splits */}
      <div className="space-y-2 stagger-list">
        {bill.splits.map((split) => (
          <div
            key={split.family}
            className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900/45 border border-slate-700/50"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: FAMILY_COLORS[split.family] }}
              />
              <span className="text-sm">{split.family}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{formatCurrency(split.amount)}</span>
              <button
                onClick={() => onTogglePaid(bill.id, split.family)}
                aria-label={`Toggle paid for ${split.family}`}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  split.isPaid
                    ? 'bg-success-500 text-white shadow-[0_0_14px_rgba(34,197,94,0.35)]'
                    : 'border border-slate-600 hover:border-success-400 hover:bg-success-500/10'
                }`}
              >
                {split.isPaid && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Paid to provider toggle */}
      {allSplitsPaid && !bill.isPaidToProvider && (
        <button
          onClick={() => onTogglePaidToProvider(bill.id)}
          className="mt-3 w-full py-2 rounded-lg bg-success-500/20 text-success-400 text-sm font-medium hover:bg-success-500/30 transition-colors"
        >
          Mark as Paid to {bill.utility}
        </button>
      )}

      {bill.paidBy && (
        <div className="mt-3 px-3 py-2 bg-primary-500/10 rounded-lg text-xs text-primary-300">
          Tapal by <span className="font-semibold">{bill.paidBy}</span>
        </div>
      )}
    </div>

      {/* Full-screen image overlay */}
      {showImage && bill.imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImage(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
            onClick={() => setShowImage(false)}
            aria-label="Close bill image"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={bill.imageUrl}
            alt={`${bill.utility} bill`}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
