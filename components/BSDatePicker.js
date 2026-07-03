import { useState, useEffect } from 'react';

const NEPALI_MONTHS = [
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

const BS_DAYS = {
  2075:[31,31,32,32,31,30,30,29,30,29,30,30],
  2076:[31,32,31,32,31,30,30,30,29,29,30,31],
  2077:[31,31,32,31,31,31,30,29,30,29,30,30],
  2078:[31,31,32,32,31,30,30,29,30,29,30,30],
  2079:[31,32,31,32,31,30,30,30,29,29,30,31],
  2080:[31,31,32,31,31,31,30,29,30,29,30,30],
  2081:[31,31,32,32,31,30,30,29,30,29,30,30],
  2082:[31,32,31,32,31,30,30,30,29,29,30,31],
  2083:[31,31,32,31,31,31,30,29,30,29,30,30],
  2084:[31,31,32,32,31,30,30,29,30,29,30,30],
  2085:[31,32,31,32,31,30,30,30,29,29,30,31],
  2086:[31,31,32,31,31,31,30,29,30,29,30,30],
  2087:[31,32,31,32,31,30,30,29,30,29,30,30],
  2088:[30,32,31,32,31,30,30,30,29,29,30,31],
  2089:[31,31,32,31,31,31,30,29,30,29,30,30],
  2090:[31,31,32,32,31,30,30,29,30,29,30,30],
};

const YEARS = Array.from({ length: 16 }, (_, i) => 2075 + i);

function getDaysInMonth(year, month) {
  if (!year || !month) return 32;
  return BS_DAYS[year]?.[month - 1] || 32;
}

export function getMonthName(monthNum) {
  return NEPALI_MONTHS.find((m) => m.num === Number(monthNum))?.name || '';
}

export default function BSDatePicker({ value, onChange, label, required }) {
  // Local state — persists across individual selections so user sees progress
  const [selYear, setSelYear] = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [selDay, setSelDay] = useState('');

  // Sync local state from external value (handles resets from parent)
  useEffect(() => {
    if (value && value.includes('/')) {
      const parts = value.split('/');
      setSelYear(parts[0] ? Number(parts[0]) : '');
      setSelMonth(parts[1] ? Number(parts[1]) : '');
      setSelDay(parts[2] ? Number(parts[2]) : '');
    } else if (!value) {
      setSelYear('');
      setSelMonth('');
      setSelDay('');
    }
  }, [value]);

  function handleYear(y) {
    const yr = Number(y);
    setSelYear(yr);
    // Reset day if it exceeds days in same month for new year
    const maxDays = getDaysInMonth(yr, selMonth);
    const day = selDay > maxDays ? '' : selDay;
    setSelDay(day);
    if (yr && selMonth && day) {
      onChange(`${yr}/${String(selMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`);
    }
  }

  function handleMonth(m) {
    const mo = Number(m);
    setSelMonth(mo);
    // Reset day if it exceeds days in new month
    const maxDays = getDaysInMonth(selYear, mo);
    const day = selDay > maxDays ? '' : selDay;
    setSelDay(day);
    if (selYear && mo && day) {
      onChange(`${selYear}/${String(mo).padStart(2, '0')}/${String(day).padStart(2, '0')}`);
    }
  }

  function handleDay(d) {
    const dy = Number(d);
    setSelDay(dy);
    if (selYear && selMonth && dy) {
      onChange(`${selYear}/${String(selMonth).padStart(2, '0')}/${String(dy).padStart(2, '0')}`);
    }
  }

  const daysInMonth = getDaysInMonth(selYear, selMonth);
  const isComplete = selYear && selMonth && selDay;

  const s = {
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    row: { display: 'flex', gap: 8 },
    select: {
      padding: '10px 8px', borderRadius: 8,
      border: '1px solid #cbd5e1', fontSize: 14,
      background: '#fff', cursor: 'pointer', flex: 1,
      color: '#0f172a',
    },
    preview: {
      marginTop: 6, fontSize: 12,
      color: isComplete ? '#15803d' : '#94a3b8',
      fontWeight: isComplete ? 600 : 400,
    },
  };

  return (
    <div>
      {label && (
        <label style={s.label}>
          {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
        </label>
      )}
      <div style={s.row}>
        {/* Year */}
        <select style={{ ...s.select, flex: '1.1' }} value={selYear} onChange={(e) => handleYear(e.target.value)}>
          <option value="">Year</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Month */}
        <select style={{ ...s.select, flex: '1.6' }} value={selMonth} onChange={(e) => handleMonth(e.target.value)}>
          <option value="">Month</option>
          {NEPALI_MONTHS.map((m) => (
            <option key={m.num} value={m.num}>{m.name} ({m.np})</option>
          ))}
        </select>

        {/* Day */}
        <select style={s.select} value={selDay} onChange={(e) => handleDay(e.target.value)}>
          <option value="">Day</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Live feedback */}
      <p style={s.preview}>
        {isComplete
          ? `✓ ${selDay} ${getMonthName(selMonth)} ${selYear} (${selYear}/${String(selMonth).padStart(2,'0')}/${String(selDay).padStart(2,'0')})`
          : !selYear ? 'Select year, month and day'
          : !selMonth ? `${selYear} selected — now pick a month`
          : `${getMonthName(selMonth)} ${selYear} — now pick a day`
        }
      </p>
    </div>
  );
}