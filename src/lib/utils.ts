import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, getDaysInMonth, differenceInDays, addMonths, startOfMonth } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | { toNumber(): number }) {
  const num =
    typeof amount === 'object' && 'toNumber' in amount
      ? amount.toNumber()
      : typeof amount === 'string'
      ? parseFloat(amount)
      : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatMonth(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMMM yyyy');
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMM yyyy, h:mm a');
}

export function prorateRent(monthlyRent: number, moveInDate: Date, cycleMonth: Date): number {
  const daysInMonth = getDaysInMonth(cycleMonth);
  const monthEnd = new Date(cycleMonth.getFullYear(), cycleMonth.getMonth() + 1, 0);
  const daysFromMoveIn = differenceInDays(monthEnd, moveInDate) + 1;
  return round2((monthlyRent / daysInMonth) * daysFromMoveIn);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function nextCycleMonth() {
  return startOfMonth(addMonths(new Date(), 1));
}

export function currentCycleMonth() {
  return startOfMonth(new Date());
}

export function toDecimalNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v);
}
