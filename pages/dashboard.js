import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS, monthsOverdueFromYM, monthsSince } from '../lib/dateUtils';

const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false });

function Dashboard() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, active: 0, monthly: 0, daily: 0 });
  const [statusCounts, setStatusCounts] = useState({ green: 0, yellow: 0, red: 0 });
  const [graphData, setGraphData] = useState([]);
  const [staffBlocks, setStaffBlocks] = useState([]);
  const [myPerf, setMyPerf] = useState({ daily: 0, monthly: 0, customers: 0, lifetime: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadDashboard(); }, [user]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // All customers
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, payment_start_date, status, customer_type');

    // Last paid_up_to per customer from bills — this is the correct overdue reference
    const { data: allBills } = await supabase
      .from('bills')
      .select('customer_id, paid_up_to')
      .order('created_at', { ascending: false });

    const lastBillMap = {};
    (allBills || []).forEach((b) => {
      if (!lastBillMap[b.customer_id]) lastBillMap[b.customer_id] = b.paid_up_to;
    });

    // Last payment date per customer (fallback if no bills)
    const { data: lastPayments } = await supabase
      .from('payments')
      .select('customer_id, payment_date')
      .order('payment_date', { ascending: false });

    const lastPaymentMap = {};
    (lastPayments || []).forEach((p) => {
      if (!lastPaymentMap[p.customer_id]) lastPaymentMap[p.customer_id] = p.payment_date;
    });

    // Calculate status counts using paid_up_to (BS month) — same logic as customer profile
    let green = 0, yellow = 0, red = 0, active = 0;
    (allCustomers || []).forEach((c) => {
      if (c.status !== 'active') return;
      active++;

      const paidUpToYM = lastBillMap[c.id];
      let overdue;

      if (paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM)) {
        // Use BS month-based overdue calculation — matches customer profile
        overdue = monthsOverdueFromYM(paidUpToYM);
      } else {
        // Fallback: no bills yet — use months since payment_start_date
        overdue = monthsSince(c.payment_start_date);
      }

      const ov = overdue ?? 0;
      if (ov <= 3) green++;
      else if (ov <= 6) yellow++;
      else red++;
    });

    setStats((s) => ({ ...s, total: allCustomers?.length || 0, active }));
    setStatusCounts({ green, yellow, red });

    if (isAdmin) {
      const { data: dayP } = await supabase.from('payments').select('amount').gte('payment_date', today);
      const { data: monP } = await supabase.from('payments').select('amount').gte('payment_date', startOfMonth);
      const daily = (dayP || []).reduce((s, p) => s + Number(p.amount), 0);
      const monthly = (monP || []).reduce((s, p) => s + Number(p.amount), 0);
      setStats((s) => ({ ...s, daily, monthly }));

      // Graph — last 6 months
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
      const { data: gp } = await supabase.from('payments').select('amount, payment_date').gte('payment_date', sixAgo);
      const monthMap = {};
      (gp || []).forEach((p) => {
        const key = p.payment_date.slice(0, 7);
        monthMap[key] = (monthMap[key] || 0) + Number(p.amount);
      });
      setGraphData(Object.keys(monthMap).sort().map((k) => ({ month: k, total: monthMap[k] })));

      // Staff blocks
      const { data: staffList } = await supabase
        .from('app_users').select('id, full_name, staff_code, status').eq('role', 'staff');

      const blocks = await Promise.all((staffList || []).map(async (st) => {
        const { data: dayPay } = await supabase.from('payments').select('amount').eq('collected_by', st.id).gte('payment_date', today);
        const { data: monPay } = await supabase.from('payments').select('amount').eq('collected_by', st.id).gte('payment_date', startOfMonth);
        const { data: lifePay } = await supabase.from('payments').select('amount').eq('collected_by', st.id);
        const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('registered_by', st.id);
        return {
          ...st,
          daily: (dayPay || []).reduce((s, p) => s + Number(p.amount), 0),
          monthly: (monPay || []).reduce((s, p) => s + Number(p.amount), 0),
          lifetime: (lifePay || []).reduce((s, p) => s + Number(p.amount), 0),
          customers: custCount || 0,
        };
      }));
      setStaffBlocks(blocks);
    } else {
      const { data: dayPay } = await supabase.from('payments').select('amount').eq('collected_by', user.id).gte('payment_date', today);
      const { data: monPay } = await supabase.from('payments').select('amount').eq('collected_by', user.id).gte('payment_date', startOfMonth);
      const { data: lifePay } = await supabase.from('payments').select('amount').eq('collected_by', user.id);
      const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('registered_by', user.id);
      setMyPerf({
        daily: (dayPay || []).reduce((s, p) => s + Number(p.amount), 0),
        monthly: (monPay || []).reduce((s, p) => s + Number(p.amount), 0),
        lifetime: (lifePay || []).reduce((s, p) => s + Number(p.amount), 0),
        customers: custCount || 0,
      });
    }
    setLoading(false);
  }

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/customers?search=${encodeURIComponent(search.trim())}`);
  }

  const s = {
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
    card: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' },
    cardLabel: { fontSize: 13, color: '#64748b', margin: 0 },
    cardValue: { fontSize: 26, fontWeight: 700, margin: '6px 0 0' },
    statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
    statusCard: (bg, border) => ({ background: bg, borderRadius: 12, padding: 20, border: `1px solid ${border}`, textAlign: 'center' }),
    statusNum: (color) => ({ fontSize: 32, fontWeight: 800, color, margin: '4px 0' }),
    searchForm: { display: 'flex', gap: 8, marginBottom: 24 },
    searchInput: { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    searchBtn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600, cursor: 'pointer' },
    section: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 24 },
    sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 },
    staffGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
    staffCard: { background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', cursor: 'pointer' },
    staffName: { fontWeight: 700, fontSize: 15, margin: '0 0 2px' },
    staffCode: { fontSize: 12, color: '#94a3b8', margin: '0 0 12px' },
    perfRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
    perfLabel: { fontSize: 12, color: '#64748b' },
    perfValue: { fontSize: 12, fontWeight: 700, color: '#0f172a' },
    dot: (c) => ({ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block', marginRight: 6 }),
  };

  return (
    <Layout title="Dashboard">
      <form style={s.searchForm} onSubmit={handleSearch}>
        <input style={s.searchInput} placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button style={s.searchBtn} type="submit">Search</button>
      </form>

      {/* Status counts — based on paid_up_to BS month */}
      <div style={s.statusGrid}>
        <div style={s.statusCard('#dcfce7', '#bbf7d0')}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#15803d' }}><span style={s.dot('#22c55e')} />PAID UP TO DATE</p>
          <p style={s.statusNum('#15803d')}>{statusCounts.green}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#16a34a' }}>Within last 3 months</p>
        </div>
        <div style={s.statusCard('#fef9c3', '#fde68a')}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#a16207' }}><span style={s.dot('#eab308')} />OVERDUE</p>
          <p style={s.statusNum('#a16207')}>{statusCounts.yellow}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#ca8a04' }}>3–6 months overdue</p>
        </div>
        <div style={s.statusCard('#fee2e2', '#fecaca')}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#b91c1c' }}><span style={s.dot('#ef4444')} />CRITICAL</p>
          <p style={s.statusNum('#b91c1c')}>{statusCounts.red}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#dc2626' }}>6+ months overdue</p>
        </div>
      </div>

      {/* Summary stats */}
      {isAdmin ? (
        <div style={s.grid4}>
          <div style={s.card}><p style={s.cardLabel}>Total Customers</p><p style={s.cardValue}>{stats.total}</p></div>
          <div style={s.card}><p style={s.cardLabel}>Active Customers</p><p style={s.cardValue}>{stats.active}</p></div>
          <div style={s.card}><p style={s.cardLabel}>Today's Collection</p><p style={s.cardValue}>Rs. {stats.daily.toLocaleString()}</p></div>
          <div style={s.card}><p style={s.cardLabel}>Monthly Collection</p><p style={s.cardValue}>Rs. {stats.monthly.toLocaleString()}</p></div>
        </div>
      ) : (
        <div style={s.grid4}>
          <div style={s.card}><p style={s.cardLabel}>My Customers</p><p style={s.cardValue}>{myPerf.customers}</p></div>
          <div style={s.card}><p style={s.cardLabel}>Today's Collection</p><p style={s.cardValue}>Rs. {myPerf.daily.toLocaleString()}</p></div>
          <div style={s.card}><p style={s.cardLabel}>Monthly Collection</p><p style={s.cardValue}>Rs. {myPerf.monthly.toLocaleString()}</p></div>
          <div style={s.card}><p style={s.cardLabel}>Lifetime Collection</p><p style={s.cardValue}>Rs. {myPerf.lifetime.toLocaleString()}</p></div>
        </div>
      )}

      {/* Collection graph */}
      {isAdmin && graphData.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Monthly Collection Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={graphData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => `Rs. ${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Staff performance */}
      {isAdmin && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Staff Performance</h3>
          {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : (
            <div style={s.staffGrid}>
              {staffBlocks.map((st) => (
                <div key={st.id} style={s.staffCard}
                  onClick={() => router.push(`/users/${st.id}`)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#22c55e'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={s.staffName}>{st.full_name}</p>
                      <p style={s.staffCode}>{st.staff_code} · <span style={{ color: st.status === 'active' ? '#22c55e' : '#ef4444' }}>{st.status}</span></p>
                    </div>
                    <span style={{ fontSize: 20 }}>→</span>
                  </div>
                  <div style={s.perfRow}><span style={s.perfLabel}>Customers registered</span><span style={s.perfValue}>{st.customers}</span></div>
                  <div style={s.perfRow}><span style={s.perfLabel}>Today's collection</span><span style={s.perfValue}>Rs. {st.daily.toLocaleString()}</span></div>
                  <div style={s.perfRow}><span style={s.perfLabel}>Monthly collection</span><span style={s.perfValue}>Rs. {st.monthly.toLocaleString()}</span></div>
                  <div style={s.perfRow}><span style={s.perfLabel}>Lifetime collection</span><span style={s.perfValue}>Rs. {st.lifetime.toLocaleString()}</span></div>
                </div>
              ))}
              {staffBlocks.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>No staff accounts yet.</p>}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

export default withAuth(Dashboard);