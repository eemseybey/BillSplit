import { useHousehold } from '../context/HouseholdContext';
import { FAMILIES } from '../lib/constants';
import { Home } from 'lucide-react';

export default function HouseholdSelect() {
  const { selectHousehold } = useHousehold();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto">
            ₱
          </div>
          <h1 className="text-2xl font-bold text-white">BillSplit</h1>
          <p className="text-slate-400 text-sm">Select your household to get started</p>
        </div>

        {/* Household Cards */}
        <div className="space-y-3">
          {FAMILIES.map((family) => (
            <button
              key={family.id}
              onClick={() => selectHousehold(family.name)}
              className="w-full flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all active:scale-[0.98]"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
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
