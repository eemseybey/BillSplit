import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Wifi, Droplets, AlertTriangle, TrendingUp, ArrowRight, Clock } from 'lucide-react';
import { useBills, usePayments } from '../hooks/useFirestore';
import { formatCurrency, getMonthKey, getMonthLabel, isOverdue, isDueSoon } from '../lib/billCalculator';
import { calculateBalances } from '../lib/firestore';
import { FAMILY_COLORS } from '../lib/constants';
import type { FamilyName } from '../types';
import MonthPicker from '../components/MonthPicker';
import { useHousehold } from '../context/HouseholdContext';

const utilityIcons = { VECO: Zap, PLDT: Wifi, MCWD: Droplets };
const utilityColors = { VECO: 'bg-yellow-500/20 text-yellow-400', PLDT: 'bg-blue-500/20 text-blue-400', MCWD: 'bg-cyan-500/20 text-cyan-400' };

export default function Dashboard() {
  const { household } = useHousehold();
  const [month, setMonth] = useState(getMonthKey());
  const { bills, loading } = useBills();
  const { payments } = usePayments();

  const monthBills = useMemo(() => bills.filter((b) => b.month === month), [bills, month]);
  const totalThisMonth = useMemo(() => monthBills.reduce((sum, b) => sum + b.totalAmount, 0), [monthBills]);

  const balances = useMemo(() => calculateBalances(bills, payments), [bills, payments]);

  const alerts = useMemo(() => {
    const items: { type: 'overdue' | 'due-soon'; message: string }[] = [];
    for (const bill of monthBills) {
      if (!bill.isPaidToProvider) {
        if (isOverdue(bill.month)) {
          items.push({ type: 'overdue', message: `${bill.utility} bill is OVERDUE!` });
        } else if (isDueSoon(bill.month)) {
          items.push({ type: 'due-soon', message: `${bill.utility} bill is due soon` });
        }
      }
    }
    return items;
  }, [monthBills]);

  const myShare = useMemo(() => {
    return monthBills.reduce((sum, b) => {
      const split = b.splits.find((s) => s.family === household);
      return sum + (split?.amount || 0);
    }, 0);
  }, [monthBills]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MonthPicker value={month} onChange={setMonth} />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                alert.type === 'overdue'
                  ? 'bg-danger-500/15 border border-danger-500/30'
                  : 'bg-warning-500/15 border border-warning-500/30'
              }`}
            >
              {alert.type === 'overdue' ? (
                <AlertTriangle className="w-5 h-5 text-danger-400 shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-warning-400 shrink-0" />
              )}
              <span className="text-sm">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Total Bills</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalThisMonth)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">My Share</p>
          <p className="text-xl font-bold text-primary-400">{formatCurrency(myShare)}</p>
        </div>
      </div>

      {/* Utility Breakdown */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">This Month's Bills</h3>
        {monthBills.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500 text-sm">No bills entered for {getMonthLabel(month)}</p>
            <Link
              to="/bills"
              className="inline-flex items-center gap-1 mt-2 text-primary-400 text-sm hover:text-primary-300"
            >
              Add bills <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {monthBills.map((bill) => {
              const Icon = utilityIcons[bill.utility];
              const paidSplits = bill.splits.filter((s) => s.isPaid).length;
              return (
                <div key={bill.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${utilityColors[bill.utility]}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{bill.utility}</p>
                      <p className="text-xs text-slate-400">
                        {paidSplits}/{bill.splits.length} paid
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(bill.totalAmount)}</p>
                    {bill.isPaidToProvider ? (
                      <p className="text-xs text-success-400">Settled</p>
                    ) : isOverdue(bill.month) ? (
                      <p className="text-xs text-danger-400">Overdue</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Who Owes Who */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          <TrendingUp className="w-4 h-4 inline mr-1" />
          Outstanding Balances
        </h3>
        {balances.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">All settled up!</p>
        ) : (
          <div className="space-y-2">
            {balances.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50">
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FAMILY_COLORS[b.from as FamilyName] }}
                  />
                  <span>{b.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FAMILY_COLORS[b.to as FamilyName] }}
                  />
                  <span>{b.to}</span>
                </div>
                <span className="text-sm font-semibold text-danger-400">{formatCurrency(b.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/bills"
          className="bg-primary-600 hover:bg-primary-500 transition-colors rounded-xl p-4 text-center"
        >
          <Receipt className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Enter Bills</span>
        </Link>
        <Link
          to="/tapal"
          className="bg-slate-700 hover:bg-slate-600 transition-colors rounded-xl p-4 text-center"
        >
          <HandCoins className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Tapal Mode</span>
        </Link>
      </div>
    </div>
  );
}

// Import icons used in quick actions
import { Receipt, HandCoins } from 'lucide-react';
