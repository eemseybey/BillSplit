import { useMemo, useState } from 'react';
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
import { calculateBalances, deletePayment, updatePayment } from '../lib/firestore';
import { FAMILY_COLORS } from '../lib/constants';
import type { FamilyName, UtilityType } from '../types';
import ErrorPanel from '../components/ErrorPanel';
import ConfirmDialog from '../components/ConfirmDialog';

const UTILITY_COLORS: Record<UtilityType, string> = {
  VECO: '#eab308',
  PLDT: '#3b82f6',
  MCWD: '#06b6d4',
};

export default function Analytics() {
  const { bills, loading, error: billsError, refresh: refreshBills } = useBills();
  const { payments, error: paymentsError, refresh: refreshPayments } = usePayments();
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

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

  const utilityTrendAlerts = useMemo(() => {
    const byMonth = new Map<string, Record<UtilityType, number>>();
    for (const bill of bills) {
      if (!byMonth.has(bill.month)) {
        byMonth.set(bill.month, { VECO: 0, PLDT: 0, MCWD: 0 });
      }
      byMonth.get(bill.month)![bill.utility] += bill.totalAmount;
    }
    const entries = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length < 2) return [];
    const current = entries[entries.length - 1][1];
    const previous = entries[entries.length - 2][1];
    return (['VECO', 'PLDT', 'MCWD'] as UtilityType[])
      .map((utility) => {
        const prev = previous[utility];
        const curr = current[utility];
        if (prev <= 0) return null;
        const change = ((curr - prev) / prev) * 100;
        return Math.abs(change) >= 15 ? { utility, change } : null;
      })
      .filter((item): item is { utility: UtilityType; change: number } => item !== null);
  }, [bills]);

  const recentMonthKey = useMemo(() => {
    const sorted = [...new Set(bills.map((bill) => bill.month))].sort((a, b) => b.localeCompare(a));
    return sorted[0] ?? null;
  }, [bills]);
  const monthlyExportRows = useMemo(
    () => bills.filter((bill) => bill.month === recentMonthKey),
    [bills, recentMonthKey]
  );

  const handleDeletePayment = async () => {
    if (!deletingPaymentId) return;
    try {
      await deletePayment(deletingPaymentId);
      setDeletingPaymentId(null);
      await refreshPayments();
    } catch {
      setDeletingPaymentId(null);
    }
  };

  const beginEditPayment = (paymentId: string, amount: number) => {
    setEditingPaymentId(paymentId);
    setEditAmount(amount.toFixed(2));
  };

  const savePaymentEdit = async () => {
    if (!editingPaymentId) return;
    const amount = parseFloat(editAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      return;
    }
    try {
      await updatePayment(editingPaymentId, { amount });
      setEditingPaymentId(null);
      setEditAmount('');
      await refreshPayments();
    } catch {
      setEditingPaymentId(null);
    }
  };

  const exportMonthlyCsv = () => {
    if (!recentMonthKey || monthlyExportRows.length === 0) return;
    const rows = [
      ['month', 'utility', 'totalAmount', 'dueDate', 'paidBy', 'isPaidToProvider'],
      ...monthlyExportRows.map((bill) => [
        bill.month,
        bill.utility,
        bill.totalAmount.toFixed(2),
        bill.dueDate,
        bill.paidBy ?? '',
        String(bill.isPaidToProvider),
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billsummary-${recentMonthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    <div className="space-y-4 fade-slide-in">
      <h2 className="text-lg font-bold">Analytics</h2>
      {(billsError || paymentsError) && (
        <ErrorPanel
          message={billsError ?? paymentsError ?? 'Failed to load analytics'}
          onRetry={() => {
            void refreshBills();
            void refreshPayments();
          }}
        />
      )}
      <div className="flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-3 py-2 rounded-xl glass-panel text-xs text-slate-300 hover:border-primary-500 interactive-press"
        >
          Print Monthly Summary
        </button>
        <button
          onClick={exportMonthlyCsv}
          className="px-3 py-2 rounded-xl glass-panel text-xs text-slate-300 hover:border-primary-500 interactive-press"
        >
          Export CSV
        </button>
      </div>

      {utilityTrendAlerts.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 hover-lift">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Utility Trend Alerts</h3>
          <div className="space-y-2">
            {utilityTrendAlerts.map((alert) => (
              <p key={alert.utility} className="text-sm text-slate-300">
                {alert.utility}: {alert.change > 0 ? '+' : ''}
                {alert.change.toFixed(1)}% vs last month
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel rounded-2xl p-4 hover-lift">
          <p className="text-xs text-slate-400 mb-1">Avg Monthly</p>
          <p className="text-lg font-bold">{formatCurrency(averageMonthly)}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 hover-lift">
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
      <div className="glass-panel rounded-2xl p-4 hover-lift">
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
      <div className="glass-panel rounded-2xl p-4 hover-lift">
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
      <div className="glass-panel rounded-2xl p-4 hover-lift">
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
        <div className="glass-panel rounded-2xl p-4 hover-lift">
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
        <div className="glass-panel rounded-2xl p-4 hover-lift">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Payments</h3>
          <div className="space-y-2">
            {payments.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900/45 border border-slate-700/50">
                <div>
                  <span className="text-sm">
                    <span style={{ color: FAMILY_COLORS[p.from] }}>{p.from}</span>
                    {' → '}
                    <span style={{ color: FAMILY_COLORS[p.to] }}>{p.to}</span>
                  </span>
                  <p className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString('en-PH')}</p>
                  <p className="text-[11px] text-slate-500">
                    {p.kind === 'settlement' ? 'Settlement' : p.utility ?? 'Bill payment'}
                  </p>
                </div>
                <div className="text-right">
                  {editingPaymentId === p.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editAmount}
                        onChange={(event) => setEditAmount(event.target.value)}
                        className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs"
                      />
                      <button onClick={() => void savePaymentEdit()} className="text-xs text-primary-400">
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-success-400">{formatCurrency(p.amount)}</span>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <button onClick={() => beginEditPayment(p.id, p.amount)} className="text-xs text-slate-400 hover:text-primary-400">
                          Edit
                        </button>
                        <button onClick={() => setDeletingPaymentId(p.id)} className="text-xs text-slate-400 hover:text-danger-400">
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deletingPaymentId)}
        title="Delete payment?"
        description="This payment will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => void handleDeletePayment()}
        onCancel={() => setDeletingPaymentId(null)}
      />
    </div>
  );
}
