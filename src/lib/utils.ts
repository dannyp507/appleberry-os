import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}

export function safeFormatDate(dateStr: any, formatStr: string, fallback: string = 'N/A') {
  if (!dateStr) return fallback;
  try {
    let date: Date;
    
    // Handle Firestore Timestamp
    if (typeof dateStr === 'object' && dateStr !== null && 'toDate' in dateStr && typeof dateStr.toDate === 'function') {
      date = dateStr.toDate();
    } else {
      date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch (e) {
    return fallback;
  }
}
