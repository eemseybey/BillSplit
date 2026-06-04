import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, HandCoins, BarChart3, Settings, Bell, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { isBillOverdue, isBillDueSoon, getMonthKey, formatCurrency } from '../lib/billCalculator';
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
  const { household } = useHousehold();
  const { bills, error: billsError, refresh } = useBills();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Current-month bills that aren't yet paid to the provider, flagged overdue / due-soon.
  const alerts = useMemo(() => {
    const currentMonth = getMonthKey();
    return bills
      .filter((b) => b.month === currentMonth && !b.isPaidToProvider)
      .map((b) => {
        if (isBillOverdue(b, settings?.utilityDueDays)) {
          return { id: b.id, utility: b.utility, amount: b.totalAmount, type: 'overdue' as const };
        }
        if (isBillDueSoon(b, settings?.utilityDueDays)) {
          return { id: b.id, utility: b.utility, amount: b.totalAmount, type: 'due-soon' as const };
        }
        return null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }, [bills, settings?.utilityDueDays]);

  const alertCount = alerts.length;

  // Close the alerts dropdown on outside-click or Escape.
  useEffect(() => {
    if (!alertsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setAlertsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertsOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [alertsOpen]);

  const goToBills = () => {
    setAlertsOpen(false);
    navigate('/bills');
  };

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
              <h1 className="text-lg font-bold tracking-tight text-white">BillSplit</h1>
              <p className="text-[11px] text-slate-500 -mt-0.5">Shared household bills</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Alerts bell + dropdown */}
            <div className="relative" ref={alertsRef}>
              <button
                onClick={() => setAlertsOpen((o) => !o)}
                className="relative glass-panel rounded-full p-1.5 text-slate-400 hover:text-slate-200 interactive-press"
                aria-label={`Bill alerts: ${alertCount}`}
                aria-expanded={alertsOpen}
                aria-haspopup="true"
              >
                <Bell className="w-5 h-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-danger-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {alertCount}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div
                  role="dialog"
                  aria-label="Bill alerts"
                  className="absolute right-0 mt-2 w-72 glass-heavy rounded-2xl border border-slate-600/70 shadow-xl z-[120] overflow-hidden fade-slide-in"
                >
                  <div className="px-4 py-2.5 border-b border-slate-700/60">
                    <p className="text-sm font-semibold text-white">Alerts ({alertCount})</p>
                  </div>
                  {alertCount === 0 ? (
                    <p className="px-4 py-4 text-xs text-slate-400 text-center">
                      No overdue or upcoming bills this month.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/50">
                      {alerts.map((a) => (
                        <button
                          key={a.id}
                          onClick={goToBills}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/60 transition-colors"
                        >
                          {a.type === 'overdue' ? (
                            <AlertTriangle className="w-4 h-4 text-danger-400 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-warning-400 shrink-0" />
                          )}
                          <span className="text-sm text-slate-200 flex-1">{a.utility}</span>
                          <span className="text-xs text-slate-400">{formatCurrency(a.amount)}</span>
                          <span
                            className={`text-[10px] font-semibold uppercase ${
                              a.type === 'overdue' ? 'text-danger-400' : 'text-warning-400'
                            }`}
                          >
                            {a.type === 'overdue' ? 'Overdue' : 'Due soon'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={goToBills}
                    className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-primary-300 hover:bg-slate-800/60 border-t border-slate-700/60 transition-colors"
                  >
                    View all bills <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 glass-panel rounded-full px-2.5 py-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: FAMILY_COLORS[household] }}
              />
              <span className="text-xs text-slate-400">{household}</span>
            </div>
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
                    ? 'text-primary-300 bg-primary-500/12'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/60'
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
