import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS } from '../lib/dateUtils';

function Payments() {
  const { user, isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [staffFilter, setStaffFilter] = useState('all');
  const [staffList, setStaffList] = useState([]);

  useEffect(() => { if (user) loadPayments(); }, [user]);

  useEffect(() => { applyFilters(); }, [payments, search, filterFrom, filterTo, sortOrder, staffFilter]);

  async function loadPayments() {
    setLoading(true);
    let q = supabase
      .from('payments')
      .select('id, amount, payment_date, customer_id, customers(name, customer_code, area), collected_by, app_users(full_name, staff_code)')
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

  function applyFilters() {
    let result = [...payments];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.customers?.name?.toLowerCase().includes(q) ||
        p.customers?.customer_code?.toLowerCase().includes(q)
      );
    }
    if (filterFrom) result = result.filter((p) => p.payment_date >= filterFrom);
    if (filterTo) result = result.filter((p) => p.payment_date <= filterTo);
    if (staffFilter !== 'all') result = result.filter((p) => p.collected_by === staffFilter);
    result.sort((a, b) =>
      sortOrder === 'desc'
        ? new Date(b.payment_date) - new Date(a.payment_date)
        : new Date(a.payment_date) - new Date(b.payment_date)
    );
    setFiltered(result);
  }

  const totalAmount = filtered.reduce((sum, p) => sum + Number(p.amount), 0);

  const s = {
    filterBar: { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
    field: {},
    label: { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 },
    input: { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    resetBtn: { padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' },
    summaryRow: { display: 'flex', gap: 16, marginBottom: 16 },
    summaryCard: { background: '#fff', borderRadius: 10, padding: '12px 20px', border: '1px solid #e2e8f0', fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: (sortable) => ({ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: sortable ? 'pointer' : 'default', userSelect: 'none' }),
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
  };

  return (
    <Layout title="Payment Records">
      {/* Filter bar */}
      <div style={s.filterBar}>
        <div style={s.field}>
          <label style={s.label}>Search customer</label>
          <input style={{ ...s.input, width: 200 }} placeholder="Name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>From date</label>
          <input style={s.input} type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>To date</label>
          <input style={s.input} type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Sort by date</label>
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
        <button style={s.resetBtn} onClick={() => { setSearch(''); setFilterFrom(''); setFilterTo(''); setSortOrder('desc'); setStaffFilter('all'); }}>Reset</button>
      </div>

      {/* Summary */}
      <div style={s.summaryRow}>
        <div style={s.summaryCard}>Showing <strong>{filtered.length}</strong> of {payments.length} records</div>
        <div style={s.summaryCard}>Total: <strong style={{ color: '#22c55e' }}>Rs. {totalAmount.toLocaleString()}</strong></div>
      </div>

      {/* Table */}
      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th(false)}>Customer</th>
              <th style={s.th(false)}>Code</th>
              <th style={s.th(false)}>Area</th>
              <th style={s.th(false)}>Amount</th>
              <th style={s.th(true)} onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                Date (BS) {sortOrder === 'desc' ? '↓' : '↑'}
              </th>
              {isAdmin && <th style={s.th(false)}>Collected By</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={6} style={{ ...s.td, color: '#94a3b8', textAlign: 'center' }}>No records found.</td></tr>
              : filtered.map((p) => (
                <tr key={p.id}>
                  <td style={s.td}>{p.customers?.name}</td>
                  <td style={s.td}>{p.customers?.customer_code}</td>
                  <td style={s.td}>{p.customers?.area?.replace('ward-', 'Ward ')}</td>
                  <td style={s.td}><strong>Rs. {Number(p.amount).toLocaleString()}</strong></td>
                  <td style={s.td}>{toBS(p.payment_date)}</td>
                  {isAdmin && <td style={s.td}>{p.app_users?.full_name} <span style={{ color: '#94a3b8', fontSize: 12 }}>({p.app_users?.staff_code})</span></td>}
                </tr>
              ))
            }
          </tbody>
        </table>
      )}
    </Layout>
  );
}

export default withAuth(Payments);