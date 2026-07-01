import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS } from '../lib/dateUtils';

function FeeRequests() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [myCustomers, setMyCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [requestedFee, setRequestedFee] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    let reqQuery = supabase
      .from('fee_requests')
      .select('*, customers(name), app_users!fee_requests_requested_by_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (!isAdmin) reqQuery = reqQuery.eq('requested_by', user.id);
    const { data: reqData } = await reqQuery;
    setRequests(reqData || []);

    if (!isAdmin) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, name, monthly_fee')
        .eq('registered_by', user.id)
        .eq('status', 'active');
      setMyCustomers(customerData || []);
    }
  }

  function handleCustomerChange(id) {
    setSelectedCustomer(id);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const customer = myCustomers.find((c) => c.id === selectedCustomer);
    if (!customer || !requestedFee || !reason) {
      setError('Please fill all fields.');
      return;
    }
    if (Number(requestedFee) >= customer.monthly_fee) {
      setError('Requested fee must be lower than current fee (use direct edit for increases).');
      return;
    }
    setSubmitting(true);
    const { error: insertError } = await supabase.from('fee_requests').insert({
      customer_id: customer.id,
      requested_by: user.id,
      current_fee: customer.monthly_fee,
      requested_fee: Number(requestedFee),
      reason,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSelectedCustomer('');
      setRequestedFee('');
      setReason('');
      loadData();
    }
  }

  async function handleReview(request, approve) {
    const newStatus = approve ? 'approved' : 'rejected';
    await supabase
      .from('fee_requests')
      .update({ status: newStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', request.id);

    if (approve) {
      await supabase.from('customers').update({ monthly_fee: request.requested_fee }).eq('id', request.customer_id);
      await supabase.from('fee_change_log').insert({
        customer_id: request.customer_id,
        changed_by: user.id,
        old_fee: request.current_fee,
        new_fee: request.requested_fee,
        change_type: 'approved_decrease',
      });
    }
    loadData();
  }

  const styles = {
    layout: { display: 'grid', gridTemplateColumns: !isAdmin ? '380px 1fr' : '1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, minHeight: 80, resize: 'vertical' },
    button: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14 },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    statusPill: (status) => ({
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: status === 'approved' ? '#dcfce7' : status === 'rejected' ? '#fee2e2' : '#fef9c3',
      color: status === 'approved' ? '#15803d' : status === 'rejected' ? '#b91c1c' : '#a16207',
    }),
    actionBtn: (bg) => ({ padding: '6px 14px', borderRadius: 6, border: 'none', background: bg, color: '#fff', fontSize: 12, fontWeight: 600, marginRight: 8 }),
  };

  return (
    <Layout title="Fee Decrease Requests">
      <div style={styles.layout}>
        {!isAdmin && (
          <form style={styles.form} onSubmit={handleSubmit}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Request a Fee Decrease</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: -8 }}>Only for customers you registered.</p>
            <div style={styles.field}>
              <label style={styles.label}>Customer *</label>
              <select style={styles.input} value={selectedCustomer} onChange={(e) => handleCustomerChange(e.target.value)} required>
                <option value="">Select customer...</option>
                {myCustomers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} (current: Rs. {c.monthly_fee})</option>
                ))}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Requested New Fee (Rs.) *</label>
              <input style={styles.input} type="number" min="0" value={requestedFee} onChange={(e) => setRequestedFee(e.target.value)} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Reason *</label>
              <textarea style={styles.textarea} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        )}

        <div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Current Fee</th>
                <th style={styles.th}>Requested Fee</th>
                <th style={styles.th}>Reason</th>
                {isAdmin && <th style={styles.th}>Requested By</th>}
                <th style={styles.th}>Status</th>
                {isAdmin && <th style={styles.th}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.customers?.name}</td>
                  <td style={styles.td}>Rs. {Number(r.current_fee).toLocaleString()}</td>
                  <td style={styles.td}>Rs. {Number(r.requested_fee).toLocaleString()}</td>
                  <td style={styles.td}>{r.reason}</td>
                  {isAdmin && <td style={styles.td}>{r.app_users?.full_name}</td>}
                  <td style={styles.td}><span style={styles.statusPill(r.status)}>{r.status}</span></td>
                  {isAdmin && (
                    <td style={styles.td}>
                      {r.status === 'pending' ? (
                        <>
                          <button style={styles.actionBtn('#22c55e')} onClick={() => handleReview(r, true)}>Approve</button>
                          <button style={styles.actionBtn('#ef4444')} onClick={() => handleReview(r, false)}>Reject</button>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>Reviewed</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(FeeRequests);
