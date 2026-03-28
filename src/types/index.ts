export type FamilyName = 'Bacarisas' | 'Ocanada' | 'Patino';

export type UtilityType = 'VECO' | 'PLDT' | 'MCWD';
export type PaymentKind = 'bill' | 'settlement' | 'adjustment';

export interface Family {
  id: string;
  name: FamilyName;
  phone?: string;
  color: string;
}

export interface Bill {
  id: string;
  month: string; // Format: "2026-03"
  householdId?: string;
  utility: UtilityType;
  totalAmount: number;
  dueDate: string; // ISO date string
  createdAt: string;
  splits: BillSplit[];
  paidBy?: FamilyName; // Who paid the entire bill (tapal)
  isPaidToProvider: boolean; // Is the bill paid to the utility provider
  imageUrl?: string; // Photo of the bill
}

export interface BillSplit {
  family: FamilyName;
  amount: number;
  isPaid: boolean;
  paidDate?: string;
  paidTo?: FamilyName; // Who they paid (for tapal tracking)
}

export interface Payment {
  id: string;
  from: FamilyName;
  to: FamilyName;
  amount: number;
  householdId?: string;
  kind: PaymentKind;
  billId?: string;
  month: string;
  utility?: UtilityType;
  date: string;
  note?: string;
}

export interface MonthlyBills {
  month: string;
  bills: Bill[];
  totalAmount: number;
  isComplete: boolean; // All bills entered for the month
}

export interface FamilyBalance {
  family: FamilyName;
  owes: { to: FamilyName; amount: number }[];
  isOwed: { from: FamilyName; amount: number }[];
  netBalance: number; // Positive = is owed, negative = owes
}

export interface SMSConfig {
  apiKey: string;
  enabled: boolean;
  reminderDaysBefore: number;
}

export interface AppSettings {
  smsConfig: SMSConfig;
  families: Family[];
  splitRules?: SplitRules;
  utilityDueDays?: Partial<Record<UtilityType, number>>;
}

export interface UtilitySplitRule {
  type: 'equal' | 'fixed-ocanada';
  ocanadaFixed?: number;
}

export type SplitRules = Record<UtilityType, UtilitySplitRule>;
