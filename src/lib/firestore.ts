import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Bill, Payment, AppSettings, FamilyName } from '../types';
import { parseBill, parsePayment, parseSettings } from './validators';

// Collections
const BILLS_COLLECTION = 'bills';
const PAYMENTS_COLLECTION = 'payments';
const SETTINGS_COLLECTION = 'settings';

// --- Bills ---

export async function getBills(): Promise<Bill[]> {
  const q = query(collection(db, BILLS_COLLECTION), orderBy('month', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => parseBill(item.id, item.data()))
    .filter((item): item is Bill => item !== null);
}

export async function getBillsByMonth(month: string): Promise<Bill[]> {
  const q = query(
    collection(db, BILLS_COLLECTION),
    where('month', '==', month),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => parseBill(item.id, item.data()))
    .filter((item): item is Bill => item !== null);
}

export function subscribeToBills(onData: (bills: Bill[]) => void, onError: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, BILLS_COLLECTION), orderBy('month', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const bills = snapshot.docs
        .map((item) => parseBill(item.id, item.data()))
        .filter((item): item is Bill => item !== null);
      onData(bills);
    },
    onError
  );
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function addBill(bill: Omit<Bill, 'id'>): Promise<string> {
  const docRef = doc(collection(db, BILLS_COLLECTION));
  await setDoc(docRef, stripUndefined(bill) as DocumentData);
  return docRef.id;
}

export async function updateBill(id: string, data: Partial<Bill>): Promise<void> {
  await updateDoc(doc(db, BILLS_COLLECTION, id), stripUndefined(data) as DocumentData);
}

export async function deleteBill(id: string): Promise<void> {
  await deleteDoc(doc(db, BILLS_COLLECTION, id));
}

// --- Payments ---

export async function getPayments(): Promise<Payment[]> {
  const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => parsePayment(item.id, item.data()))
    .filter((item): item is Payment => item !== null);
}

export function subscribeToPayments(onData: (payments: Payment[]) => void, onError: (error: Error) => void): Unsubscribe {
  const q = query(collection(db, PAYMENTS_COLLECTION), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const payments = snapshot.docs
        .map((item) => parsePayment(item.id, item.data()))
        .filter((item): item is Payment => item !== null);
      onData(payments);
    },
    onError
  );
}

export async function addPayment(payment: Omit<Payment, 'id'>): Promise<string> {
  const docRef = doc(collection(db, PAYMENTS_COLLECTION));
  await setDoc(docRef, stripUndefined(payment) as DocumentData);
  return docRef.id;
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, PAYMENTS_COLLECTION, id));
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<void> {
  await updateDoc(doc(db, PAYMENTS_COLLECTION, id), stripUndefined(data) as DocumentData);
}

// --- Settings ---

export async function getSettings(): Promise<AppSettings | null> {
  const docRef = doc(db, SETTINGS_COLLECTION, 'app');
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return parseSettings(snapshot.data());
  }
  return null;
}

export function subscribeToSettings(
  onData: (settings: AppSettings | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, SETTINGS_COLLECTION, 'app');
  return onSnapshot(
    docRef,
    (snapshot) => {
      onData(snapshot.exists() ? parseSettings(snapshot.data()) : null);
    },
    onError
  );
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setDoc(doc(db, SETTINGS_COLLECTION, 'app'), stripUndefined(settings) as DocumentData);
}

// --- Balance Calculations ---

export type CalculateBalancesOptions = { onlyMonth?: string };

/**
 * Interpersonal balances from tapal (who still owes the person who fronted) plus settlement payments.
 * Tapal only counts a split when that person is actually covered by the tapal payer: either they still
 * haven’t “paid” their share in the split (!isPaid) or paidTo points at the front person. Splits that
 * are isPaid with no paidTo were self-funded in the tapal flow and do not add debt.
 *
 * @param onlyMonth - If set (e.g. "2026-04"), only bills and payments in that month are included. Use
 *   on the Dashboard so totals match the month being viewed; omit for an all-time net (Analytics, Tapal).
 */
export function calculateBalances(
  bills: Bill[],
  payments: Payment[],
  options?: CalculateBalancesOptions
) {
  const { onlyMonth } = options ?? {};
  const billRows = onlyMonth ? bills.filter((b) => b.month === onlyMonth) : bills;
  const paymentRows = onlyMonth ? payments.filter((p) => p.month === onlyMonth) : payments;

  const balances: Record<string, number> = {};
  const families: FamilyName[] = ['Bacarisas', 'Ocanada', 'Patino'];

  // Initialize all pair balances
  for (const a of families) {
    for (const b of families) {
      if (a !== b) {
        balances[`${a}->${b}`] = 0;
      }
    }
  }

  // Tapal — supports both the per-split borrow flow (split.paidTo) and the legacy whole-bill flow
  // (bill.paidBy with the borrower's split still unpaid). Skips rows already reimbursed.
  for (const bill of billRows) {
    for (const split of bill.splits) {
      if (split.lenderReimbursed === true) continue;
      let lender: FamilyName | undefined;
      if (split.paidTo && split.paidTo !== split.family) {
        lender = split.paidTo;
      } else if (!split.isPaid && bill.paidBy && bill.paidBy !== split.family) {
        lender = bill.paidBy;
      }
      if (!lender) continue;
      balances[`${split.family}->${lender}`] += split.amount;
    }
  }

  // Subtract payments
  for (const payment of paymentRows) {
    balances[`${payment.from}->${payment.to}`] -= payment.amount;
  }

  // Net out balances between pairs
  const netBalances: { from: FamilyName; to: FamilyName; amount: number }[] = [];
  const processed = new Set<string>();

  for (const a of families) {
    for (const b of families) {
      if (a !== b && !processed.has(`${a}-${b}`) && !processed.has(`${b}-${a}`)) {
        const aOwesB = Math.max(0, balances[`${a}->${b}`]);
        const bOwesA = Math.max(0, balances[`${b}->${a}`]);
        const net = aOwesB - bOwesA;

        if (Math.abs(net) > 0.01) {
          if (net > 0) {
            netBalances.push({ from: a, to: b, amount: Math.round(net * 100) / 100 });
          } else {
            netBalances.push({ from: b, to: a, amount: Math.round(Math.abs(net) * 100) / 100 });
          }
        }
        processed.add(`${a}-${b}`);
      }
    }
  }

  return netBalances;
}
