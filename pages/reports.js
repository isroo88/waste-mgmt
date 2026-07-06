import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import BSMonthPicker, { yyyymmToLabel } from '../components/BSMonthPicker';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS, toBSMonth, monthsOverdueFromYM, AREAS } from '../lib/dateUtils';

const SHOW_STEP = 10;

// ── Export helpers ──────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  trigger(blob, filename);
}

// Package-free Excel export using XML spreadsheet format — no xlsx dependency needed
function downloadExcel(filename, headers, rows) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<?mso-application progid="Excel.Sheet"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`,
    `<Worksheet ss:Name="Report"><Table>`,
    `<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>`,
    ...rows.map((r) => `<Row>${r.map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('')}</Row>`),
    `</Table></Worksheet></Workbook>`,
  ].join('');
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  trigger(blob, filename);
}

function trigger(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Status helpers ──────────────────────────────────────────
function getStatusLabel(paidUpToYM) {
  if (!paidUpToYM) return 'No bills';
  const overdue = monthsOverdueFromYM(paidUpToYM);
  if (overdue === null) return '—';
  if (overdue <= 0) return 'Up to date';
  if (overdue <= 3) return `${overdue}mo overdue`;
  if (overdue <= 6) return `${overdue}mo overdue (warning)`;
  return `${overdue}mo overdue (critical)`;
}

// ── Shared styles ───────────────────────────────────────────
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
  showMore: { width: '100%', padding: '12px', marginTop: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' },
};

// ── Payment Report ──────────────────────────────────────────
function PaymentsReport({ user, isAdmin }) {
  const [payments, setPayments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [fromYM, setFromYM] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(SHOW_STEP);

  useEffect(() => { loadPayments(); }, []);

  async function loadPayments() {
    setLoading(true);
    let q = supabase
      .from('payments')
      .select('id, amount, payment_date, customers(name, business_name, customer_type, customer_code, area), app_users(full_name, staff_code), bills(from_month, to_month, period_label)')
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

  function getName(p) {
    const c = p.customers;
    return c?.customer_type === 'business' ? (c?.business_name || c?.name) : c?.name || '—';
  }

  const filtered = payments.filter((p) => {
    if (areaFilter !== 'all' && p.customers?.area !== areaFilter) return false;
    if (staffFilter !== 'all' && p.app_users?.staff_code !== staffFilter) return false;
    if (fromYM) {
      const [y, m] = fromYM.split('/').map(Number);
      const filterAD = new Date(y - 57, m + 2, 1).toISOString().slice(0, 10);
      if (p.payment_date < filterAD) return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((s, p) => s + Number(p.amount), 0);
  const headers = ['Date (BS)', 'Customer Name', 'Customer Code', 'Type', 'Area', 'Amount (Rs.)', 'Period', 'Collected By', 'Staff Code'];
  const allRows = filtered.map((p) => [toBS(p.payment_date), getName(p), p.customers?.customer_code, p.customers?.customer_type === 'business' ? 'Business' : 'Individual', p.customers?.area?.replace('ward-', 'Ward '), Number(p.amount), p.bills?.period_label || '', p.app_users?.full_name, p.app_users?.staff_code]);

  const s = sty;
  return (
    <div>
      <div style={s.filterBar}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <BSMonthPicker label="From Month" value={fromYM} onChange={(v) => { setFromYM(v); setVisible(SHOW_STEP); }} />
        </div>
        <div>
          <label style={s.filterLabel}>Area</label>
          <select style={s.select} value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setVisible(SHOW_STEP); }}>
            <option value="all">All Areas</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        {isAdmin && staffList.length > 0 && (
          <div>
            <label style={s.filterLabel}>Staff</label>
            <select style={s.select} value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setVisible(SHOW_STEP); }}>
              <option value="all">All Staff</option>
              {staffList.map((st) => <option key={st.id} value={st.staff_code}>{st.full_name}</option>)}
            </select>
          </div>
        )}
        <button style={s.resetBtn} onClick={() => { setFromYM(''); setAreaFilter('all'); setStaffFilter('all'); setVisible(SHOW_STEP); }}>✕ Reset</button>
      </div>
      <div style={s.summaryRow}>
        <div style={s.chip}><strong>{filtered.length}</strong> records</div>
        <div style={s.chip}>Total: <strong style={{ color: '#22c55e' }}>Rs. {totalAmount.toLocaleString()}</strong></div>
        <div style={{ flex: 1 }} />
        <button style={s.csvBtn} onClick={() => downloadCSV(`payments-${Date.now()}.csv`, headers, allRows)}>⬇ CSV</button>
        <button style={s.xlsBtn} onClick={() => downloadExcel(`payments-${Date.now()}.xls`, headers, allRows)}>⬇ Excel</button>
      </div>
      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
        <>
          <table style={s.table}>
            <thead><tr>{['Date (BS)', 'Name', 'Code', 'Type', 'Area', 'Amount', 'Period', 'Collected By'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.slice(0, visible).map((p) => (
                <tr key={p.id}>
                  <td style={s.td}>{toBS(p.payment_date)}</td>
                  <td style={s.td}>{getName(p)}</td>
                  <td style={s.td}>{p.customers?.customer_code}</td>
                  <td style={s.td}>{p.customers?.customer_type === 'business' ? '🏢 Biz' : '👤'}</td>
                  <td style={s.td}>{p.customers?.area?.replace('ward-', 'Ward ')}</td>
                  <td style={s.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                  <td style={s.td}>{p.bills?.period_label}</td>
                  <td style={s.td}>{p.app_users?.full_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > visible && (
            <button style={s.showMore} onClick={() => setVisible((v) => v + SHOW_STEP)}>
              Show {Math.min(SHOW_STEP, filtered.length - visible)} more ({filtered.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Customer Report ─────────────────────────────────────────
function CustomersReport({ user, isAdmin }) {
  const [customers, setCustomers] = useState([]);
  const [lastBills, setLastBills] = useState({});
  const [lastPayments, setLastPayments] = useState({});
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(SHOW_STEP);

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
    if (!paidUpToYM || !/^\d{4}\/\d{2}$/.test(paidUpToYM)) return null;
    return monthsOverdueFromYM(paidUpToYM);
  }

  function getName(c) { return c.customer_type === 'business' ? (c.business_name || c.name) : c.name; }

  const filtered = customers.filter((c) => {
    if (areaFilter !== 'all' && c.area !== areaFilter) return false;
    if (typeFilter !== 'all' && c.customer_type !== typeFilter) return false;
    if (statusFilter !== 'all') {
      const ov = getOverdue(c);
      if (statusFilter === 'green' && (ov === null || ov > 3)) return false;
      if (statusFilter === 'yellow' && (ov === null || ov <= 3 || ov > 6)) return false;
      if (statusFilter === 'red' && (ov === null || ov <= 6)) return false;
    }
    return true;
  });

  const headers = ['Code', 'Name', 'Type', 'Phone', 'Area', 'Fee (Rs.)', 'Registered (BS)', 'Payment Start', 'Paid Up To', 'Last Payment', 'Months Overdue', 'Status', 'Registered By'];
  const allRows = filtered.map((c) => {
    const paidUpToYM = lastBills[c.id];
    const overdue = getOverdue(c);
    return [c.customer_code, getName(c), c.customer_type, c.phone, c.area.replace('ward-', 'Ward '), c.monthly_fee, toBS(c.registration_date), toBSMonth(c.payment_start_date), paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM) ? yyyymmToLabel(paidUpToYM) : 'No bills', lastPayments[c.id] ? toBSMonth(lastPayments[c.id]) : '—', overdue ?? '—', getStatusLabel(paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM) ? paidUpToYM : null), c.app_users?.full_name];
  });

  const overdueColor = (ov) => ov === null ? '#64748b' : ov <= 3 ? '#15803d' : ov <= 6 ? '#a16207' : '#b91c1c';

  return (
    <div>
      <div style={sty.filterBar}>
        <div>
          <label style={sty.filterLabel}>Area</label>
          <select style={sty.select} value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setVisible(SHOW_STEP); }}>
            <option value="all">All Areas</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label style={sty.filterLabel}>Type</label>
          <select style={sty.select} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setVisible(SHOW_STEP); }}>
            <option value="all">All</option>
            <option value="individual">Customers</option>
            <option value="business">Businesses</option>
          </select>
        </div>
        <div>
          <label style={sty.filterLabel}>Status</label>
          <select style={sty.select} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setVisible(SHOW_STEP); }}>
            <option value="all">All</option>
            <option value="green">Up to date (≤3mo)</option>
            <option value="yellow">Overdue 3–6mo</option>
            <option value="red">Critical 6mo+</option>
          </select>
        </div>
        <button style={sty.resetBtn} onClick={() => { setAreaFilter('all'); setStatusFilter('all'); setTypeFilter('all'); setVisible(SHOW_STEP); }}>✕ Reset</button>
      </div>
      <div style={sty.summaryRow}>
        <div style={sty.chip}><strong>{filtered.length}</strong> records</div>
        <div style={{ flex: 1 }} />
        <button style={sty.csvBtn} onClick={() => downloadCSV(`customers-${Date.now()}.csv`, headers, allRows)}>⬇ CSV</button>
        <button style={sty.xlsBtn} onClick={() => downloadExcel(`customers-${Date.now()}.xls`, headers, allRows)}>⬇ Excel</button>
      </div>
      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
        <>
          <table style={sty.table}>
            <thead><tr>{['Code','Name','Type','Area','Fee','Paid Up To','Last Payment','Overdue'].map((h) => <th key={h} style={sty.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.slice(0, visible).map((c) => {
                const paidUpToYM = lastBills[c.id];
                const validYM = paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM) ? paidUpToYM : null;
                const overdue = getOverdue(c);
                return (
                  <tr key={c.id}>
                    <td style={sty.td}>{c.customer_code}</td>
                    <td style={sty.td}>{getName(c)}</td>
                    <td style={sty.td}>{c.customer_type === 'business' ? '🏢 Biz' : '👤'}</td>
                    <td style={sty.td}>{c.area.replace('ward-', 'Ward ')}</td>
                    <td style={sty.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                    <td style={sty.td}>{validYM ? yyyymmToLabel(validYM) : '—'}</td>
                    <td style={sty.td}>{lastPayments[c.id] ? toBSMonth(lastPayments[c.id]) : '—'}</td>
                    <td style={{ ...sty.td, color: overdueColor(overdue), fontWeight: 600 }}>
                      {overdue === null ? '—' : overdue <= 0 ? '✓ Current' : `${overdue}mo`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > visible && (
            <button style={sty.showMore} onClick={() => setVisible((v) => v + SHOW_STEP)}>
              Show {Math.min(SHOW_STEP, filtered.length - visible)} more ({filtered.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Overdue Report ──────────────────────────────────────────
function OverdueReport({ user, isAdmin }) {
  const [customers, setCustomers] = useState([]);
  const [lastBills, setLastBills] = useState({});
  const [threshold, setThreshold] = useState(3);
  const [areaFilter, setAreaFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(SHOW_STEP);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: custs } = await supabase.from('customers').select('*, app_users(full_name)').eq('status', 'active').order('customer_code');
    setCustomers(custs || []);
    const { data: bills } = await supabase.from('bills').select('customer_id, paid_up_to').order('created_at', { ascending: false });
    const bMap = {};
    (bills || []).forEach((b) => { if (!bMap[b.customer_id]) bMap[b.customer_id] = b.paid_up_to; });
    setLastBills(bMap);
    setLoading(false);
  }

  function getName(c) { return c.customer_type === 'business' ? (c.business_name || c.name) : c.name; }

  function getOverdue(c) {
    const paidUpToYM = lastBills[c.id];
    if (!paidUpToYM || !/^\d{4}\/\d{2}$/.test(paidUpToYM)) return Infinity;
    return monthsOverdueFromYM(paidUpToYM) ?? Infinity;
  }

  const filtered = customers
    .filter((c) => {
      if (areaFilter !== 'all' && c.area !== areaFilter) return false;
      if (typeFilter !== 'all' && c.customer_type !== typeFilter) return false;
      return getOverdue(c) >= threshold;
    })
    .sort((a, b) => getOverdue(b) - getOverdue(a));

  const totalEst = filtered.reduce((sum, c) => {
    const ov = getOverdue(c);
    return sum + (ov === Infinity ? 0 : Number(c.monthly_fee) * ov);
  }, 0);

  const headers = ['Code', 'Name', 'Type', 'Phone', 'Area', 'Fee (Rs.)', 'Paid Up To', 'Months Overdue', 'Est. Dues (Rs.)', 'Registered By'];
  const allRows = filtered.map((c) => {
    const paidUpToYM = lastBills[c.id];
    const validYM = paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM) ? paidUpToYM : null;
    const overdue = getOverdue(c);
    return [c.customer_code, getName(c), c.customer_type, c.phone, c.area.replace('ward-', 'Ward '), c.monthly_fee, validYM ? yyyymmToLabel(validYM) : 'Never paid', overdue === Infinity ? 'Never paid' : overdue, overdue === Infinity ? 0 : Number(c.monthly_fee) * overdue, c.app_users?.full_name];
  });

  return (
    <div>
      <div style={sty.filterBar}>
        <div>
          <label style={sty.filterLabel}>Minimum months overdue</label>
          <select style={sty.select} value={threshold} onChange={(e) => { setThreshold(Number(e.target.value)); setVisible(SHOW_STEP); }}>
            <option value={1}>1+ months</option>
            <option value={3}>3+ months</option>
            <option value={6}>6+ months</option>
            <option value={12}>12+ months</option>
          </select>
        </div>
        <div>
          <label style={sty.filterLabel}>Area</label>
          <select style={sty.select} value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setVisible(SHOW_STEP); }}>
            <option value="all">All Areas</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label style={sty.filterLabel}>Type</label>
          <select style={sty.select} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setVisible(SHOW_STEP); }}>
            <option value="all">All</option>
            <option value="individual">Customers</option>
            <option value="business">Businesses</option>
          </select>
        </div>
        <button style={sty.resetBtn} onClick={() => { setThreshold(3); setAreaFilter('all'); setTypeFilter('all'); setVisible(SHOW_STEP); }}>✕ Reset</button>
      </div>
      <div style={sty.summaryRow}>
        <div style={{ ...sty.chip, background: '#fee2e2', color: '#b91c1c' }}><strong>{filtered.length}</strong> overdue</div>
        <div style={{ ...sty.chip, background: '#fee2e2', color: '#b91c1c' }}>Est. dues: <strong>Rs. {totalEst.toLocaleString()}</strong></div>
        <div style={{ flex: 1 }} />
        <button style={sty.csvBtn} onClick={() => downloadCSV(`overdue-${Date.now()}.csv`, headers, allRows)}>⬇ CSV</button>
        <button style={sty.xlsBtn} onClick={() => downloadExcel(`overdue-${Date.now()}.xls`, headers, allRows)}>⬇ Excel</button>
      </div>
      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : filtered.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No customers overdue by {threshold}+ months.</p>
      ) : (
        <>
          <table style={sty.table}>
            <thead><tr>{['Code','Name','Type','Phone','Area','Fee/mo','Paid Up To','Overdue','Est. Dues'].map((h) => <th key={h} style={sty.th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.slice(0, visible).map((c) => {
                const paidUpToYM = lastBills[c.id];
                const validYM = paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM) ? paidUpToYM : null;
                const overdue = getOverdue(c);
                const estDues = overdue === Infinity ? null : Number(c.monthly_fee) * overdue;
                return (
                  <tr key={c.id}>
                    <td style={sty.td}>{c.customer_code}</td>
                    <td style={sty.td}><strong>{getName(c)}</strong></td>
                    <td style={sty.td}>{c.customer_type === 'business' ? '🏢' : '👤'}</td>
                    <td style={sty.td}>{c.phone}</td>
                    <td style={sty.td}>{c.area.replace('ward-', 'Ward ')}</td>
                    <td style={sty.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                    <td style={sty.td}>{validYM ? yyyymmToLabel(validYM) : 'Never paid'}</td>
                    <td style={{ ...sty.td, color: '#b91c1c', fontWeight: 700 }}>{overdue === Infinity ? '—' : `${overdue}mo`}</td>
                    <td style={{ ...sty.td, color: '#b91c1c', fontWeight: 600 }}>{estDues !== null ? `Rs. ${estDues.toLocaleString()}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > visible && (
            <button style={sty.showMore} onClick={() => setVisible((v) => v + SHOW_STEP)}>
              Show {Math.min(SHOW_STEP, filtered.length - visible)} more ({filtered.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Reports Page ───────────────────────────────────────
function Reports() {
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState('customers');
  const tabStyle = (a) => ({ padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', borderBottom: a ? '2px solid #22c55e' : '2px solid transparent', color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer' });

  return (
    <Layout title="Reports">
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
        <button style={tabStyle(tab === 'customers')} onClick={() => setTab('customers')}>Customer Report</button>
        <button style={tabStyle(tab === 'payments')} onClick={() => setTab('payments')}>Payment Report</button>
        <button style={tabStyle(tab === 'overdue')} onClick={() => setTab('overdue')}>Overdue Report</button>
      </div>
      {tab === 'customers' && <CustomersReport user={user} isAdmin={isAdmin} />}
      {tab === 'payments' && <PaymentsReport user={user} isAdmin={isAdmin} />}
      {tab === 'overdue' && <OverdueReport user={user} isAdmin={isAdmin} />}
    </Layout>
  );
}

export default withAuth(Reports);