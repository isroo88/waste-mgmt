import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { withAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const SHOW_STEP = 6;

function StaffPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('lifetime');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visible, setVisible] = useState(SHOW_STEP);

  useEffect(() => { loadStaff(); }, []);

  async function loadStaff() {
    setLoading(true);
    const { data: staffData } = await supabase
      .from('app_users')
      .select('*')
      .eq('role', 'staff')
      .order('created_at', { ascending: false });

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const enriched = await Promise.all((staffData || []).map(async (st) => {
      const { data: dayPay } = await supabase.from('payments').select('amount').eq('collected_by', st.id).gte('payment_date', today);
      const { data: monPay } = await supabase.from('payments').select('amount').eq('collected_by', st.id).gte('payment_date', startOfMonth);
      const { data: lifePay } = await supabase.from('payments').select('amount').eq('collected_by', st.id);
      const { count: custCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('registered_by', st.id);
      const { count: bizCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('registered_by', st.id).eq('customer_type', 'business');
      return {
        ...st,
        daily: (dayPay || []).reduce((s, p) => s + Number(p.amount), 0),
        monthly: (monPay || []).reduce((s, p) => s + Number(p.amount), 0),
        lifetime: (lifePay || []).reduce((s, p) => s + Number(p.amount), 0),
        customers: custCount || 0,
        businesses: bizCount || 0,
      };
    }));

    setStaffList(enriched);
    setLoading(false);
  }

  const filtered = staffList
    .filter((st) => {
      const matchSearch = !search ||
        st.full_name.toLowerCase().includes(search.toLowerCase()) ||
        st.username.toLowerCase().includes(search.toLowerCase()) ||
        (st.staff_code || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || st.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'lifetime') return b.lifetime - a.lifetime;
      if (sortBy === 'monthly') return b.monthly - a.monthly;
      if (sortBy === 'daily') return b.daily - a.daily;
      if (sortBy === 'customers') return b.customers - a.customers;
      if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
      return 0;
    });

  const s = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
    searchInput: { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    select: { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
    card: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'border-color 0.15s' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    avatar: { width: 44, height: 44, borderRadius: '50%', background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 },
    name: { fontSize: 15, fontWeight: 700, margin: '0 0 2px' },
    code: { fontSize: 12, color: '#94a3b8', margin: 0 },
    statusPill: (active) => ({ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: active ? '#dcfce7' : '#fee2e2', color: active ? '#15803d' : '#b91c1c' }),
    divider: { border: 'none', borderTop: '1px solid #f1f5f9', margin: '14px 0' },
    perfGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
    perfItem: { },
    perfLabel: { fontSize: 11, color: '#94a3b8', margin: 0 },
    perfValue: { fontSize: 14, fontWeight: 700, margin: '2px 0 0', color: '#0f172a' },
    arrow: { fontSize: 18, color: '#94a3b8' },
    count: { fontSize: 13, color: '#64748b', marginBottom: 14 },
    showMore: { width: '100%', padding: '12px', marginTop: 16, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' },
    rankBadge: (rank) => ({
      width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7c2f' : '#f1f5f9',
      color: rank <= 3 ? '#fff' : '#94a3b8',
    }),
  };

  return (
    <Layout title="Staff">
      <div style={s.toolbar}>
        <input
          style={s.searchInput}
          placeholder="Search by name, username or staff code..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisible(SHOW_STEP); }}
        />
        <select style={s.select} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setVisible(SHOW_STEP); }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <select style={s.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="lifetime">Sort: Lifetime Collection</option>
          <option value="monthly">Sort: Monthly Collection</option>
          <option value="daily">Sort: Today's Collection</option>
          <option value="customers">Sort: Customers Registered</option>
          <option value="name">Sort: Name (A–Z)</option>
        </select>
      </div>

      <p style={s.count}>
        Showing {Math.min(visible, filtered.length)} of {filtered.length} staff
      </p>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading staff performance...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No staff found.</p>
      ) : (
        <>
          <div style={s.grid}>
            {filtered.slice(0, visible).map((st, i) => (
              <div
                key={st.id}
                style={s.card}
                onClick={() => router.push(`/users/${st.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#22c55e'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <div style={s.cardHeader}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={s.avatar}>{st.full_name[0]}</div>
                    <div>
                      <p style={s.name}>{st.full_name}</p>
                      <p style={s.code}>{st.staff_code} · @{st.username}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div style={s.rankBadge(i + 1)}>#{i + 1}</div>
                    <span style={s.statusPill(st.status === 'active')}>{st.status}</span>
                  </div>
                </div>

                <hr style={s.divider} />

                <div style={s.perfGrid}>
                  <div style={s.perfItem}>
                    <p style={s.perfLabel}>Today's Collection</p>
                    <p style={s.perfValue}>Rs. {st.daily.toLocaleString()}</p>
                  </div>
                  <div style={s.perfItem}>
                    <p style={s.perfLabel}>Monthly Collection</p>
                    <p style={s.perfValue}>Rs. {st.monthly.toLocaleString()}</p>
                  </div>
                  <div style={s.perfItem}>
                    <p style={s.perfLabel}>Lifetime Collection</p>
                    <p style={{ ...s.perfValue, color: '#22c55e' }}>Rs. {st.lifetime.toLocaleString()}</p>
                  </div>
                  <div style={s.perfItem}>
                    <p style={s.perfLabel}>Customers / Businesses</p>
                    <p style={s.perfValue}>{st.customers} / {st.businesses}</p>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
                  Click to view full records →
                </div>
              </div>
            ))}
          </div>

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

export default withAuth(StaffPage, 'admin');