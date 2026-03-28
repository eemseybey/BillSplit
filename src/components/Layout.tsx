import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Receipt, HandCoins, BarChart3, Settings, Bell, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isBillOverdue, isBillDueSoon, getMonthKey } from '../lib/billCalculator';
import { useBills, useSettings } from '../hooks/useFirestore';
import { useHousehold } from '../context/HouseholdContext';
import { FAMILY_COLORS } from '../lib/constants';
import ErrorPanel from './ErrorPanel';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bills', icon: Receipt, label: 'Bills' },
  { to: '/tapal', icon: HandCoins, label: 'Tapal' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { household, clearHousehold } = useHousehold();
  const { bills, error: billsError, refresh } = useBills();
  const { settings } = useSettings();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const currentMonth = getMonthKey();
    const currentBills = bills.filter((b) => b.month === currentMonth);
    const overdueCount = currentBills.filter((b) => isBillOverdue(b, settings?.utilityDueDays) && !b.isPaidToProvider).length;
    const dueSoonCount = currentBills.filter((b) => isBillDueSoon(b, settings?.utilityDueDays) && !b.isPaidToProvider).length;
    setAlertCount(overdueCount + dueSoonCount);
  }, [bills, settings?.utilityDueDays]);

  return (
    <div className="min-h-screen aurora-shell flex flex-col">
      {/* Header */}
      <header className="glass-heavy sticky top-0 z-50 border-b border-slate-700/70 fade-slide-in">
        <div className="relative z-10 max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm animated-gradient-btn subtle-pulse-border">
              ₱
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">BillSplit</h1>
              <p className="text-[10px] text-slate-400 -mt-0.5">Household Control Deck</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative glass-panel rounded-full p-1.5" aria-label={`Bill alerts: ${alertCount}`}>
              <Bell className="w-5 h-5 text-slate-400" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-danger-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {alertCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 glass-panel rounded-full px-2.5 py-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: household ? FAMILY_COLORS[household] : undefined }}
              />
              <span className="text-xs text-slate-400">{household}</span>
            </div>
            <button
              onClick={clearHousehold}
              className="glass-panel rounded-full p-2 text-slate-400 hover:text-slate-200 interactive-press"
              title="Switch household"
              aria-label="Switch household"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-28 fade-slide-in">
        {billsError && <ErrorPanel message={billsError} onRetry={() => void refresh()} />}
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-3 left-0 right-0 z-50 px-4">
        <div className="max-w-lg mx-auto glass-heavy rounded-2xl border border-slate-600/70 flex justify-around py-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs rounded-xl transition-all interactive-press ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-400/10 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/40'
                }`
              }
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
