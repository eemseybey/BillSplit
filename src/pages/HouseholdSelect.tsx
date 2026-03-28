import { useHousehold } from '../context/HouseholdContext';
import { FAMILIES } from '../lib/constants';
import { Home } from 'lucide-react';

export default function HouseholdSelect() {
  const { selectHousehold } = useHousehold();

  return (
    <div className="min-h-screen aurora-shell flex flex-col items-center justify-center px-6">
      <div className="relative z-10 w-full max-w-sm space-y-8 fade-slide-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto animated-gradient-btn subtle-pulse-border">
            ₱
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">BillSplit</h1>
          <p className="text-slate-300/90 text-sm">Choose your household and launch the dashboard</p>
        </div>

        {/* Household Cards */}
        <div className="space-y-3 stagger-list">
          {FAMILIES.map((family) => (
            <button
              key={family.id}
              onClick={() => selectHousehold(family.name)}
              className="w-full flex items-center gap-4 p-4 glass-panel hover-lift border border-slate-700/70 hover:border-slate-500/70 rounded-2xl transition-all active:scale-[0.98]"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-600/60"
                style={{ backgroundColor: `${family.color}20` }}
              >
                <Home className="w-6 h-6" style={{ color: family.color }} />
              </div>
              <div className="text-left">
                <p className="text-lg font-semibold text-white">{family.name}</p>
                <p className="text-xs text-slate-400">Household</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
