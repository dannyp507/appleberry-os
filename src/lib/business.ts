import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { Product } from '../types';

export const TAX_RATE = 0.15;

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function isStockTrackedProduct(product: Pick<Product, 'id' | 'category'> & { product_type?: string | null }) {
  if (product.product_type === 'service') return false;
  const category = String(product.category || '').toLowerCase();
  return !String(product.id).startsWith('repair-') && !category.includes('service') && !category.includes('labour');
}

/** Legacy fallback — only used if Firestore counter is unavailable */
export function buildTicketNumber(prefix = 'R') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

/** @deprecated use getNextInvoiceNumber instead */
export function buildInvoiceNumber(prefix = 'INV') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

/**
 * Atomically increments the company invoice counter in Firestore and returns
 * the next zero-padded sequential number, e.g. "0001", "0002".
 */
export async function getNextInvoiceNumber(companyId: string): Promise<string> {
  // Stored in /counters/{companyId} — any active staff member can read/write
  const counterRef = doc(db, 'counters', companyId);
  let next = 1;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    next = snap.exists() ? (Number(snap.data().invoice_count) + 1) : 1;
    tx.set(counterRef, { invoice_count: next, company_id: companyId }, { merge: true });
  });
  return String(next).padStart(4, '0');
}

export function normalizePositiveNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}
