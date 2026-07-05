import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import BSMonthPicker, { yyyymmToLabel } from '../components/BSMonthPicker';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS, toBSMonth, monthsOverdueFromYM, AREAS } from '../lib/dateUtils';

// ── Export helpers ──────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(filename, sheetName, data) {
  const XLSX = (await import('xlsx')).default;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Status label from paid_up_to ──────────────────────────
function getStatusLabel(paidUpToYM) {
  if (!paidUpToYM) return 'No bills';
  const overdue = monthsOverdueFromYM(paidUpToYM);
  if (overdue === null) return '—';
  if (overdue <= 0) return 'Up to date';
  if (overdue <= 3) return `${overdue}mo overdue`;
  if (overdue <= 6) return `${overdue}mo overdue (warning)`;
  return `${overdue}mo overdue (critical)`;
}

function Payments({ user, isAdmin }) {
  const [payments, setPayments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [fromYM, setFromYM] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadPayments(); }, []);

  async function loadPayments() {
    setLoading(true);
    let q = supabase
      .from('payments')
      .select('id, amount, payment_date, customers(name, customer_code, area), app_users(full_name, staff_code), bills(from_month, to_month, period_label)')
      .order('payment_date', { ascending: false });
    if (!isAdmin) q = q.eq('collected_by', user.id);
    const { data } = await q;
    setPayments(data || []);

    if (isAdmin) {
      const { data: staff } = await supabase.from('app_users').select('id, full_name').eq('role', 'staff');
      setStaffList(staff || []);
    }
    setLoading(false);
  }

  const filtered = payments.filter((p) => {
    if (areaFilter !== 'all' && p.customers?.area !== areaFilter) return false;
    if (staffFilter !== 'all' && p.app_users?.staff_code !== staffFilter) return false;
    if (fromYM) {
      const [y, m] = fromYM.split('/').map(Number);
      const filterDate = new Date(y + (m > 9 ? 56 : 57) - 57, (m - 1 + 9) % 12); // rough AD
      if (new Date(p.payment_date) < new Date(`${y - 57}-${String(m).padStart(2, '0')}-01`)) return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, p) => s + Number(p.amount), 0);

  function toRows() {
    return filtered.map((p) => ({
      'Date (BS)': toBS(p.payment_date),
      'Customer Name': p.customers?.name || '',
      'Customer Code': p.customers?.customer_code || '',
      'Area': p.customers?.area?.replace('ward-', 'Ward ') || '',
      'Amount (Rs.)': Number(p.amount),
      'Period': p.bills?.period_label || '',
      'Collected By': p.app_users?.full_name || '',
      'Staff Code': p.app_users?.staff_code || '',
    }));
  }

  const headers = ['Date (BS)', 'Customer Name', 'Customer Code', 'Area', 'Amount (Rs.)', 'Period', 'Collected By', 'Staff Code'];
  const csvRows = filtered.map((p) => [toBS(p.payment_date), p.customers?.name, p.customers?.customer_code, p.customers?.area?.replace('ward-', 'Ward '), Number(p.amount), p.bills?.period_label, p.app_users?.full_name, p.app_users?.staff_code]);

  const s = sty;
  return (
    <div>
      <div style={s.filterBar}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <BSMonthPicker label="From Month" value={fromYM} onChange={setFromYM} />
        </div>
        <div>
          <label style={s.filterLabel}>Area</label>
          <select style={s.select} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="all">All Areas</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        {isAdmin && staffList.length > 0 && (
          <div>
            <label style={s.filterLabel}>Staff</label>
            <select style={s.select} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="all">All Staff</option>
              {staffList.map((st) => <option key={st.id} value={st.staff_code}>{st.full_name}</option>)}
            </select>
          </div>
        )}
        <button style={s.resetBtn} onClick={() => { setFromYM(''); setAreaFilter('all'); setStaffFilter('all'); }}>✕ Reset</button>
      </div>

      <div style={s.summaryRow}>
        <div style={s.chip}><strong>{filtered.length}</strong> records</div>
        <div style={s.chip}>Total: <strong style={{ color: '#22c55e' }}>Rs. {totalAmount.toLocaleString()}</strong></div>
        <div style={{ flex: 1 }} />
        <button style={s.csvBtn} onClick={() => downloadCSV(`payments-${Date.now()}.csv`, headers, csvRows)}>⬇ CSV</button>
        <button style={s.xlsBtn} onClick={() => downloadExcel(`payments-${Date.now()}.xlsx`, 'Payments', toRows())}>⬇ Excel</button>
      </div>

      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
        <table style={s.table}>
          <thead><tr>
            {headers.map((h) => <th key={h} style={s.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtered.slice(0, 20).map((p) => (
              <tr key={p.id}>
                <td style={s.td}>{toBS(p.payment_date)}</td>
                <td style={s.td}>{p.customers?.name}</td>
                <td style={s.td}>{p.customers?.customer_code}</td>
                <td style={s.td}>{p.customers?.area?.replace('ward-', 'Ward ')}</td>
                <td style={s.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                <td style={s.td}>{p.bills?.period_label}</td>
                <td style={s.td}>{p.app_users?.full_name}</td>
                <td style={s.td}>{p.app_users?.staff_code}</td>
              </tr>
            ))}
            {filtered.length > 20 && <tr><td colSpan={8} style={{ ...s.td, color: '#94a3b8', textAlign: 'center' }}>... and {filtered.length - 20} more rows (all included in export)</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Customers({ user, isAdmin }) {
  const [customers, setCustomers] = useState([]);
  const [lastBills, setLastBills] = useState({});
  const [lastPayments, setLastPayments] = useState({});
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadCustomers(); }, []);

  async function loadCustomers() {
    setLoading(true);
    const { data: custs } = await supabase.from('customers').select('*, app_users(full_name)').order('customer_code');
    setCustomers(custs || []);

    const { data: bills } = await supabase.from('bills').select('customer_id, paid_up_to').order('created_at', { ascending: false });
    const bMap = {};
    (bills || []).forEach((b) => { if (!bMap[b.customer_id]) bMap[b.customer_id] = b.paid_up_to; });
    setLastBills(bMap);

    const { data: pays } = await supabase.from('payments').select('customer_id, payment_date').order('payment_date', { ascending: false });
    const pMap = {};
    (pays || []).forEach((p) => { if (!pMap[p.customer_id]) pMap[p.customer_id] = p.payment_date; });
    setLastPayments(pMap);
    setLoading(false);
  }

  function getOverdue(c) {
    const paidUpToYM = lastBills[c.id];
    if (!paidUpToYM || paidUpToYM.length > 7) return null;
    return monthsOverdueFromYM(paidUpToYM);
  }

  const filtered = customers.filter((c) => {
    if (areaFilter !== 'all' && c.area !== areaFilter) return false;
    if (statusFilter !== 'all') {
      const ov = getOverdue(c);
      if (statusFilter === 'green' && (ov === null || ov > 3)) return false;
      if (statusFilter === 'yellow' && (ov === null || ov <= 3 || ov > 6)) return false;
      if (statusFilter === 'red' && (ov === null || ov <= 6)) return false;
    }
    return true;
  });

  const headers = ['Customer Code', 'Name', 'Phone', 'Address', 'Area', 'Monthly Fee (Rs.)', 'Registration Date (BS)', 'Payment Start Month', 'Paid Up To', 'Last Payment', 'Months Overdue', 'Status', 'Registered By'];
  function toRows() {
    return filtered.map((c) => {
      const paidUpToYM = lastBills[c.id];
      const overdue = getOverdue(c);
      return {
        'Customer Code': c.customer_code,
        'Name': c.name,
        'Phone': c.phone,
        'Address': c.address,
        'Area': c.area.replace('ward-', 'Ward '),
        'Monthly Fee (Rs.)': Number(c.monthly_fee),
        'Registration Date (BS)': toBS(c.registration_date),
        'Payment Start Month': toBSMonth(c.payment_start_date),
        'Paid Up To': paidUpToYM ? yyyymmToLabel(paidUpToYM) : 'No bills',
        'Last Payment': lastPayments[c.id] ? toBSMonth(lastPayments[c.id]) : '—',
        'Months Overdue': overdue ?? '—',
        'Status': getStatusLabel(paidUpToYM),
        'Registered By': c.app_users?.full_name || '',
      };
    });
  }
  const csvRows = filtered.map((c) => {
    const paidUpToYM = lastBills[c.id];
    const overdue = getOverdue(c);
    return [c.customer_code, c.name, c.phone, c.address, c.area.replace('ward-', 'Ward '), c.monthly_fee, toBS(c.registration_date), toBSMonth(c.payment_start_date), paidUpToYM ? yyyymmToLabel(paidUpToYM) : 'No bills', lastPayments[c.id] ? toBSMonth(lastPayments[c.id]) : '—', overdue ?? '—', getStatusLabel(paidUpToYM), c.app_users?.full_name];
  });

  const s = sty;
  return (
    <div>
      <div style={s.filterBar}>
        <div>
          <label style={s.filterLabel}>Area</label>
          <select style={s.select} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="all">All Areas</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label style={s.filterLabel}>Status</label>
          <select style={s.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="green">Up to date (≤3mo)</option>
            <option value="yellow">Overdue 3–6mo</option>
            <option value="red">Critical 6mo+</option>
          </select>
        </div>
        <button style={s.resetBtn} onClick={() => { setAreaFilter('all'); setStatusFilter('all'); }}>✕ Reset</button>
      </div>

      <div style={s.summaryRow}>
        <div style={s.chip}><strong>{filtered.length}</strong> customers</div>
        <div style={{ flex: 1 }} />
        <button style={s.csvBtn} onClick={() => downloadCSV(`customers-${Date.now()}.csv`, headers, csvRows)}>⬇ CSV</button>
        <button style={s.xlsBtn} onClick={() => downloadExcel(`customers-${Date.now()}.xlsx`, 'Customers', toRows())}>⬇ Excel</button>
      </div>

      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Code</th><th style={s.th}>Name</th><th style={s.th}>Area</th>
            <th style={s.th}>Fee</th><th style={s.th}>Paid Up To</th>
            <th style={s.th}>Last Payment</th><th style={s.th}>Overdue</th>
          </tr></thead>
          <tbody>
            {filtered.slice(0, 20).map((c) => {
              const paidUpToYM = lastBills[c.id];
              const overdue = getOverdue(c);
              const overdueColor = overdue === null ? '#64748b' : overdue <= 3 ? '#15803d' : overdue <= 6 ? '#a16207' : '#b91c1c';
              return (
                <tr key={c.id}>
                  <td style={s.td}>{c.customer_code}</td>
                  <td style={s.td}>{c.name}</td>
                  <td style={s.td}>{c.area.replace('ward-', 'Ward ')}</td>
                  <td style={s.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                  <td style={s.td}>{paidUpToYM ? yyyymmToLabel(paidUpToYM) : '—'}</td>
                  <td style={s.td}>{lastPayments[c.id] ? toBSMonth(lastPayments[c.id]) : '—'}</td>
                  <td style={{ ...s.td, color: overdueColor, fontWeight: 600 }}>
                    {overdue === null ? '—' : overdue <= 0 ? '✓ Current' : `${overdue}mo`}
                  </td>
                </tr>
              );
            })}
            {filtered.length > 20 && <tr><td colSpan={7} style={{ ...s.td, color: '#94a3b8', textAlign: 'center' }}>... and {filtered.length - 20} more rows (all included in export)</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Overdue({ user, isAdmin }) {
  const [customers, setCustomers] = useState([]);
  const [lastBills, setLastBills] = useState({});
  const [lastPayments, setLastPayments] = useState({});
  const [threshold, setThreshold] = useState(3);
  const [areaFilter, setAreaFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: custs } = await supabase.from('customers').select('*, app_users(full_name)').eq('status', 'active').order('customer_code');
    setCustomers(custs || []);

    const { data: bills } = await supabase.from('bills').select('customer_id, paid_up_to').order('created_at', { ascending: false });
    const bMap = {};
    (bills || []).forEach((b) => { if (!bMap[b.customer_id]) bMap[b.customer_id] = b.paid_up_to; });
    setLastBills(bMap);

    const { data: pays } = await supabase.from('payments').select('customer_id, payment_date').order('payment_date', { ascending: false });
    const pMap = {};
    (pays || []).forEach((p) => { if (!pMap[p.customer_id]) pMap[p.customer_id] = p.payment_date; });
    setLastPayments(pMap);
    setLoading(false);
  }

  function getOverdue(c) {
    const paidUpToYM = lastBills[c.id];
    if (!paidUpToYM || paidUpToYM.length > 7) return Infinity;
    const ov = monthsOverdueFromYM(paidUpToYM);
    return ov ?? Infinity;
  }

  const filtered = customers
    .filter((c) => {
      if (areaFilter !== 'all' && c.area !== areaFilter) return false;
      return getOverdue(c) >= threshold;
    })
    .sort((a, b) => getOverdue(b) - getOverdue(a));

  const totalUnpaid = filtered.reduce((sum, c) => sum + Number(c.monthly_fee) * Math.max(getOverdue(c), 0), 0);

  const headers = ['Customer Code', 'Name', 'Phone', 'Area', 'Monthly Fee (Rs.)', 'Paid Up To', 'Months Overdue', 'Est. Dues (Rs.)', 'Registered By'];
  function toRows() {
    return filtered.map((c) => {
      const paidUpToYM = lastBills[c.id];
      const overdue = getOverdue(c);
      return {
        'Customer Code': c.customer_code,
        'Name': c.name,
        'Phone': c.phone,
        'Area': c.area.replace('ward-', 'Ward '),
        'Monthly Fee (Rs.)': Number(c.monthly_fee),
        'Paid Up To': paidUpToYM ? yyyymmToLabel(paidUpToYM) : 'Never paid',
        'Months Overdue': overdue === Infinity ? 'Never paid' : overdue,
        'Est. Dues (Rs.)': overdue === Infinity ? '—' : Number(c.monthly_fee) * overdue,
        'Registered By': c.app_users?.full_name || '',
      };
    });
  }
  const csvRows = filtered.map((c) => {
    const paidUpToYM = lastBills[c.id];
    const overdue = getOverdue(c);
    return [c.customer_code, c.name, c.phone, c.area.replace('ward-', 'Ward '), c.monthly_fee, paidUpToYM ? yyyymmToLabel(paidUpToYM) : 'Never paid', overdue === Infinity ? 'Never paid' : overdue, overdue === Infinity ? '—' : Number(c.monthly_fee) * overdue, c.app_users?.full_name];
  });

  const s = sty;
  return (
    <div>
      <div style={s.filterBar}>
        <div>
          <label style={s.filterLabel}>Minimum months overdue</label>
          <select style={s.select} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
            <option value={1}>1+ months</option>
            <option value={3}>3+ months</option>
            <option value={6}>6+ months</option>
            <option value={12}>12+ months</option>
          </select>
        </div>
        <div>
          <label style={s.filterLabel}>Area</label>
          <select style={s.select} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="all">All Areas</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <button style={s.resetBtn} onClick={() => { setThreshold(3); setAreaFilter('all'); }}>✕ Reset</button>
      </div>

      <div style={s.summaryRow}>
        <div style={{ ...s.chip, background: '#fee2e2', color: '#b91c1c' }}><strong>{filtered.length}</strong> overdue customers</div>
        <div style={{ ...s.chip, background: '#fee2e2', color: '#b91c1c' }}>Est. dues: <strong>Rs. {totalUnpaid.toLocaleString()}</strong></div>
        <div style={{ flex: 1 }} />
        <button style={s.csvBtn} onClick={() => downloadCSV(`overdue-${Date.now()}.csv`, headers, csvRows)}>⬇ CSV</button>
        <button style={s.xlsBtn} onClick={() => downloadExcel(`overdue-${Date.now()}.xlsx`, 'Overdue', toRows())}>⬇ Excel</button>
      </div>

      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : filtered.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No customers overdue by {threshold}+ months.</p>
      ) : (
        <table style={s.table}>
          <thead><tr>
            <th style={s.th}>Code</th><th style={s.th}>Name</th><th style={s.th}>Phone</th>
            <th style={s.th}>Area</th><th style={s.th}>Fee/mo</th>
            <th style={s.th}>Paid Up To</th><th style={s.th}>Overdue</th><th style={s.th}>Est. Dues</th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => {
              const paidUpToYM = lastBills[c.id];
              const overdue = getOverdue(c);
              const estDues = overdue === Infinity ? null : Number(c.monthly_fee) * overdue;
              return (
                <tr key={c.id}>
                  <td style={s.td}>{c.customer_code}</td>
                  <td style={s.td}><strong>{c.name}</strong></td>
                  <td style={s.td}>{c.phone}</td>
                  <td style={s.td}>{c.area.replace('ward-', 'Ward ')}</td>
                  <td style={s.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                  <td style={s.td}>{paidUpToYM ? yyyymmToLabel(paidUpToYM) : 'Never paid'}</td>
                  <td style={{ ...s.td, color: '#b91c1c', fontWeight: 700 }}>
                    {overdue === Infinity ? '—' : `${overdue}mo`}
                  </td>
                  <td style={{ ...s.td, color: '#b91c1c', fontWeight: 600 }}>
                    {estDues !== null ? `Rs. ${estDues.toLocaleString()}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────
const sty = {
  filterBar: { background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterLabel: { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 },
  select: { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
  resetBtn: { padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748b' },
  summaryRow: { display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' },
  chip: { background: '#fff', borderRadius: 8, padding: '8px 14px', border: '1px solid #e2e8f0', fontSize: 13 },
  csvBtn: { padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  xlsBtn: { padding: '9px 18px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 12, overflow: 'hidden' },
  th: { textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, fontSize: 11, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
};

// ── Main Reports Page ─────────────────────────────────────
function Reports() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState('customers');

  const tabStyle = (a) => ({
    padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none',
    borderBottom: a ? '2px solid #22c55e' : '2px solid transparent',
    color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer',
  });

  return (
    <Layout title="Reports">
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
        <button style={tabStyle(tab === 'customers')} onClick={() => setTab('customers')}>Customer Report</button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>Payment Report</button>
        <button style={tabStyle(tab === 'overdue')} onClick={() => setTab('overdue')}>Overdue Report</button>
      </div>

      {tab === 'customers' && <Customers user={user} isAdmin={isAdmin} />}
      {tab === 'payments' && <Payments user={user} isAdmin={isAdmin} />}
      {tab === 'overdue' && <Overdue user={user} isAdmin={isAdmin} />}
    </Layout>
  );
}

export default withAuth(Reports);