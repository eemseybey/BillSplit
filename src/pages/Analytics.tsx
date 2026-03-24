import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useBills, usePayments } from '../hooks/useFirestore';
import { formatCurrency, getMonthLabel } from '../lib/billCalculator';
import { calculateBalances } from '../lib/firestore';
import { FAMILY_COLORS } from '../lib/constants';
import type { FamilyName, UtilityType } from '../types';

const UTILITY_COLORS: Record<UtilityType, string> = {
  VECO: '#eab308',
  PLDT: '#3b82f6',
  MCWD: '#06b6d4',
};

export default function Analytics() {
  const { bills, loading } = useBills();
  const { payments } = usePayments();

  // Monthly totals for line chart (last 6 months)
  const monthlyTrends = useMemo(() => {
    const months = new Map<string, Record<UtilityType, number>>();
    for (const bill of bills) {
      if (!months.has(bill.month)) {
        months.set(bill.month, { VECO: 0, PLDT: 0, MCWD: 0 });
      }
      months.get(bill.month)![bill.utility] += bill.totalAmount;
    }

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: getMonthLabel(month).replace(/ \d{4}$/, ''),
        ...data,
        total: data.VECO + data.PLDT + data.MCWD,
      }));
  }, [bills]);

  // Utility breakdown for pie chart
  const utilityBreakdown = useMemo(() => {
    const totals: Record<UtilityType, number> = { VECO: 0, PLDT: 0, MCWD: 0 };
    for (const bill of bills) {
      totals[bill.utility] += bill.totalAmount;
    }
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [bills]);

  // Per-family spending
  const familySpending = useMemo(() => {
    const spending: Record<FamilyName, number> = { Bacarisas: 0, Ocanada: 0, Patino: 0 };
    for (const bill of bills) {
      for (const split of bill.splits) {
        spending[split.family] += split.amount;
      }
    }
    return Object.entries(spending).map(([name, amount]) => ({
      name,
      amount,
      color: FAMILY_COLORS[name as FamilyName],
    }));
  }, [bills]);

  // Month-over-month change
  const monthChange = useMemo(() => {
    if (monthlyTrends.length < 2) return null;
    const current = monthlyTrends[monthlyTrends.length - 1].total;
    const previous = monthlyTrends[monthlyTrends.length - 2].total;
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { current, previous, change };
  }, [monthlyTrends]);

  // Average monthly bill
  const averageMonthly = useMemo(() => {
    if (monthlyTrends.length === 0) return 0;
    return monthlyTrends.reduce((sum, m) => sum + m.total, 0) / monthlyTrends.length;
  }, [monthlyTrends]);

  // Balances
  const balances = useMemo(() => calculateBalances(bills, payments), [bills, payments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">No data yet. Start by entering your bills.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Analytics</h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Avg Monthly</p>
          <p className="text-lg font-bold">{formatCurrency(averageMonthly)}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Month Change</p>
          {monthChange ? (
            <div className="flex items-center gap-1">
              {monthChange.change > 0 ? (
                <TrendingUp className="w-4 h-4 text-danger-400" />
              ) : monthChange.change < 0 ? (
                <TrendingDown className="w-4 h-4 text-success-400" />
              ) : (
                <Minus className="w-4 h-4 text-slate-400" />
              )}
              <p
                className={`text-lg font-bold ${
                  monthChange.change > 0
                    ? 'text-danger-400'
                    : monthChange.change < 0
                      ? 'text-success-400'
                      : 'text-slate-400'
                }`}
              >
                {monthChange.change > 0 ? '+' : ''}
                {monthChange.change.toFixed(1)}%
              </p>
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-400">N/A</p>
          )}
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Monthly Spending Trend</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value) => [formatCurrency(Number(value)), '']}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="VECO" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="PLDT" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="MCWD" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Utility Breakdown Pie */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Utility Breakdown (All Time)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={utilityBreakdown}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {utilityBreakdown.map((entry) => (
                <Cell key={entry.name} fill={UTILITY_COLORS[entry.name as UtilityType]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              formatter={(value) => [formatCurrency(Number(value)), '']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Family Spending Bar Chart */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Total per Family (All Time)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={familySpending}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              formatter={(value) => [formatCurrency(Number(value)), 'Total']}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
              {familySpending.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance Summary */}
      {balances.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Net Balances</h3>
          <div className="space-y-2">
            {balances.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50">
                <span className="text-sm">
                  <span style={{ color: FAMILY_COLORS[b.from] }}>{b.from}</span>
                  {' owes '}
                  <span style={{ color: FAMILY_COLORS[b.to] }}>{b.to}</span>
                </span>
                <span className="font-bold text-danger-400">{formatCurrency(b.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Payments</h3>
          <div className="space-y-2">
            {payments.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/50">
                <div>
                  <span className="text-sm">
                    <span style={{ color: FAMILY_COLORS[p.from] }}>{p.from}</span>
                    {' → '}
                    <span style={{ color: FAMILY_COLORS[p.to] }}>{p.to}</span>
                  </span>
                  <p className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString('en-PH')}</p>
                </div>
                <span className="text-sm font-medium text-success-400">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
