let NepaliDate;
if (typeof window !== 'undefined') {
  NepaliDate = require('nepali-date-converter').default;
}

const BS_MONTH_NAMES = ['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];

// AD date → BS "YYYY/MM/DD" (used only for registration date and bill generation date)
export function toBS(adDate) {
  if (!adDate || !NepaliDate) return '—';
  try {
    const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
    const nd = new NepaliDate(date);
    const y = nd.getYear();
    const m = String(nd.getMonth() + 1).padStart(2, '0');
    const d = String(nd.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  } catch { return '—'; }
}

// AD date → BS "YYYY/MM" (used everywhere else)
export function toBSMonth(adDate) {
  if (!adDate || !NepaliDate) return '—';
  try {
    const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
    const nd = new NepaliDate(date);
    return `${nd.getYear()}/${String(nd.getMonth() + 1).padStart(2, '0')}`;
  } catch { return '—'; }
}

// BS "YYYY/MM/DD" or "YYYY/MM" → AD Date
export function bsToAD(bsString) {
  if (!NepaliDate) return null;
  try {
    const normalized = bsString.replace(/\//g, '-');
    const parts = normalized.split('-').map(Number);
    const [year, month, day] = [parts[0], parts[1], parts[2] || 1];
    const nd = new NepaliDate(year, month - 1, day);
    return nd.toJsDate();
  } catch { return null; }
}

// "YYYY/MM" string → month name label like "Magh 2082"
export function yyyymmToLabel(yyyymm) {
  if (!yyyymm || !yyyymm.includes('/')) return yyyymm || '—';
  const [year, month] = yyyymm.split('/').map(Number);
  return `${BS_MONTH_NAMES[month - 1] || ''} ${year}`;
}

// Today in BS as "YYYY/MM/DD"
export function todayBS() {
  if (!NepaliDate) return '';
  try { return new NepaliDate().format('YYYY/MM/DD'); }
  catch { return ''; }
}

// Today in BS as "YYYY/MM"
export function todayBSMonth() {
  if (!NepaliDate) return '';
  try {
    const nd = new NepaliDate();
    return `${nd.getYear()}/${String(nd.getMonth() + 1).padStart(2, '0')}`;
  } catch { return ''; }
}

// Months elapsed since an AD date string
export function monthsSince(adDateString) {
  if (!adDateString) return Infinity;
  const past = new Date(adDateString);
  const now = new Date();
  return (now.getFullYear() - past.getFullYear()) * 12 + (now.getMonth() - past.getMonth());
}

// Months overdue from a "YYYY/MM" paid_up_to string
// Positive = months overdue, 0 = paid current month, negative = paid ahead
export function monthsOverdueFromYM(paidUpToYM) {
  if (!paidUpToYM || !NepaliDate) return null;
  try {
    const nd = new NepaliDate();
    const curYear = nd.getYear();
    const curMonth = nd.getMonth() + 1;
    const [py, pm] = paidUpToYM.split('/').map(Number);
    // overdue = how many months ago was paid_up_to
    return (curYear - py) * 12 + (curMonth - pm) - 1;
  } catch { return null; }
}

export const STATUS_COLORS = {
  green:  { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  yellow: { bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  red:    { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

export const AREAS = [
  { value: 'ward-10', label: 'Ward 10' },
  { value: 'ward-14', label: 'Ward 14' },
  { value: 'ward-15', label: 'Ward 15' },
];