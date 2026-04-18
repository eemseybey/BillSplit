import type { Bill, BillSplit, FamilyName, SplitRules, UtilityType } from '../types';
import { BILL_DUE_DAY, DEFAULT_SPLIT_RULES, DEFAULT_UTILITY_DUE_DAYS, FAMILY_NAMES } from './constants';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateSplits(
  utility: UtilityType,
  totalAmount: number,
  splitRules?: SplitRules
): BillSplit[] {
  const rules = splitRules ?? DEFAULT_SPLIT_RULES;
  const rule = rules[utility];

  if (rule?.type === 'custom' || rule?.type === 'fixed-ocanada') {
    const fixedAmounts: Partial<Record<FamilyName, number>> = rule.type === 'fixed-ocanada'
      ? { Ocanada: rule.ocanadaFixed ?? 0 }
      : rule.fixedAmounts ?? {};
    const remainderFamilies: FamilyName[] = rule.type === 'fixed-ocanada'
      ? FAMILY_NAMES.filter((f) => f !== 'Ocanada')
      : rule.remainderFamilies ?? [];

    const shares: Record<FamilyName, number> = { Bacarisas: 0, Ocanada: 0, Patino: 0 };
    let fixedTotal = 0;
    for (const family of FAMILY_NAMES) {
      const amount = fixedAmounts[family];
      if (typeof amount === 'number' && amount > 0) {
        shares[family] = amount;
        fixedTotal += amount;
      }
    }

    const remainder = Math.max(0, totalAmount - fixedTotal);
    if (remainderFamilies.length > 0 && remainder > 0) {
      const per = round2(remainder / remainderFamilies.length);
      const leftover = round2(remainder - per * remainderFamilies.length);
      remainderFamilies.forEach((family, idx) => {
        shares[family] = round2(shares[family] + per + (idx === 0 ? leftover : 0));
      });
    } else if (remainder > 0) {
      // No remainder families defined — dump onto the first family with any fixed,
      // or onto Bacarisas as a safe default.
      const target = (FAMILY_NAMES.find((f) => fixedAmounts[f] !== undefined) ?? 'Bacarisas') as FamilyName;
      shares[target] = round2(shares[target] + remainder);
    }

    // Cap total if fixed amounts exceed total: scale down proportionally isn't right,
    // just trust user inputs and return as-is.
    return FAMILY_NAMES.map((family) => ({
      family,
      amount: round2(shares[family]),
      isPaid: false,
    }));
  }

  // Equal split
  const thirdAmount = round2(totalAmount / 3);
  const leftover = round2(totalAmount - thirdAmount * 3);

  return [
    { family: 'Bacarisas', amount: round2(thirdAmount + leftover), isPaid: false },
    { family: 'Ocanada', amount: thirdAmount, isPaid: false },
    { family: 'Patino', amount: thirdAmount, isPaid: false },
  ];
}

export function calculateTapalOwed(
  splits: BillSplit[],
  paidBy: FamilyName
): { family: FamilyName; amount: number }[] {
  return splits
    .filter((s) => s.family !== paidBy && !s.isPaid)
    .map((s) => ({ family: s.family, amount: s.amount }));
}

export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function getDueDate(monthKey: string): Date {
  const [year, month] = monthKey.split('-');
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, BILL_DUE_DAY);
}

export function getDueDateForUtility(
  monthKey: string,
  utility: UtilityType,
  dueDays?: Partial<Record<UtilityType, number>>
): Date {
  const [year, month] = monthKey.split('-');
  const day = dueDays?.[utility] ?? DEFAULT_UTILITY_DUE_DAYS[utility] ?? BILL_DUE_DAY;
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, day);
}

export function getBillDueDate(
  bill: Pick<Bill, 'dueDate' | 'month' | 'utility'>,
  dueDays?: Partial<Record<UtilityType, number>>
): Date {
  if (bill.dueDate) {
    const parsed = new Date(bill.dueDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return getDueDateForUtility(bill.month, bill.utility, dueDays);
}

export function isBillDueSoon(
  bill: Pick<Bill, 'dueDate' | 'month' | 'utility'>,
  dueDays?: Partial<Record<UtilityType, number>>,
  windowDays = 5
): boolean {
  const due = getBillDueDate(bill, dueDays);
  const now = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilDue >= 0 && daysUntilDue <= windowDays;
}

export function isBillOverdue(
  bill: Pick<Bill, 'dueDate' | 'month' | 'utility'>,
  dueDays?: Partial<Record<UtilityType, number>>
): boolean {
  const due = getBillDueDate(bill, dueDays);
  return new Date() > due;
}

export function isDueSoon(monthKey: string): boolean {
  const due = getDueDate(monthKey);
  const now = new Date();
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilDue >= 0 && daysUntilDue <= 5;
}

export function isOverdue(monthKey: string): boolean {
  const due = getDueDate(monthKey);
  return new Date() > due;
}
