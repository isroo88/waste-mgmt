// Nepali (BS) Date Picker — year/month/day dropdowns
// Returns value as "YYYY/MM/DD" string

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

// Days per month for BS years 2075–2090
// Source: standard Nepali calendar
const BS_DAYS = {
  2075: [31,31,32,32,31,30,30,29,30,29,30,30],
  2076: [31,32,31,32,31,30,30,30,29,29,30,31],
  2077: [31,31,32,31,31,31,30,29,30,29,30,30],
  2078: [31,31,32,32,31,30,30,29,30,29,30,30],
  2079: [31,32,31,32,31,30,30,30,29,29,30,31],
  2080: [31,31,32,31,31,31,30,29,30,29,30,30],
  2081: [31,31,32,32,31,30,30,29,30,29,30,30],
  2082: [31,32,31,32,31,30,30,30,29,29,30,31],
  2083: [31,31,32,31,31,31,30,29,30,29,30,30],
  2084: [31,31,32,32,31,30,30,29,30,29,30,30],
  2085: [31,32,31,32,31,30,30,30,29,29,30,31],
  2086: [31,31,32,31,31,31,30,29,30,29,30,30],
  2087: [31,32,31,32,31,30,30,29,30,29,30,30],
  2088: [30,32,31,32,31,30,30,30,29,29,30,31],
  2089: [31,31,32,31,31,31,30,29,30,29,30,30],
  2090: [31,31,32,32,31,30,30,29,30,29,30,30],
};

const YEARS = Array.from({ length: 16 }, (_, i) => 2075 + i); // 2075–2090

function getDaysInMonth(year, month) {
  if (!year || !month) return 32;
  return (BS_DAYS[year]?.[month - 1]) || 32;
}

export function getMonthName(monthNum) {
  return NEPALI_MONTHS.find((m) => m.num === monthNum)?.name || '';
}

export default function BSDatePicker({ value, onChange, label, required, placeholder }) {
  // value = "YYYY/MM/DD" or ""
  const parts = value ? value.split('/') : ['', '', ''];
  const selYear = parts[0] ? Number(parts[0]) : '';
  const selMonth = parts[1] ? Number(parts[1]) : '';
  const selDay = parts[2] ? Number(parts[2]) : '';

  const daysInMonth = getDaysInMonth(selYear, selMonth);

  function update(y, m, d) {
    if (y && m && d) {
      onChange(`${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`);
    } else {
      onChange('');
    }
  }

  const s = {
    wrapper: {},
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    row: { display: 'flex', gap: 8 },
    select: {
      padding: '10px 8px', borderRadius: 8, border: '1px solid #cbd5e1',
      fontSize: 14, background: '#fff', cursor: 'pointer', flex: 1,
      color: '#0f172a',
    },
    hint: { fontSize: 11, color: '#94a3b8', marginTop: 5 },
  };

  return (
    <div style={s.wrapper}>
      {label && (
        <label style={s.label}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}
      <div style={s.row}>
        {/* Year */}
        <select
          style={{ ...s.select, flex: '1.2' }}
          value={selYear}
          onChange={(e) => update(Number(e.target.value), selMonth, selDay)}
        >
          <option value="">Year (साल)</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Month */}
        <select
          style={{ ...s.select, flex: '1.6' }}
          value={selMonth}
          onChange={(e) => {
            const newMonth = Number(e.target.value);
            // Reset day if it exceeds days in new month
            const maxDays = getDaysInMonth(selYear, newMonth);
            const newDay = selDay > maxDays ? '' : selDay;
            update(selYear, newMonth, newDay);
          }}
        >
          <option value="">Month (महिना)</option>
          {NEPALI_MONTHS.map((m) => (
            <option key={m.num} value={m.num}>{m.name} ({m.np})</option>
          ))}
        </select>

        {/* Day */}
        <select
          style={s.select}
          value={selDay}
          onChange={(e) => update(selYear, selMonth, Number(e.target.value))}
        >
          <option value="">Day (गते)</option>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      <p style={s.hint}>
        Format: YYYY/MM/DD &nbsp;·&nbsp; e.g. 2083/02/15 = Jestha 15, 2083
        {value && <span style={{ color: '#22c55e', fontWeight: 600 }}> &nbsp;· Selected: {value}</span>}
      </p>
    </div>
  );
}