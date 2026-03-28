import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Wifi, Droplets, AlertTriangle, TrendingUp, ArrowRight, Clock, Receipt, HandCoins } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBills, usePayments } from '../hooks/useFirestore';
import { formatCurrency, getMonthKey, getMonthLabel, isBillDueSoon, isBillOverdue } from '../lib/billCalculator';
import { calculateBalances } from '../lib/firestore';
import { FAMILY_COLORS, FAMILY_NAMES } from '../lib/constants';
import MonthPicker from '../components/MonthPicker';
import { useHousehold } from '../context/HouseholdContext';
import { useSettings } from '../hooks/useFirestore';
import ErrorPanel from '../components/ErrorPanel';

const utilityIcons = { VECO: Zap, PLDT: Wifi, MCWD: Droplets };
const utilityColors = { VECO: 'bg-yellow-500/20 text-yellow-400', PLDT: 'bg-blue-500/20 text-blue-400', MCWD: 'bg-cyan-500/20 text-cyan-400' };
type ExportFormat = 'csv' | 'html' | 'pdf' | 'xlsx';

export default function Dashboard() {
  const { household } = useHousehold();
  const [month, setMonth] = useState(getMonthKey());
  const [exportStartMonth, setExportStartMonth] = useState(getMonthKey());
  const [exportEndMonth, setExportEndMonth] = useState(getMonthKey());
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const { bills, loading, error: billsError, refresh: refreshBills } = useBills();
  const { payments, error: paymentsError, refresh: refreshPayments } = usePayments();
  const { settings } = useSettings();

  const monthBills = useMemo(() => bills.filter((b) => b.month === month), [bills, month]);
  const totalThisMonth = useMemo(() => monthBills.reduce((sum, b) => sum + b.totalAmount, 0), [monthBills]);

  const balances = useMemo(() => calculateBalances(bills, payments), [bills, payments]);

  const alerts = useMemo(() => {
    const items: { type: 'overdue' | 'due-soon'; message: string }[] = [];
    for (const bill of monthBills) {
      if (!bill.isPaidToProvider) {
        if (isBillOverdue(bill, settings?.utilityDueDays)) {
          items.push({ type: 'overdue', message: `${bill.utility} bill is OVERDUE!` });
        } else if (isBillDueSoon(bill, settings?.utilityDueDays)) {
          items.push({ type: 'due-soon', message: `${bill.utility} bill is due soon` });
        }
      }
    }
    return items;
  }, [monthBills, settings?.utilityDueDays]);

  const myShare = useMemo(() => {
    return monthBills.reduce((sum, b) => {
      const split = b.splits.find((s) => s.family === household);
      return sum + (split?.amount || 0);
    }, 0);
  }, [monthBills, household]);

  const getOutstandingBeforeMonth = useCallback(
    (family: (typeof FAMILY_NAMES)[number], targetMonth: string) => {
      return bills.reduce((sum, bill) => {
        if (bill.month >= targetMonth) return sum;
        const split = bill.splits.find((item) => item.family === family);
        if (!split || split.isPaid) return sum;
        return sum + split.amount;
      }, 0);
    },
    [bills]
  );

  const handleExportRange = useCallback(async () => {
    if (!exportStartMonth || !exportEndMonth) {
      toast.error('Select both start and end months');
      return;
    }
    if (exportStartMonth > exportEndMonth) {
      toast.error('Start month must be earlier than or equal to end month');
      return;
    }

    const selectedBills = bills
      .filter((bill) => bill.month >= exportStartMonth && bill.month <= exportEndMonth)
      .sort((a, b) => (a.month === b.month ? a.utility.localeCompare(b.utility) : a.month.localeCompare(b.month)));

    if (selectedBills.length === 0) {
      toast.error('No bill records found in selected month range');
      return;
    }

    const rows: string[][] = [
      [
        'month',
        'utility',
        'person',
        'bill_amount_per_utility',
        'person_share_for_utility',
        'person_paid_for_utility',
        'person_outstanding_before_month',
        'paid_for_by_if_not_fully_paid',
      ],
    ];

    for (const bill of selectedBills) {
      for (const family of FAMILY_NAMES) {
        const split = bill.splits.find((item) => item.family === family);
        const shareAmount = split?.amount ?? 0;
        const paidAmount =
          bill.paidBy === family
            ? bill.totalAmount
            : split?.isPaid
              ? shareAmount
              : 0;
        const outstandingBefore = getOutstandingBeforeMonth(family, bill.month);
        const paidForBy =
          paidAmount + 0.01 < shareAmount
            ? split?.paidTo ?? (bill.paidBy && bill.paidBy !== family ? bill.paidBy : '')
            : '';

        rows.push([
          bill.month,
          bill.utility,
          family,
          bill.totalAmount.toFixed(2),
          shareAmount.toFixed(2),
          paidAmount.toFixed(2),
          outstandingBefore.toFixed(2),
          paidForBy,
        ]);
      }
    }

    const baseFilename = `bill-export-${exportStartMonth}-to-${exportEndMonth}`;

    if (exportFormat === 'csv') {
      const csv = rows
        .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('CSV export generated');
      return;
    }

    const tableHeaders = rows[0];
    const tableRows = rows.slice(1);
    const htmlDocument = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill Export ${exportStartMonth} to ${exportEndMonth}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    p { font-size: 12px; color: #334155; margin-top: 0; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #e2e8f0; position: sticky; top: 0; }
    tbody tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>Bill Export</h1>
  <p>Range: ${exportStartMonth} to ${exportEndMonth}</p>
  <table>
    <thead>
      <tr>${tableHeaders.map((header) => `<th>${header}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${tableRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;

    if (exportFormat === 'html') {
      const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFilename}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('HTML export generated');
      return;
    }

    if (exportFormat === 'pdf') {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
      if (!printWindow) {
        toast.error('Unable to open print window for PDF export');
        return;
      }
      printWindow.document.write(htmlDocument);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      toast.success('Use "Save as PDF" in the print dialog');
      return;
    }

    if (exportFormat === 'xlsx') {
      try {
        const XLSX = await import('xlsx');
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Bill Export');
        XLSX.writeFile(workbook, `${baseFilename}.xlsx`);
        toast.success('XLSX export generated');
      } catch {
        toast.error('XLSX export unavailable. Install dependency: npm install xlsx');
      }
    }
  }, [bills, exportStartMonth, exportEndMonth, exportFormat, getOutstandingBeforeMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-slide-in">
      <MonthPicker value={month} onChange={setMonth} />
      {(billsError || paymentsError) && (
        <ErrorPanel
          message={billsError ?? paymentsError ?? 'Failed to load dashboard data'}
          onRetry={() => {
            void refreshBills();
            void refreshPayments();
          }}
        />
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 stagger-list">
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
        <div className="glass-panel gradient-outline rounded-2xl p-4 hover-lift">
          <p className="text-xs text-slate-400 mb-1">Total Bills</p>
          <p className="text-xl font-bold text-white tracking-tight">{formatCurrency(totalThisMonth)}</p>
        </div>
        <div className="glass-panel gradient-outline rounded-2xl p-4 hover-lift">
          <p className="text-xs text-slate-400 mb-1">My Share</p>
          <p className="text-xl font-bold text-primary-400">{formatCurrency(myShare)}</p>
        </div>
      </div>

      {/* Utility Breakdown */}
      <div className="glass-panel rounded-2xl p-4 hover-lift">
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
          <div className="space-y-3 stagger-list">
            {monthBills.map((bill) => {
              const Icon = utilityIcons[bill.utility];
              const paidSplits = bill.splits.filter((s) => s.isPaid).length;
              return (
                <div key={bill.id} className="flex items-center justify-between rounded-xl bg-slate-900/35 border border-slate-700/50 px-3 py-2.5">
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
                    ) : isBillOverdue(bill, settings?.utilityDueDays) ? (
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
      <div className="glass-panel rounded-2xl p-4 hover-lift">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          <TrendingUp className="w-4 h-4 inline mr-1" />
          Outstanding Balances
        </h3>
        {balances.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">All settled up!</p>
        ) : (
          <div className="space-y-2 stagger-list">
            {balances.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-900/45 border border-slate-700/50">
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FAMILY_COLORS[b.from] }}
                  />
                  <span>{b.from}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FAMILY_COLORS[b.to] }}
                  />
                  <span>{b.to}</span>
                </div>
                <span className="text-sm font-semibold text-danger-400">{formatCurrency(b.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="glass-panel rounded-2xl p-4 hover-lift">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Export by Month Range</h3>
        <p className="text-xs text-slate-400 mb-3">
          Export per person + utility: bill amount, person paid amount, outstanding before month, and who covered if not fully paid.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="text-xs text-slate-400">
            Start
            <input
              type="month"
              value={exportStartMonth}
              onChange={(event) => setExportStartMonth(event.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-primary-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            End
            <input
              type="month"
              value={exportEndMonth}
              onChange={(event) => setExportEndMonth(event.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-primary-500"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-400 mb-3">
          Format
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
            className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-xl px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-primary-500"
          >
            <option value="csv">CSV</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>
        <button
          onClick={handleExportRange}
          className="w-full py-2.5 rounded-xl animated-gradient-btn font-medium hover-lift interactive-press"
        >
          Export {exportFormat.toUpperCase()}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/bills"
          className="animated-gradient-btn hover-lift interactive-press rounded-2xl p-4 text-center"
        >
          <Receipt className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Enter Bills</span>
        </Link>
        <Link
          to="/tapal"
          className="glass-panel hover-lift interactive-press rounded-2xl p-4 text-center"
        >
          <HandCoins className="w-6 h-6 mx-auto mb-1" />
          <span className="text-sm font-medium">Tapal Mode</span>
        </Link>
      </div>
    </div>
  );
}
