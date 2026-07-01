import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS, AREAS } from '../../lib/dateUtils';

function Customers() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [lastPayments, setLastPayments] = useState({}); // customer_id -> date
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (router.query.search) setSearch(router.query.search);
  }, [router.query.search]);

  useEffect(() => {
    if (user) loadCustomers();
  }, [user]);

  async function loadCustomers() {
    setLoading(true);
    const { data: customerData } = await supabase
      .from('customers')
      .select('*, app_users(full_name)')
      .order('created_at', { ascending: false });

    const { data: paymentData } = await supabase
      .from('payments')
      .select('customer_id, payment_date')
      .order('payment_date', { ascending: false });

    const lastPaymentMap = {};
    (paymentData || []).forEach((p) => {
      if (!lastPaymentMap[p.customer_id]) lastPaymentMap[p.customer_id] = p.payment_date;
    });

    setLastPayments(lastPaymentMap);
    setCustomers(customerData || []);
    setLoading(false);
  }

  const filtered = customers.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.address.toLowerCase().includes(search.toLowerCase());
    const matchesArea = areaFilter === 'all' || c.area === areaFilter;
    return matchesSearch && matchesArea;
  });

  const styles = {
    toolbar: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
    input: { flex: 1, minWidth: 220, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    select: { padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
    tagOwn: { fontSize: 11, color: '#22c55e', fontWeight: 600 },
  };

  return (
    <Layout title="Customers">
      <div style={styles.toolbar}>
        <input
          style={styles.input}
          placeholder="Search by name, phone, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={styles.select} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
          <option value="all">All Areas</option>
          {AREAS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#64748b' }}>No customers found.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Area</th>
              <th style={styles.th}>Monthly Fee</th>
              <th style={styles.th}>Registered (BS)</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Registered By</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/customers/${c.id}`)}>
                <td style={styles.td}>{c.name}</td>
                <td style={styles.td}>{c.phone}</td>
                <td style={styles.td}>{c.area.replace('ward-', 'Ward ')}</td>
                <td style={styles.td}>Rs. {Number(c.monthly_fee).toLocaleString()}</td>
                <td style={styles.td}>{toBS(c.registration_date)}</td>
                <td style={styles.td}><StatusBadge customer={c} lastPaymentDate={lastPayments[c.id]} /></td>
                <td style={styles.td}>
                  {c.app_users?.full_name}
                  {c.registered_by === user.id && <span style={styles.tagOwn}> (you)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}

export default withAuth(Customers);
