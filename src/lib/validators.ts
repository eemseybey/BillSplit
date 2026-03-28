import type { AppSettings, Bill, BillSplit, Family, FamilyName, Payment, PaymentKind, UtilityType } from '../types';
import { DEFAULT_SPLIT_RULES, FAMILIES } from './constants';

const FAMILY_NAMES = new Set<FamilyName>(['Bacarisas', 'Ocanada', 'Patino']);
const UTILITY_TYPES = new Set<UtilityType>(['VECO', 'PLDT', 'MCWD']);
const PAYMENT_KINDS = new Set<PaymentKind>(['bill', 'settlement', 'adjustment']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFamilyName(value: unknown): FamilyName | null {
  return typeof value === 'string' && FAMILY_NAMES.has(value as FamilyName)
    ? (value as FamilyName)
    : null;
}

function parseUtility(value: unknown): UtilityType | null {
  return typeof value === 'string' && UTILITY_TYPES.has(value as UtilityType)
    ? (value as UtilityType)
    : null;
}

function parseSplit(value: unknown): BillSplit | null {
  if (!isObject(value)) return null;
  const family = parseFamilyName(value.family);
  if (!family || typeof value.amount !== 'number' || typeof value.isPaid !== 'boolean') return null;
  return {
    family,
    amount: value.amount,
    isPaid: value.isPaid,
    paidDate: typeof value.paidDate === 'string' ? value.paidDate : undefined,
    paidTo: parseFamilyName(value.paidTo) ?? undefined,
  };
}

export function parseBill(id: string, value: unknown): Bill | null {
  if (!isObject(value)) return null;
  const utility = parseUtility(value.utility);
  const splits = Array.isArray(value.splits) ? value.splits.map(parseSplit).filter(Boolean) as BillSplit[] : [];
  if (
    !utility ||
    typeof value.month !== 'string' ||
    typeof value.totalAmount !== 'number' ||
    typeof value.createdAt !== 'string' ||
    typeof value.isPaidToProvider !== 'boolean' ||
    splits.length !== (Array.isArray(value.splits) ? value.splits.length : -1)
  ) {
    return null;
  }
  return {
    id,
    householdId: typeof value.householdId === 'string' ? value.householdId : undefined,
    month: value.month,
    utility,
    totalAmount: value.totalAmount,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : '',
    createdAt: value.createdAt,
    splits,
    paidBy: parseFamilyName(value.paidBy) ?? undefined,
    isPaidToProvider: value.isPaidToProvider,
    imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined,
  };
}

export function parsePayment(id: string, value: unknown): Payment | null {
  if (!isObject(value)) return null;
  const from = parseFamilyName(value.from);
  const to = parseFamilyName(value.to);
  if (!from || !to || typeof value.amount !== 'number' || typeof value.month !== 'string' || typeof value.date !== 'string') {
    return null;
  }
  const rawKind = typeof value.kind === 'string' ? value.kind : 'bill';
  const kind: PaymentKind = PAYMENT_KINDS.has(rawKind as PaymentKind) ? (rawKind as PaymentKind) : 'bill';
  const utility = parseUtility(value.utility) ?? undefined;
  return {
    id,
    householdId: typeof value.householdId === 'string' ? value.householdId : undefined,
    kind,
    from,
    to,
    amount: value.amount,
    billId: typeof value.billId === 'string' ? value.billId : undefined,
    month: value.month,
    utility,
    date: value.date,
    note: typeof value.note === 'string' ? value.note : undefined,
  };
}

function normalizeFamily(value: unknown): Family {
  if (!isObject(value)) return FAMILIES[0];
  const family = parseFamilyName(value.name);
  return {
    id: typeof value.id === 'string' ? value.id : (family ?? FAMILIES[0].name).toLowerCase(),
    name: family ?? FAMILIES[0].name,
    color: typeof value.color === 'string' ? value.color : '#64748b',
    phone: typeof value.phone === 'string' ? value.phone : undefined,
  };
}

export function parseSettings(value: unknown): AppSettings | null {
  if (!isObject(value)) return null;
  const families = Array.isArray(value.families) ? value.families.map(normalizeFamily) : FAMILIES;
  const smsConfigRaw = isObject(value.smsConfig) ? value.smsConfig : {};
  const utilityDueDaysRaw = isObject(value.utilityDueDays) ? value.utilityDueDays : {};
  const splitRulesRaw = isObject(value.splitRules) ? value.splitRules : {};
  return {
    smsConfig: {
      apiKey: typeof smsConfigRaw.apiKey === 'string' ? smsConfigRaw.apiKey : '',
      enabled: Boolean(smsConfigRaw.enabled),
      reminderDaysBefore: typeof smsConfigRaw.reminderDaysBefore === 'number' ? smsConfigRaw.reminderDaysBefore : 3,
    },
    families,
    utilityDueDays: {
      VECO: typeof utilityDueDaysRaw.VECO === 'number' ? utilityDueDaysRaw.VECO : undefined,
      PLDT: typeof utilityDueDaysRaw.PLDT === 'number' ? utilityDueDaysRaw.PLDT : undefined,
      MCWD: typeof utilityDueDaysRaw.MCWD === 'number' ? utilityDueDaysRaw.MCWD : undefined,
    },
    splitRules: {
      VECO: isObject(splitRulesRaw.VECO)
        ? {
            type: splitRulesRaw.VECO.type === 'equal' ? 'equal' : 'fixed-ocanada',
            ocanadaFixed:
              typeof splitRulesRaw.VECO.ocanadaFixed === 'number'
                ? splitRulesRaw.VECO.ocanadaFixed
                : DEFAULT_SPLIT_RULES.VECO.ocanadaFixed,
          }
        : DEFAULT_SPLIT_RULES.VECO,
      PLDT: isObject(splitRulesRaw.PLDT)
        ? {
            type: splitRulesRaw.PLDT.type === 'equal' ? 'equal' : 'fixed-ocanada',
            ocanadaFixed:
              typeof splitRulesRaw.PLDT.ocanadaFixed === 'number'
                ? splitRulesRaw.PLDT.ocanadaFixed
                : DEFAULT_SPLIT_RULES.PLDT.ocanadaFixed,
          }
        : DEFAULT_SPLIT_RULES.PLDT,
      MCWD: isObject(splitRulesRaw.MCWD)
        ? {
            type: splitRulesRaw.MCWD.type === 'fixed-ocanada' ? 'fixed-ocanada' : 'equal',
            ocanadaFixed:
              typeof splitRulesRaw.MCWD.ocanadaFixed === 'number'
                ? splitRulesRaw.MCWD.ocanadaFixed
                : DEFAULT_SPLIT_RULES.MCWD.ocanadaFixed,
          }
        : DEFAULT_SPLIT_RULES.MCWD,
    },
  };
}
