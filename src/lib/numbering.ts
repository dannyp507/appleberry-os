import { doc, getDoc, setDoc, type Transaction } from 'firebase/firestore';
import { db } from './firebase';

// Sequential repair ticket (t112) and invoice (s568) numbers, like Cellstore.
// One counter document per company; numbers are taken inside the same
// Firestore transaction that saves the ticket or sale, so two tills never
// get the same number.

export type CounterKind = 'repair' | 'invoice';

type CounterDoc = {
  company_id: string;
  next_repair_number?: number;
  next_invoice_number?: number;
};

const FIELD: Record<CounterKind, 'next_repair_number' | 'next_invoice_number'> = {
  repair: 'next_repair_number',
  invoice: 'next_invoice_number',
};

const PREFIX: Record<CounterKind, string> = {
  repair: 't',
  invoice: 's',
};

const counterRef = (companyId: string) => doc(db, 'counters', companyId);

export function formatDocumentNumber(kind: CounterKind, value: number) {
  return `${PREFIX[kind]}${value}`;
}

// Firestore transactions need every read before any write, so read first...
export async function readCounters(transaction: Transaction, companyId: string): Promise<CounterDoc | null> {
  const snapshot = await transaction.get(counterRef(companyId));
  return snapshot.exists() ? (snapshot.data() as CounterDoc) : null;
}

// ...then take a number once all other reads are done.
export function takeNumber(
  transaction: Transaction,
  companyId: string,
  counters: CounterDoc | null,
  kind: CounterKind
) {
  const field = FIELD[kind];
  const current = Math.max(1, Math.floor(Number(counters?.[field]) || 1));
  transaction.set(
    counterRef(companyId),
    { company_id: companyId, [field]: current + 1 },
    { merge: true }
  );
  return formatDocumentNumber(kind, current);
}

export async function getNextNumbers(companyId: string) {
  const snapshot = await getDoc(counterRef(companyId));
  const data = snapshot.exists() ? (snapshot.data() as CounterDoc) : null;
  return {
    repair: Math.max(1, Number(data?.next_repair_number) || 1),
    invoice: Math.max(1, Number(data?.next_invoice_number) || 1),
  };
}

// Owners and admins set where numbering continues from (e.g. after the last Cellstore ticket).
export async function setNextNumbers(companyId: string, next: { repair: number; invoice: number }) {
  await setDoc(
    counterRef(companyId),
    {
      company_id: companyId,
      next_repair_number: Math.max(1, Math.floor(next.repair)),
      next_invoice_number: Math.max(1, Math.floor(next.invoice)),
    },
    { merge: true }
  );
}

// Cellstore exports numbers as 112 or T112; show them the way staff know them (t112, s568).
export function normalizeImportedNumber(kind: CounterKind, raw: string | null | undefined) {
  const value = (raw || '').trim();
  const match = value.match(/^[a-z]?(\d+)$/i);
  if (match) return formatDocumentNumber(kind, Number(match[1]));
  return value;
}
