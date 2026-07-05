import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import BSMonthPicker from '../components/BSMonthPicker';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS, bsToAD } from '../lib/dateUtils';

const SHOW_STEP = 15;

function Payments() {
  const { user, isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [visible, setVisible] = useState(SHOW_STEP);

  const [search, setSearch] = useState('');
  const [filterFromYM, setFilterFromYM] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [staffFilter, setStaffFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // all / individual / business

  useEffect(() => { if (user) loadPayments(); }, [user]);

  async function loadPayments() {
    setLoading(true);
    let q = supabase
      .from('payments')
      .select('id, amount, payment_date, customer_id, customers(name, business_name, customer_type, customer_code, area), collected_by, app_users(full_name, staff_code)')
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

  function getCustomerName(p) {
    const c = p.customers;
    if (!c) return '—';
    return c.customer_type === 'business' ? (c.business_name || c.name) : c.name;
  }

  function resetFilters() {
    setSearch(''); setFilterFromYM(''); setSortOrder('desc');
    setStaffFilter('all'); setTypeFilter('all'); setVisible(SHOW_STEP);
  }

  const filterFromAD = filterFromYM ? bsToAD(`${filterFromYM}/01`)?.toISOString().slice(0, 10) : '';

  const filtered = payments
    .filter((p) => {
      if (search) {
        const name = getCustomerName(p).toLowerCase();
        const code = (p.customers?.customer_code || '').toLowerCase();
        if (!name.includes(search.toLowerCase()) && !code.includes(search.toLowerCase())) return false;
      }
      if (filterFromAD && p.payment_date < filterFromAD) return false;
      if (staffFilter !== 'all' && p.collected_by !== staffFilter) return false;
      if (typeFilter !== 'all' && p.customers?.customer_type !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => sortOrder === 'desc'
      ? new Date(b.payment_date) - new Date(a.payment_date)
      : new Date(a.payment_date) - new Date(b.payment_date));

  const totalAmount = filtered.reduce((sum, p) => sum + Number(p.amount), 0);

  const s = {
    filterBar: { background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', marginBottom: 16 },
    filterRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
    field: { display: 'flex', flexDirection: 'column', gap: 4 },
    label: { fontSize: 12, fontWeight: 600, color: '#64748b' },
    input: { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    resetBtn: { padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748b' },
    summaryRow: { display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
    chip: { background: '#fff', borderRadius: 8, padding: '8px 14px', border: '1px solid #e2e8f0', fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    showMore: { width: '100%', padding: '12px', marginTop: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' },
    bizBadge: { display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '1px 5px', marginRight: 4 },
  };

  return (
    <Layout title="Payment Records">
      <div style={s.filterBar}>
        <div style={s.filterRow}>
          <div style={s.field}>
            <label style={s.label}>Search customer</label>
            <input style={{ ...s.input, width: 180 }} placeholder="Name or code..."
              value={search} onChange={(e) => { setSearch(e.target.value); setVisible(SHOW_STEP); }} />
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <BSMonthPicker label="Show payments from (BS)" value={filterFromYM} onChange={(v) => { setFilterFromYM(v); setVisible(SHOW_STEP); }} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Type</label>
            <select style={s.input} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setVisible(SHOW_STEP); }}>
              <option value="all">All</option>
              <option value="individual">Customers</option>
              <option value="business">Businesses</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Sort</label>
            <select style={s.input} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          {isAdmin && staffList.length > 0 && (
            <div style={s.field}>
              <label style={s.label}>Staff</label>
              <select style={s.input} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                <option value="all">All Staff</option>
                {staffList.map((st) => <option key={st.id} value={st.id}>{st.full_name}</option>)}
              </select>
            </div>
          )}
          <button style={s.resetBtn} onClick={resetFilters}>✕ Reset</button>
        </div>
      </div>

      <div style={s.summaryRow}>
        <div style={s.chip}>Showing <strong>{Math.min(visible, filtered.length)}</strong> of {filtered.length}</div>
        <div style={s.chip}>Total: <strong style={{ color: '#22c55e' }}>Rs. {totalAmount.toLocaleString()}</strong></div>
        {filterFromYM && <div style={s.chip}>From: <strong>{filterFromYM}</strong></div>}
      </div>

      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Customer / Business</th>
                <th style={s.th}>Code</th>
                <th style={s.th}>Area</th>
                <th style={s.th}>Amount</th>
                <th style={s.th} onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                  Date (BS) {sortOrder === 'desc' ? '↓' : '↑'}
                </th>
                {isAdmin && <th style={s.th}>Collected By</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ ...s.td, color: '#94a3b8', textAlign: 'center', padding: 24 }}>No records found.</td></tr>
              ) : (
                filtered.slice(0, visible).map((p) => (
                  <tr key={p.id}>
                    <td style={s.td}>
                      {p.customers?.customer_type === 'business' && <span style={s.bizBadge}>BIZ</span>}
                      {getCustomerName(p)}
                    </td>
                    <td style={s.td}>{p.customers?.customer_code}</td>
                    <td style={s.td}>{p.customers?.area?.replace('ward-', 'Ward ')}</td>
                    <td style={s.td}><strong>Rs. {Number(p.amount).toLocaleString()}</strong></td>
                    <td style={s.td}>{toBS(p.payment_date)}</td>
                    {isAdmin && (
                      <td style={s.td}>
                        {p.app_users?.full_name}
                        {p.app_users?.staff_code && <span style={{ color: '#94a3b8', fontSize: 12 }}> ({p.app_users.staff_code})</span>}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {filtered.length > visible && (
            <button style={s.showMore} onClick={() => setVisible((v) => v + SHOW_STEP)}>
              Show {Math.min(SHOW_STEP, filtered.length - visible)} more ({filtered.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </Layout>
  );
}

export default withAuth(Payments);