import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS } from '../lib/dateUtils';

// Recharts uses browser-only APIs (window/document).
// dynamic import with ssr:false prevents a server-side crash during Vercel build.
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
  const [recentPayments, setRecentPayments] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  async function loadDashboard() {
    setLoading(true);

    const { count: total } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    const { count: active } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Recent payments — staff see only their own, admin sees all
    let paymentsQuery = supabase
      .from('payments')
      .select('id, amount, payment_date, customer_id, customers(name), collected_by, app_users(full_name)')
      .order('payment_date', { ascending: false })
      .limit(10);
    if (!isAdmin) paymentsQuery = paymentsQuery.eq('collected_by', user.id);
    const { data: payments } = await paymentsQuery;

    let monthlyTotal = 0;
    let dailyTotal = 0;

    if (isAdmin) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const startOfDay = now.toISOString().slice(0, 10);

      const { data: monthPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', startOfMonth);
      monthlyTotal = (monthPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      const { data: dayPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', startOfDay);
      dailyTotal = (dayPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

      // Last 6 months collection graph
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
      const { data: graphPayments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .gte('payment_date', sixMonthsAgo);

      const monthMap = {};
      (graphPayments || []).forEach((p) => {
        const key = p.payment_date.slice(0, 7); // YYYY-MM
        monthMap[key] = (monthMap[key] || 0) + Number(p.amount);
      });
      const sortedGraph = Object.keys(monthMap)
        .sort()
        .map((key) => ({ month: key, total: monthMap[key] }));
      setGraphData(sortedGraph);
    }

    setStats({ total: total || 0, active: active || 0, monthly: monthlyTotal, daily: dailyTotal });
    setRecentPayments(payments || []);
    setLoading(false);
  }

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/customers?search=${encodeURIComponent(search.trim())}`);
  }

  const styles = {
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
    card: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' },
    cardLabel: { fontSize: 13, color: '#64748b', margin: 0 },
    cardValue: { fontSize: 28, fontWeight: 700, margin: '8px 0 0' },
    searchForm: { display: 'flex', gap: 8, marginBottom: 24 },
    searchInput: { flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    searchBtn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600 },
    section: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', marginBottom: 24 },
    sectionTitle: { fontSize: 15, fontWeight: 700, marginBottom: 16 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' },
    td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  };

  return (
    <Layout title="Dashboard">
      <form style={styles.searchForm} onSubmit={handleSearch}>
        <input
          style={styles.searchInput}
          placeholder="Search customers by name, phone, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button style={styles.searchBtn} type="submit">Search</button>
      </form>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Total Customers</p>
          <p style={styles.cardValue}>{stats.total}</p>
        </div>
        <div style={styles.card}>
          <p style={styles.cardLabel}>Active Customers</p>
          <p style={styles.cardValue}>{stats.active}</p>
        </div>
        {isAdmin && (
          <>
            <div style={styles.card}>
              <p style={styles.cardLabel}>Monthly Collection</p>
              <p style={styles.cardValue}>Rs. {stats.monthly.toLocaleString()}</p>
            </div>
            <div style={styles.card}>
              <p style={styles.cardLabel}>Daily Collection</p>
              <p style={styles.cardValue}>Rs. {stats.daily.toLocaleString()}</p>
            </div>
          </>
        )}
      </div>

      {isAdmin && graphData.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Monthly Collection Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={graphData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => `Rs. ${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Recent Payments</h3>
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : recentPayments.length === 0 ? (
          <p style={{ color: '#64748b' }}>No payments recorded yet.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Date (BS)</th>
                {isAdmin && <th style={styles.th}>Collected By</th>}
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}>{p.customers?.name || '—'}</td>
                  <td style={styles.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                  <td style={styles.td}>{toBS(p.payment_date)}</td>
                  {isAdmin && <td style={styles.td}>{p.app_users?.full_name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

export default withAuth(Dashboard);
