import { useState, useMemo, useCallback } from 'react';
import { HandCoins, ArrowRight, Check, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBills, usePayments, useSettings } from '../hooks/useFirestore';
import { formatCurrency, getMonthKey, getMonthLabel, calculateTapalOwed } from '../lib/billCalculator';
import { updateBill, addPayment, calculateBalances } from '../lib/firestore';
import { sendSMS, buildTapalMessage } from '../lib/sms';
import { FAMILY_COLORS, FAMILIES, FAMILY_NAMES } from '../lib/constants';
import { SMS_ENABLED } from '../lib/features';
import type { Bill, FamilyName } from '../types';
import MonthPicker from '../components/MonthPicker';
import { useHousehold } from '../context/HouseholdContext';
import ErrorPanel from '../components/ErrorPanel';

export default function Tapal() {
  const { household } = useHousehold();
  const [month, setMonth] = useState(getMonthKey());
  const { bills, refresh: refreshBills, error: billsError } = useBills();
  const { payments, refresh: refreshPayments, error: paymentsError } = usePayments();
  const { settings, error: settingsError, refresh: refreshSettings } = useSettings();
  const [processing, setProcessing] = useState<string | null>(null);
  const [tapalForm, setTapalForm] = useState<{ billId: string; paidBy: FamilyName; contributions: Record<FamilyName, string> } | null>(null);

  const monthBills = useMemo(() => bills.filter((b) => b.month === month), [bills, month]);
  const balances = useMemo(() => calculateBalances(bills, payments), [bills, payments]);

  const unpaidBills = useMemo(
    () => monthBills.filter((b) => !b.paidBy && !b.isPaidToProvider),
    [monthBills]
  );

  const openTapalForm = useCallback(
    (bill: Bill, paidBy: FamilyName) => {
      const contributions = Object.fromEntries(
        bill.splits.map((s) => [s.family, s.amount.toFixed(2)])
      ) as Record<FamilyName, string>;
      setTapalForm({ billId: bill.id, paidBy, contributions });
    },
    []
  );

  const handleConfirmTapal = useCallback(
    async () => {
      if (!tapalForm) return;
      const bill = bills.find((b) => b.id === tapalForm.billId);
      if (!bill) return;

      const { paidBy, contributions } = tapalForm;

      // Validate total contributions match bill total
      const totalContributions = FAMILY_NAMES.reduce((sum, f) => sum + (parseFloat(contributions[f]) || 0), 0);
      const diff = Math.abs(totalContributions - bill.totalAmount);
      if (diff > 0.02) {
        toast.error(`Contributions don't add up to ${formatCurrency(bill.totalAmount)} (off by ${formatCurrency(diff)})`);
        return;
      }

      setProcessing(bill.id);
      try {
        const now = new Date().toISOString();
        const newSplits = bill.splits.map((s) => {
          const contributed = parseFloat(contributions[s.family]) || 0;
          const paid = contributed >= s.amount;
          const split = { ...s, amount: s.amount, isPaid: paid };
          if (paid) split.paidDate = now;
          else delete split.paidDate;
          if (!paid) split.paidTo = paidBy;
          else delete split.paidTo;
          return split;
        });

        await updateBill(bill.id, {
          paidBy,
          splits: newSplits,
          isPaidToProvider: true,
        });

        // Send SMS notifications for families that didn't pay their full share
        if (SMS_ENABLED && settings?.smsConfig?.enabled && settings.smsConfig.apiKey) {
          for (const s of newSplits) {
            if (s.family !== paidBy && !s.isPaid) {
              const contributed = parseFloat(contributions[s.family]) || 0;
              const owedAmount = s.amount - contributed;
              if (owedAmount > 0.01) {
                const family = FAMILIES.find((f) => f.name === s.family);
                if (family?.phone) {
                  const message = buildTapalMessage(
                    s.family,
                    paidBy,
                    owedAmount,
                    bill.utility,
                    getMonthLabel(month)
                  );
                  const result = await sendSMS(settings.smsConfig.apiKey, family.phone, message);
                  if (!result.success) {
                    toast.error(`SMS failed for ${s.family}: ${result.message}`);
                  }
                }
              }
            }
          }
        }

        toast.success(`${paidBy} tapal'd the ${bill.utility} bill!`);
        setTapalForm(null);
        await refreshBills();
      } catch (err) {
        console.error('Failed to process tapal:', err);
        toast.error('Failed to process tapal');
      } finally {
        setProcessing(null);
      }
    },
    [tapalForm, bills, month, settings, refreshBills]
  );

  const handleRecordPayment = useCallback(
    async (from: FamilyName, to: FamilyName, amount: number) => {
      try {
        await addPayment({
          kind: 'settlement',
          from,
          to,
          amount,
          month,
          date: new Date().toISOString(),
          note: 'Settling balance',
          ...(household && { householdId: household }),
        });
        toast.success(`Recorded ${from}'s payment of ${formatCurrency(amount)} to ${to}`);
        await refreshPayments();
        await refreshBills();
      } catch (err) {
        console.error('Failed to record payment:', err);
        toast.error('Failed to record payment');
      }
    },
    [month, refreshPayments, refreshBills, household]
  );

  return (
    <div className="space-y-4 fade-slide-in">
      <MonthPicker value={month} onChange={setMonth} />
      {(billsError || paymentsError || settingsError) && (
        <ErrorPanel
          message={billsError ?? paymentsError ?? settingsError ?? 'Failed to load tapal data'}
          onRetry={() => {
            void refreshBills();
            void refreshPayments();
            void refreshSettings();
          }}
        />
      )}

      {/* Tapal Header */}
      <div className="glass-panel gradient-outline rounded-2xl p-4 hover-lift">
        <div className="flex items-center gap-2 mb-2">
          <HandCoins className="w-5 h-5 text-primary-400" />
          <h2 className="font-semibold text-primary-300">Tapal Mode</h2>
        </div>
        <p className="text-xs text-slate-400">
          Select a bill and mark who paid for everyone. The app will calculate and track what others owe.
        </p>
      </div>

      {/* Unpaid Bills for Tapal */}
      {unpaidBills.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Unpaid Bills This Month</h3>
          {unpaidBills.map((bill) => {
            const isExpanded = tapalForm?.billId === bill.id;
            return (
              <div key={bill.id} className="glass-panel rounded-2xl p-4 hover-lift">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">{bill.utility}</span>
                  <span className="text-lg font-bold">{formatCurrency(bill.totalAmount)}</span>
                </div>

                {!isExpanded ? (
                  <>
                    <p className="text-xs text-slate-400 mb-3">Who paid this bill?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {FAMILY_NAMES.map((family) => (
                        <button
                          key={family}
                          onClick={() => openTapalForm(bill, family)}
                          disabled={processing === bill.id}
                          className="py-2 px-3 rounded-xl text-sm font-medium transition-all hover:scale-105 interactive-press"
                          style={{
                            backgroundColor: `${FAMILY_COLORS[family]}20`,
                            color: FAMILY_COLORS[family],
                            border: `1px solid ${FAMILY_COLORS[family]}40`,
                          }}
                        >
                          {family}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold" style={{ color: FAMILY_COLORS[tapalForm.paidBy] }}>{tapalForm.paidBy}</span> paid the provider. How much did each family contribute?
                      </p>
                      <button onClick={() => setTapalForm(null)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 mb-3">
                      {bill.splits.map((split) => (
                        <div key={split.family} className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-slate-900/45 border border-slate-700/50">
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FAMILY_COLORS[split.family] }} />
                            <span className="text-sm">{split.family}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">due {formatCurrency(split.amount)}</span>
                            <div className="relative w-[120px]">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">₱</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={tapalForm.contributions[split.family]}
                                onChange={(e) =>
                                  setTapalForm((prev) =>
                                    prev ? { ...prev, contributions: { ...prev.contributions, [split.family]: e.target.value } } : null
                                  )
                                }
                                className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-7 pr-3 py-1.5 text-sm text-right font-medium focus:outline-none focus:border-primary-500 transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Contribution summary */}
                    {(() => {
                      const totalContrib = FAMILY_NAMES.reduce((sum, f) => sum + (parseFloat(tapalForm.contributions[f]) || 0), 0);
                      const diff = Math.round((totalContrib - bill.totalAmount) * 100) / 100;
                      const owes = bill.splits
                        .filter((s) => s.family !== tapalForm.paidBy)
                        .map((s) => {
                          const contributed = parseFloat(tapalForm.contributions[s.family]) || 0;
                          const owed = Math.max(0, s.amount - contributed);
                          return { family: s.family, owed };
                        })
                        .filter((o) => o.owed > 0.01);

                      return (
                        <div className="space-y-2">
                          {diff !== 0 && (
                            <p className={`text-xs ${Math.abs(diff) > 0.02 ? 'text-red-400' : 'text-slate-500'}`}>
                              {diff > 0 ? `Over by ${formatCurrency(diff)}` : `Under by ${formatCurrency(Math.abs(diff))}`}
                            </p>
                          )}
                          {owes.length > 0 && (
                            <div className="bg-slate-900/35 rounded-xl p-2 border border-slate-700/50">
                              <p className="text-xs text-slate-500 mb-1">Will owe {tapalForm.paidBy}:</p>
                              {owes.map((o) => (
                                <div key={o.family} className="flex justify-between text-xs py-0.5">
                                  <span style={{ color: FAMILY_COLORS[o.family] }}>{o.family}</span>
                                  <span className="text-danger-400">{formatCurrency(o.owed)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleConfirmTapal}
                      disabled={processing === bill.id}
                      className="mt-3 w-full py-2.5 animated-gradient-btn disabled:bg-slate-600 rounded-xl font-medium text-sm transition-all hover-lift"
                    >
                      {processing === bill.id ? 'Processing...' : 'Confirm Tapal'}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-slate-500 text-sm">
            {monthBills.length === 0
              ? 'No bills entered for this month'
              : 'All bills are already settled or tapal\'d'}
          </p>
        </div>
      )}

      {/* Outstanding Balances */}
      <div className="glass-panel rounded-2xl p-4 hover-lift">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Outstanding Balances (All Time)</h3>
        {balances.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">All settled up!</p>
        ) : (
          <div className="space-y-3">
            {balances.map((b, i) => (
              <div key={i} className="bg-slate-900/45 border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FAMILY_COLORS[b.from] }} />
                    <span>{b.from}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FAMILY_COLORS[b.to] }} />
                    <span>{b.to}</span>
                  </div>
                  <span className="font-bold text-danger-400">{formatCurrency(b.amount)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRecordPayment(b.from, b.to, b.amount)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-success-500/20 text-success-400 text-xs font-medium hover:bg-success-500/30 transition-colors interactive-press"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark Settled
                  </button>
                  {SMS_ENABLED && settings?.smsConfig?.enabled && (
                    <button
                      onClick={async () => {
                        const family = FAMILIES.find((f) => f.name === b.from);
                        if (family?.phone && settings.smsConfig.apiKey) {
                          const result = await sendSMS(
                            settings.smsConfig.apiKey,
                            family.phone,
                            `Hi ${b.from}! You owe ${b.to} ${formatCurrency(b.amount)}. Please settle when you can. - BillSplit Tracker`
                          );
                          toast[result.success ? 'success' : 'error'](result.message);
                        } else {
                          toast.error('Phone number not set for this family');
                        }
                      }}
                      className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-primary-500/20 text-primary-400 text-xs font-medium hover:bg-primary-500/30 transition-colors interactive-press"
                    >
                      <Send className="w-3.5 h-3.5" />
                      SMS
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tapal History */}
      {monthBills.filter((b) => b.paidBy).length > 0 && (
        <div className="glass-panel rounded-2xl p-4 hover-lift">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Tapal History This Month</h3>
          <div className="space-y-2">
            {monthBills
              .filter((b) => b.paidBy)
              .map((bill) => {
                const owed = calculateTapalOwed(bill.splits, bill.paidBy!);
                return (
                  <div key={bill.id} className="bg-slate-900/45 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{bill.utility}</span>
                      <span className="text-xs text-primary-400">Tapal by {bill.paidBy}</span>
                    </div>
                    {owed.map((o) => (
                      <div key={o.family} className="flex justify-between text-xs text-slate-400 py-0.5">
                        <span>{o.family} owes</span>
                        <span className="text-danger-400">{formatCurrency(o.amount)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
