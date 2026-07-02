import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { withAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS } from '../../lib/dateUtils';

function StaffDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [staff, setStaff] = useState(null);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ daily: 0, monthly: 0, lifetime: 0 });
  const [tab, setTab] = useState('payments');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    const { data: staffData } = await supabase.from('app_users').select('*').eq('id', id).single();
    setStaff(staffData);

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const { data: allPay } = await supabase.from('payments').select('*, customers(name)').eq('collected_by', id).order('payment_date', { ascending: false });
    const { data: dayPay } = await supabase.from('payments').select('amount').eq('collected_by', id).gte('payment_date', today);
    const { data: monPay } = await supabase.from('payments').select('amount').eq('collected_by', id).gte('payment_date', startOfMonth);

    setPayments(allPay || []);
    setStats({
      daily: (dayPay || []).reduce((s, p) => s + Number(p.amount), 0),
      monthly: (monPay || []).reduce((s, p) => s + Number(p.amount), 0),
      lifetime: (allPay || []).reduce((s, p) => s + Number(p.amount), 0),
    });

    const { data: custData } = await supabase.from('customers').select('*').eq('registered_by', id).order('created_at', { ascending: false });
    setCustomers(custData || []);
  }

  if (!staff) return <Layout title="Staff Detail"><p style={{ color: '#94a3b8' }}>Loading...</p></Layout>;

  const s = {
    header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
    avatar: { width: 52, height: 52, borderRadius: '50%', background: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 },
    name: { fontSize: 20, fontWeight: 700, margin: 0 },
    meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
    card: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' },
    cardLabel: { fontSize: 12, color: '#64748b', margin: 0 },
    cardValue: { fontSize: 22, fontWeight: 700, margin: '6px 0 0' },
    tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' },
    tab: (a) => ({ padding: '10px 18px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', borderBottom: a ? '2px solid #22c55e' : '2px solid transparent', color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer' }),
    section: { background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' },
    td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
    backBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer', marginBottom: 20 },
  };

  return (
    <Layout title={staff.full_name}>
      <button style={s.backBtn} onClick={() => router.back()}>← Back</button>
      <div style={s.header}>
        <div style={s.avatar}>{staff.full_name[0]}</div>
        <div>
          <h2 style={s.name}>{staff.full_name}</h2>
          <p style={s.meta}>{staff.staff_code} · @{staff.username} · <span style={{ textTransform: 'capitalize', color: staff.status === 'active' ? '#22c55e' : '#ef4444' }}>{staff.status}</span></p>
        </div>
      </div>

      <div style={s.grid}>
        <div style={s.card}><p style={s.cardLabel}>Today's Collection</p><p style={s.cardValue}>Rs. {stats.daily.toLocaleString()}</p></div>
        <div style={s.card}><p style={s.cardLabel}>Monthly Collection</p><p style={s.cardValue}>Rs. {stats.monthly.toLocaleString()}</p></div>
        <div style={s.card}><p style={s.cardLabel}>Lifetime Collection</p><p style={s.cardValue}>Rs. {stats.lifetime.toLocaleString()}</p></div>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'payments')} onClick={() => setTab('payments')}>Payment Records ({payments.length})</button>
        <button style={s.tab(tab === 'customers')} onClick={() => setTab('customers')}>Registered Customers ({customers.length})</button>
      </div>

      <div style={s.section}>
        {tab === 'payments' && (
          payments.length === 0 ? <p style={{ color: '#94a3b8' }}>No payments collected yet.</p> : (
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Date (BS)</th>
              </tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={s.td}>{p.customers?.name}</td>
                    <td style={s.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                    <td style={s.td}>{toBS(p.payment_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === 'customers' && (
          customers.length === 0 ? <p style={{ color: '#94a3b8' }}>No customers registered yet.</p> : (
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Code</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Area</th>
                <th style={s.th}>Monthly Fee</th>
                <th style={s.th}>Registered (BS)</th>
              </tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/customers/${c.id}`)}>
                    <td style={s.td}>{c.customer_code}</td>
                    <td style={s.td}>{c.name}</td>
                    <td style={s.td}>{c.area.replace('ward-', 'Ward ')}</td>
                    <td style={s.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                    <td style={s.td}>{toBS(c.registration_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </Layout>
  );
}

export default withAuth(StaffDetail, 'admin');