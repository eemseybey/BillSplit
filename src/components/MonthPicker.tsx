import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthLabel } from '../lib/billCalculator';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const shift = (delta: number) => {
    const [year, month] = value.split('-').map(Number);
    const date = new Date(year, month - 1 + delta);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onChange(newMonth);
  };

  return (
    <div className="flex items-center justify-between glass-panel gradient-outline rounded-2xl px-4 py-3 hover-lift">
      <button
        onClick={() => shift(-1)}
        aria-label="Previous month"
        className="p-1.5 rounded-lg hover:bg-slate-700/60 transition-colors interactive-press"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="font-semibold text-white tracking-wide">{getMonthLabel(value)}</span>
      <button
        onClick={() => shift(1)}
        aria-label="Next month"
        className="p-1.5 rounded-lg hover:bg-slate-700/60 transition-colors interactive-press"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
