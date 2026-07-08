import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS, AREAS } from '../../lib/dateUtils';

const SHOW_STEP = 15;

function Customers() {
  const { user } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [lastPayments, setLastPayments] = useState({});
  const [lastBills, setLastBills] = useState({});
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('active');
  const [visible, setVisible] = useState(SHOW_STEP);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (router.query.search) setSearch(router.query.search);
  }, [router.query.search]);

  useEffect(() => { if (user) loadCustomers(); }, [user]);

  async function loadCustomers() {
    setLoading(true);
    const { data: customerData } = await supabase
      .from('customers')
      .select('*, app_users(full_name)')
      .eq('customer_type', 'individual')
      .order('created_at', { ascending: false });

    const { data: paymentData } = await supabase
      .from('payments').select('customer_id, payment_date').order('payment_date', { ascending: false });
    const lastPaymentMap = {};
    (paymentData || []).forEach((p) => { if (!lastPaymentMap[p.customer_id]) lastPaymentMap[p.customer_id] = p.payment_date; });

    const { data: billData } = await supabase
      .from('bills').select('customer_id, paid_up_to').order('created_at', { ascending: false });
    const lastBillMap = {};
    (billData || []).forEach((b) => { if (!lastBillMap[b.customer_id]) lastBillMap[b.customer_id] = b.paid_up_to; });

    setLastPayments(lastPaymentMap);
    setLastBills(lastBillMap);
    setCustomers(customerData || []);
    setLoading(false);
  }

  const activeCustomers = customers.filter((c) => c.status === 'active');
  const inactiveCustomers = customers.filter((c) => c.status === 'deactivated');
  const sourceList = activeTab === 'active' ? activeCustomers : inactiveCustomers;

  const filtered = sourceList.filter((c) => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.customer_code || '').toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase());
    const matchesArea = areaFilter === 'all' || c.area === areaFilter;
    return matchesSearch && matchesArea;
  });

  const s = {
    tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' },
    tab: (a) => ({ padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', borderBottom: a ? '2px solid #22c55e' : '2px solid transparent', color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer' }),
    tabCount: (a) => ({ display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: a ? '#22c55e' : '#e2e8f0', color: a ? '#fff' : '#64748b' }),
    toolbar: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
    input: { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    select: { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
    showMore: { width: '100%', padding: '12px', marginTop: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' },
    count: { fontSize: 13, color: '#64748b', marginBottom: 12 },
    deactivatedRow: { opacity: 0.6, background: '#fafafa' },
  };

  return (
    <Layout title="Customers">
      {/* Active / Inactive tabs */}
      <div style={s.tabs}>
        <button style={s.tab(activeTab === 'active')} onClick={() => { setActiveTab('active'); setVisible(SHOW_STEP); }}>
          Active
          <span style={s.tabCount(activeTab === 'active')}>{activeCustomers.length}</span>
        </button>
        <button style={s.tab(activeTab === 'inactive')} onClick={() => { setActiveTab('inactive'); setVisible(SHOW_STEP); }}>
          Inactive
          <span style={s.tabCount(activeTab === 'inactive')}>{inactiveCustomers.length}</span>
        </button>
      </div>

      <div style={s.toolbar}>
        <input style={s.input} placeholder="Search by name, phone, code or address..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisible(SHOW_STEP); }} />
        <select style={s.select} value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setVisible(SHOW_STEP); }}>
          <option value="all">All Areas</option>
          {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <p style={s.count}>Showing {Math.min(visible, filtered.length)} of {filtered.length} {activeTab === 'inactive' ? 'inactive ' : ''}customers</p>

      {loading ? <p style={{ color: '#64748b' }}>Loading...</p> : filtered.length === 0 ? (
        <p style={{ color: '#64748b' }}>
          {activeTab === 'inactive' ? 'No inactive customers.' : 'No customers found.'}
        </p>
      ) : (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Code</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Phone</th>
                <th style={s.th}>Area</th>
                <th style={s.th}>Monthly Fee</th>
                <th style={s.th}>Registered (BS)</th>
                {activeTab === 'active' && <th style={s.th}>Status</th>}
                <th style={s.th}>Registered By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visible).map((c) => {
                const paidUpToYM = lastBills[c.id];
                return (
                  <tr key={c.id}
                    style={activeTab === 'inactive' ? s.deactivatedRow : {}}
                    onClick={() => router.push(`/customers/${c.id}`)}>
                    <td style={s.td}>{c.customer_code}</td>
                    <td style={s.td}>{c.name}</td>
                    <td style={s.td}>{c.phone}</td>
                    <td style={s.td}>{c.area.replace('ward-', 'Ward ')}</td>
                    <td style={s.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                    <td style={s.td}>{toBS(c.registration_date)}</td>
                    {activeTab === 'active' && (
                      <td style={s.td}>
                        <StatusBadge customer={c} lastPaymentDate={lastPayments[c.id]} paidUpToYM={paidUpToYM?.length <= 7 ? paidUpToYM : null} />
                      </td>
                    )}
                    <td style={s.td}>
                      {c.app_users?.full_name}
                      {c.registered_by === user.id && <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}> (you)</span>}
                    </td>
                  </tr>
                );
              })}
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

export default withAuth(Customers);