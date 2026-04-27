/* eslint-disable no-console */
/**
 * Wipe all bills and payments for a given month from Firestore.
 *
 * Usage:
 *   node --env-file=.env scripts/wipe-month.mjs 2026-03            # dry run, lists targets
 *   node --env-file=.env scripts/wipe-month.mjs 2026-03 --confirm  # actually delete
 *
 * Notes:
 *   - Reuses VITE_FIREBASE_* envs (the same ones the app uses).
 *   - Does NOT touch the `settings/app` document.
 *   - Does NOT delete uploaded bill images in Firebase Storage. If you need those gone,
 *     remove them from the Firebase Console after running this script.
 *   - If your Firestore security rules require auth, this script will get permission errors.
 *     In that case, switch to the Firebase Admin SDK with a service account.
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const args = process.argv.slice(2);
const targetMonth = args.find((a) => /^\d{4}-\d{2}$/.test(a)) ?? '2026-03';
const confirm = args.includes('--confirm');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
  console.error(
    'Missing VITE_FIREBASE_* env vars. Run with:\n' +
      '  node --env-file=.env scripts/wipe-month.mjs 2026-03\n'
  );
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = ['bills', 'payments'];

async function listMatching(collectionName) {
  const snap = await getDocs(
    query(collection(db, collectionName), where('month', '==', targetMonth))
  );
  return snap.docs;
}

function describeBill(data) {
  return `${data.utility ?? '?'}  ₱${(data.totalAmount ?? 0).toFixed(2)}  paidToProvider=${data.isPaidToProvider ?? '?'}`;
}

function describePayment(data) {
  return `${data.kind ?? '?'}  ${data.from ?? '?'} → ${data.to ?? '?'}  ₱${(data.amount ?? 0).toFixed(2)}  ${data.utility ?? ''}`;
}

async function main() {
  console.log(`Project:      ${firebaseConfig.projectId}`);
  console.log(`Target month: ${targetMonth}`);
  console.log(`Mode:         ${confirm ? 'DELETE' : 'dry run'}`);
  console.log('');

  const matches = {};
  for (const c of COLLECTIONS) {
    matches[c] = await listMatching(c);
  }

  let total = 0;
  for (const c of COLLECTIONS) {
    const docs = matches[c];
    total += docs.length;
    console.log(`${c}: ${docs.length}`);
    for (const d of docs) {
      const data = d.data();
      const detail = c === 'bills' ? describeBill(data) : describePayment(data);
      console.log(`  - ${c}/${d.id}  ${detail}`);
    }
  }

  if (total === 0) {
    console.log('\nNothing to delete.');
    process.exit(0);
  }

  if (!confirm) {
    console.log(
      `\nDry run. Re-run with --confirm to delete the ${total} record(s) above:\n` +
        `  node --env-file=.env scripts/wipe-month.mjs ${targetMonth} --confirm`
    );
    process.exit(0);
  }

  const allDocs = COLLECTIONS.flatMap((c) => matches[c]);
  const batches = [];
  let batch = writeBatch(db);
  let count = 0;
  const BATCH_LIMIT = 400; // Firestore writeBatch hard limit is 500
  for (const d of allDocs) {
    batch.delete(d.ref);
    count++;
    if (count >= BATCH_LIMIT) {
      batches.push(batch);
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) batches.push(batch);

  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`Committed batch ${i + 1}/${batches.length}`);
  }

  console.log(`\nDeleted ${total} record(s) for ${targetMonth}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Wipe failed:', err);
  process.exit(1);
});
