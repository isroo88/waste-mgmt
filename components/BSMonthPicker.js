import { useState, useEffect } from 'react';

const BS_MONTHS = [
  { num: 1,  name: 'Baisakh',  np: 'बैशाख' },
  { num: 2,  name: 'Jestha',   np: 'जेठ' },
  { num: 3,  name: 'Ashadh',   np: 'असार' },
  { num: 4,  name: 'Shrawan',  np: 'साउन' },
  { num: 5,  name: 'Bhadra',   np: 'भदौ' },
  { num: 6,  name: 'Ashwin',   np: 'असोज' },
  { num: 7,  name: 'Kartik',   np: 'कार्तिक' },
  { num: 8,  name: 'Mangsir',  np: 'मंसिर' },
  { num: 9,  name: 'Poush',    np: 'पुष' },
  { num: 10, name: 'Magh',     np: 'माघ' },
  { num: 11, name: 'Falgun',   np: 'फागुन' },
  { num: 12, name: 'Chaitra',  np: 'चैत' },
];

const YEARS = Array.from({ length: 16 }, (_, i) => 2075 + i);

export function getMonthLabel(monthNum) {
  return BS_MONTHS.find((m) => m.num === Number(monthNum))?.name || '';
}

// Convert "YYYY/MM" to display label like "Magh 2082"
export function yyyymmToLabel(yyyymm) {
  if (!yyyymm) return '—';
  const parts = yyyymm.split('/');
  if (parts.length < 2) return yyyymm;
  const [year, month] = parts.map(Number);
  return `${getMonthLabel(month)} ${year}`;
}

// Calculate months between two YYYY/MM strings (inclusive)
export function calcMonthsBetween(fromYM, toYM) {
  if (!fromYM || !toYM) return 1;
  const [fy, fm] = fromYM.split('/').map(Number);
  const [ty, tm] = toYM.split('/').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

// Get current BS year/month as "YYYY/MM"
export function getCurrentBSYM() {
  if (typeof window === 'undefined') return '';
  try {
    const NepaliDate = require('nepali-date-converter').default;
    const nd = new NepaliDate();
    return `${nd.getYear()}/${String(nd.getMonth() + 1).padStart(2, '0')}`;
  } catch { return ''; }
}

// Months overdue: positive = overdue, 0 = current, negative = paid ahead
export function getMonthsOverdue(paidUpToYM) {
  if (!paidUpToYM) return null;
  const current = getCurrentBSYM();
  if (!current) return null;
  const [cy, cm] = current.split('/').map(Number);
  const [py, pm] = paidUpToYM.split('/').map(Number);
  return (cy - py) * 12 + (cm - pm) - 1;
  // -1 because if paid up to current month, overdue = 0
}

export default function BSMonthPicker({ value, onChange, label, required, placeholder }) {
  const [selYear, setSelYear] = useState('');
  const [selMonth, setSelMonth] = useState('');

  useEffect(() => {
    if (value && value.includes('/')) {
      const [y, m] = value.split('/').map(Number);
      setSelYear(y || '');
      setSelMonth(m || '');
    } else if (!value) {
      setSelYear('');
      setSelMonth('');
    }
  }, [value]);

  function handleYear(y) {
    setSelYear(Number(y));
    if (y && selMonth) onChange(`${y}/${String(selMonth).padStart(2, '0')}`);
  }

  function handleMonth(m) {
    setSelMonth(Number(m));
    if (selYear && m) onChange(`${selYear}/${String(m).padStart(2, '0')}`);
  }

  const isComplete = selYear && selMonth;

  return (
    <div>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff', cursor: 'pointer' }}
          value={selYear}
          onChange={(e) => handleYear(e.target.value)}
        >
          <option value="">Year (साल)</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          style={{ flex: 1.6, padding: '10px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff', cursor: 'pointer' }}
          value={selMonth}
          onChange={(e) => handleMonth(e.target.value)}
        >
          <option value="">Month (महिना)</option>
          {BS_MONTHS.map((m) => (
            <option key={m.num} value={m.num}>{m.name} ({m.np})</option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: 12, marginTop: 5, color: isComplete ? '#15803d' : '#94a3b8', fontWeight: isComplete ? 600 : 400 }}>
        {isComplete
          ? `✓ ${getMonthLabel(selMonth)} ${selYear} (${selYear}/${String(selMonth).padStart(2, '0')})`
          : !selYear ? 'Select year and month'
          : `${selYear} selected — pick a month`}
      </p>
    </div>
  );
}