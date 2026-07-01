import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS } from '../../lib/dateUtils';

function CustomerDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAdmin } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [feeLog, setFeeLog] = useState([]);
  const [tab, setTab] = useState('profile');
  const [newFee, setNewFee] = useState('');
  const [decreaseReason, setDecreaseReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = customer && (isAdmin || customer.registered_by === user?.id);

  useEffect(() => {
    if (id && user) loadData();
  }, [id, user]);

  async function loadData() {
    const { data: c } = await supabase.from('customers').select('*, app_users(full_name)').eq('id', id).single();
    setCustomer(c);
    if (c) setNewFee(c.monthly_fee);

    const { data: p } = await supabase
      .from('payments')
      .select('*, app_users(full_name)')
      .eq('customer_id', id)
      .order('payment_date', { ascending: false });
    setPayments(p || []);

    const { data: f } = await supabase
      .from('fee_change_log')
      .select('*, app_users(full_name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });
    setFeeLog(f || []);
  }

  async function handleFeeUpdate(e) {
    e.preventDefault();
    setError('');
    const fee = Number(newFee);

    if (fee === customer.monthly_fee) return;

    if (fee > customer.monthly_fee) {
      // Instant increase — staff or admin
      setSubmitting(true);
      await supabase.from('customers').update({ monthly_fee: fee }).eq('id', customer.id);
      await supabase.from('fee_change_log').insert({
        customer_id: customer.id,
        changed_by: user.id,
        old_fee: customer.monthly_fee,
        new_fee: fee,
        change_type: isAdmin ? 'instant_decrease_admin' : 'instant_increase',
      });
      setSubmitting(false);
      loadData();
    } else if (isAdmin) {
      // Admin can decrease instantly too
      setSubmitting(true);
      await supabase.from('customers').update({ monthly_fee: fee }).eq('id', customer.id);
      await supabase.from('fee_change_log').insert({
        customer_id: customer.id,
        changed_by: user.id,
        old_fee: customer.monthly_fee,
        new_fee: fee,
        change_type: 'instant_decrease_admin',
      });
      setSubmitting(false);
      loadData();
    } else {
      // Staff decrease — must go through a request, redirect with context
      router.push('/fee-requests');
    }
  }

  if (!customer) {
    return (
      <Layout title="Customer">
        <p style={{ color: '#64748b' }}>Loading...</p>
      </Layout>
    );
  }

  const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    name: { fontSize: 22, fontWeight: 700, margin: 0 },
    meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
    tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' },
    tab: (active) => ({
      padding: '10px 18px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none',
      borderBottom: active ? '2px solid #22c55e' : '2px solid transparent',
      color: active ? '#0f172a' : '#94a3b8', cursor: 'pointer',
    }),
    section: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
    infoLabel: { fontSize: 12, color: '#94a3b8', margin: 0 },
    infoValue: { fontSize: 15, fontWeight: 600, margin: '4px 0 0' },
    feeForm: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' },
    field: { minWidth: 160 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    button: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' },
    td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
    error: { color: '#dc2626', fontSize: 13, marginTop: 8 },
    hint: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  };

  return (
    <Layout title={customer.name}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.name}>{customer.name}</h2>
          <p style={styles.meta}>{customer.phone} · {customer.area.replace('ward-', 'Ward ')} · Registered by {customer.app_users?.full_name}</p>
        </div>
        <StatusBadge customer={customer} lastPaymentDate={payments[0]?.payment_date} />
      </div>

      <div style={styles.tabs}>
        <button style={styles.tab(tab === 'profile')} onClick={() => setTab('profile')}>Profile & Fee</button>
        <button style={styles.tab(tab === 'payments')} onClick={() => setTab('payments')}>Payment History</button>
        <button style={styles.tab(tab === 'feelog')} onClick={() => setTab('feelog')}>Fee Change Log</button>
      </div>

      {tab === 'profile' && (
        <div style={styles.section}>
          <div style={styles.grid}>
            <div><p style={styles.infoLabel}>Address</p><p style={styles.infoValue}>{customer.address}</p></div>
            <div><p style={styles.infoLabel}>House Number</p><p style={styles.infoValue}>{customer.house_number || '—'}</p></div>
            <div><p style={styles.infoLabel}>Registration Date (BS)</p><p style={styles.infoValue}>{toBS(customer.registration_date)}</p></div>
            <div><p style={styles.infoLabel}>Payment Start Date (BS)</p><p style={styles.infoValue}>{toBS(customer.payment_start_date)}</p></div>
          </div>

          <p style={styles.infoLabel}>Current Monthly Fee</p>
          <p style={{ ...styles.infoValue, fontSize: 24, marginBottom: 16 }}>Rs. {Number(customer.monthly_fee).toLocaleString()}</p>

          {canEdit ? (
            <form style={styles.feeForm} onSubmit={handleFeeUpdate}>
              <div style={styles.field}>
                <label style={styles.label}>New Fee (Rs.)</label>
                <input style={styles.input} type="number" min="0" value={newFee} onChange={(e) => setNewFee(e.target.value)} />
              </div>
              <button style={styles.button} type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Update Fee'}
              </button>
            </form>
          ) : (
            <p style={styles.hint}>Only the staff who registered this customer (or an admin) can edit the fee.</p>
          )}
          {!isAdmin && (
            <p style={styles.hint}>Increasing the fee applies instantly. Decreasing it will redirect you to submit an approval request.</p>
          )}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      {tab === 'payments' && (
        <div style={styles.section}>
          {payments.length === 0 ? (
            <p style={{ color: '#64748b' }}>No payments recorded yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Date (BS)</th>
                  <th style={styles.th}>Collected By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={styles.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                    <td style={styles.td}>{toBS(p.payment_date)}</td>
                    <td style={styles.td}>{p.app_users?.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'feelog' && (
        <div style={styles.section}>
          {feeLog.length === 0 ? (
            <p style={{ color: '#64748b' }}>No fee changes recorded yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Old Fee</th>
                  <th style={styles.th}>New Fee</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Changed By</th>
                  <th style={styles.th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {feeLog.map((f) => (
                  <tr key={f.id}>
                    <td style={styles.td}>Rs. {Number(f.old_fee).toLocaleString()}</td>
                    <td style={styles.td}>Rs. {Number(f.new_fee).toLocaleString()}</td>
                    <td style={styles.td}>{f.change_type.replace(/_/g, ' ')}</td>
                    <td style={styles.td}>{f.app_users?.full_name}</td>
                    <td style={styles.td}>{toBS(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Layout>
  );
}

export default withAuth(CustomerDetail);
