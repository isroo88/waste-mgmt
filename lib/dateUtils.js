// Load NepaliDate lazily inside each function — avoids Next.js module cache issue
// where module-level window check runs on server and stays cached on client
function getNepaliDate() {
  try {
    return require('nepali-date-converter').default;
  } catch { return null; }
}

const BS_MONTH_NAMES = ['Baisakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];

// AD date → BS "YYYY/MM/DD" (registration date and bill date only)
export function toBS(adDate) {
  if (!adDate) return '—';
  try {
    const NepaliDate = getNepaliDate();
    if (!NepaliDate) return '—';
    const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
    const nd = new NepaliDate(date);
    const y = nd.getYear();
    const m = String(nd.getMonth() + 1).padStart(2, '0');
    const d = String(nd.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  } catch { return '—'; }
}

// AD date → BS "YYYY/MM" (everywhere else)
export function toBSMonth(adDate) {
  if (!adDate) return '—';
  try {
    const NepaliDate = getNepaliDate();
    if (!NepaliDate) return '—';
    const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
    const nd = new NepaliDate(date);
    return `${nd.getYear()}/${String(nd.getMonth() + 1).padStart(2, '0')}`;
  } catch { return '—'; }
}

// BS "YYYY/MM/DD" or "YYYY/MM" → AD Date
export function bsToAD(bsString) {
  if (!bsString) return null;
  try {
    const NepaliDate = getNepaliDate();
    if (!NepaliDate) return null;
    const normalized = bsString.replace(/\//g, '-');
    const parts = normalized.split('-').map(Number);
    const [year, month, day] = [parts[0], parts[1], parts[2] || 1];
    const nd = new NepaliDate(year, month - 1, day);
    return nd.toJsDate();
  } catch { return null; }
}

// "YYYY/MM" → "Magh 2082"
export function yyyymmToLabel(yyyymm) {
  if (!yyyymm || !yyyymm.includes('/')) return yyyymm || '—';
  const [year, month] = yyyymm.split('/').map(Number);
  return `${BS_MONTH_NAMES[month - 1] || ''} ${year}`;
}

// Today in BS as "YYYY/MM/DD"
export function todayBS() {
  try {
    const NepaliDate = getNepaliDate();
    if (!NepaliDate) return '';
    return new NepaliDate().format('YYYY/MM/DD');
  } catch { return ''; }
}

// Today in BS as "YYYY/MM"
export function todayBSMonth() {
  try {
    const NepaliDate = getNepaliDate();
    if (!NepaliDate) return '';
    const nd = new NepaliDate();
    return `${nd.getYear()}/${String(nd.getMonth() + 1).padStart(2, '0')}`;
  } catch { return ''; }
}

// Months elapsed since an AD date string (for fallback only)
export function monthsSince(adDateString) {
  if (!adDateString) return Infinity;
  const past = new Date(adDateString);
  const now = new Date();
  return (now.getFullYear() - past.getFullYear()) * 12 + (now.getMonth() - past.getMonth());
}

// Months overdue from "YYYY/MM" paid_up_to string
// Positive = overdue, 0 = paid current month, negative = paid ahead
// Uses lazy NepaliDate load — works correctly on client after hydration
export function monthsOverdueFromYM(paidUpToYM) {
  if (!paidUpToYM || !/^\d{4}\/\d{2}$/.test(paidUpToYM)) return null;
  try {
    const NepaliDate = getNepaliDate();
    if (NepaliDate) {
      const nd = new NepaliDate();
      const curYear = nd.getYear();
      const curMonth = nd.getMonth() + 1;
      const [py, pm] = paidUpToYM.split('/').map(Number);
      return (curYear - py) * 12 + (curMonth - pm) - 1;
    }
    // Fallback: rough AD→BS approximation when NepaliDate unavailable
    const now = new Date();
    const adYear = now.getFullYear();
    const adMonth = now.getMonth() + 1;
    // Nepal BS is roughly 56-57 years ahead of AD
    // Baisakh (month 1) starts mid-April
    const bsYear = adMonth >= 4 ? adYear + 57 : adYear + 56;
    const bsMonth = adMonth >= 4 ? adMonth - 3 : adMonth + 9;
    const [py, pm] = paidUpToYM.split('/').map(Number);
    return (bsYear - py) * 12 + (bsMonth - pm) - 1;
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