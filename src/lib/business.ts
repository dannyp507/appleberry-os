import { Product } from '../types';

export const TAX_RATE = 0.15;

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function isStockTrackedProduct(product: Pick<Product, 'id' | 'category'>) {
  const category = String(product.category || '').toLowerCase();
  return !String(product.id).startsWith('repair-') && !category.includes('service') && !category.includes('labour');
}

export function buildTicketNumber(prefix = 'R') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function buildInvoiceNumber(prefix = 'INV') {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function normalizePositiveNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return number;
}
