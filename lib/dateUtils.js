let NepaliDate;
// Only import on the client side to avoid SSR issues during Vercel build
if (typeof window !== 'undefined') {
  NepaliDate = require('nepali-date-converter').default;
}

// Convert an AD date (Date object, or 'YYYY-MM-DD' string) to a BS display string
export function toBS(adDate) {
  if (!adDate || !NepaliDate) return '—';
  try {
    const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
    const nd = new NepaliDate(date);
    return nd.format('YYYY-MM-DD'); // e.g. 2082-03-15
  } catch (e) {
    return '—';
  }
}

// Convert a BS date string (YYYY-MM-DD, Nepali calendar) back to an AD Date
export function bsToAD(bsString) {
  if (!NepaliDate) return null;
  try {
    const [year, month, day] = bsString.split('-').map(Number);
    const nd = new NepaliDate(year, month - 1, day);
    return nd.toJsDate();
  } catch (e) {
    return null;
  }
}

// Today's date in BS, formatted for display
export function todayBS() {
  if (!NepaliDate) return '';
  try {
    return new NepaliDate().format('YYYY-MM-DD');
  } catch (e) {
    return '';
  }
}

// Calculate months elapsed since a given AD date string, used for status color
export function monthsSince(adDateString) {
  if (!adDateString) return Infinity;
  const past = new Date(adDateString);
  const now = new Date();
  const months =
    (now.getFullYear() - past.getFullYear()) * 12 +
    (now.getMonth() - past.getMonth()) -
    (now.getDate() < past.getDate() ? 1 : 0);
  return Math.max(months, 0);
}

// Determine status color: green (<=6mo since last payment/start),
// yellow (6-12mo), red (12mo+)
export function getCustomerStatus(customer, lastPaymentDate) {
  const referenceDate = lastPaymentDate || customer.payment_start_date;
  const months = monthsSince(referenceDate);

  if (months <= 6) return { status: 'green', label: 'Paid up to date' };
  if (months <= 12) return { status: 'yellow', label: 'Overdue 6-12 months' };
  return { status: 'red', label: 'Overdue 12+ months' };
}

export const STATUS_COLORS = {
  green: { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  yellow: { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  red: { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

export const AREAS = [
  { value: 'ward-10', label: 'Ward 10' },
  { value: 'ward-14', label: 'Ward 14' },
  { value: 'ward-15', label: 'Ward 15' },
];
