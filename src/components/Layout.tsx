import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Receipt, HandCoins, BarChart3, Settings, Bell, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isOverdue, isDueSoon, getMonthKey } from '../lib/billCalculator';
import { useBills } from '../hooks/useFirestore';
import { useHousehold } from '../context/HouseholdContext';
import { FAMILY_COLORS } from '../lib/constants';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/bills', icon: Receipt, label: 'Bills' },
  { to: '/tapal', icon: HandCoins, label: 'Tapal' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout() {
  const { household, clearHousehold } = useHousehold();
  const { bills } = useBills();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const currentMonth = getMonthKey();
    const currentBills = bills.filter((b) => b.month === currentMonth);
    const overdueCount = currentBills.filter((b) => isOverdue(b.month) && !b.isPaidToProvider).length;
    const dueSoonCount = currentBills.filter((b) => isDueSoon(b.month) && !b.isPaidToProvider).length;
    setAlertCount(overdueCount + dueSoonCount);
  }, [bills]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center font-bold text-sm">
              ₱
            </div>
            <h1 className="text-lg font-bold text-white">BillSplit</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-slate-400" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                  {alertCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: household ? FAMILY_COLORS[household] : undefined }}
              />
              <span className="text-xs text-slate-400">{household}</span>
            </div>
            <button
              onClick={clearHousehold}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Switch household"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-md border-t border-slate-700 z-50">
        <div className="max-w-lg mx-auto flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                  isActive ? 'text-primary-400' : 'text-slate-400 hover:text-slate-300'
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
