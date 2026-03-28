import type { Bill, BillSplit, FamilyName, SplitRules, UtilityType } from '../types';
import { BILL_DUE_DAY, DEFAULT_SPLIT_RULES, DEFAULT_UTILITY_DUE_DAYS, OCANADA_FIXED } from './constants';

export function calculateSplits(
  utility: UtilityType,
  totalAmount: number,
  splitRules?: SplitRules
): BillSplit[] {
  const rules = splitRules ?? DEFAULT_SPLIT_RULES;
  const utilityRule = rules[utility];
  const fixedAmount =
    utilityRule?.type === 'fixed-ocanada'
      ? utilityRule.ocanadaFixed ?? OCANADA_FIXED[utility]
      : OCANADA_FIXED[utility];

  if (fixedAmount !== undefined) {
    // VECO or PLDT: Ocanada pays fixed, rest split between Bacarisas & Patino
    const ocanadaShare = Math.min(fixedAmount, totalAmount);
    const remainder = totalAmount - ocanadaShare;
    const halfRemainder = Math.round((remainder / 2) * 100) / 100;

    return [
      { family: 'Bacarisas', amount: halfRemainder, isPaid: false },
      { family: 'Ocanada', amount: ocanadaShare, isPaid: false },
      { family: 'Patino', amount: halfRemainder, isPaid: false },
    ];
  }

  // MCWD: Equal 3-way split
  const thirdAmount = Math.round((totalAmount / 3) * 100) / 100;
  // Handle rounding: give any extra centavo to the first family
  const remainder = Math.round((totalAmount - thirdAmount * 3) * 100) / 100;

  return [
    { family: 'Bacarisas', amount: Math.round((thirdAmount + remainder) * 100) / 100, isPaid: false },
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
