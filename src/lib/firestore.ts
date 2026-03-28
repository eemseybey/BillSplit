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

export async function addBill(bill: Omit<Bill, 'id'>): Promise<string> {
  const docRef = doc(collection(db, BILLS_COLLECTION));
  await setDoc(docRef, bill);
  return docRef.id;
}

export async function updateBill(id: string, data: Partial<Bill>): Promise<void> {
  await updateDoc(doc(db, BILLS_COLLECTION, id), data as DocumentData);
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
  await setDoc(docRef, payment);
  return docRef.id;
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, PAYMENTS_COLLECTION, id));
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<void> {
  await updateDoc(doc(db, PAYMENTS_COLLECTION, id), data as DocumentData);
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
  await setDoc(doc(db, SETTINGS_COLLECTION, 'app'), settings as DocumentData);
}

// --- Balance Calculations ---

export function calculateBalances(bills: Bill[], payments: Payment[]) {
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

  // Process bills with tapal
  for (const bill of bills) {
    if (bill.paidBy) {
      for (const split of bill.splits) {
        if (split.family !== bill.paidBy && !split.isPaid) {
          balances[`${split.family}->${bill.paidBy}`] += split.amount;
        }
      }
    }
  }

  // Subtract payments
  for (const payment of payments) {
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
