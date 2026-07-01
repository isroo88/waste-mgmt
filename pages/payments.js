import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS, todayBS, bsToAD } from '../lib/dateUtils';

function Payments() {
  const { user, isAdmin } = useAuth();
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedBill, setSelectedBill] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDateBS, setPaymentDateBS] = useState(todayBS());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    const { data: billData } = await supabase
      .from('bills')
      .select('id, amount, period_label, customer_id, customers(name)')
      .eq('status', 'unpaid')
      .order('generated_date', { ascending: false });
    setUnpaidBills(billData || []);

    let paymentsQuery = supabase
      .from('payments')
      .select('id, amount, payment_date, customers(name), app_users(full_name)')
      .order('payment_date', { ascending: false })
      .limit(30);
    if (!isAdmin) paymentsQuery = paymentsQuery.eq('collected_by', user.id);
    const { data: paymentData } = await paymentsQuery;
    setPayments(paymentData || []);
  }

  function handleBillChange(id) {
    setSelectedBill(id);
    const bill = unpaidBills.find((b) => b.id === id);
    if (bill) setAmount(bill.amount);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const dateAD = bsToAD(paymentDateBS);
    if (!selectedBill || !amount || !dateAD) {
      setError('Please select a bill and enter a valid amount/date.');
      return;
    }
    setSubmitting(true);
    const bill = unpaidBills.find((b) => b.id === selectedBill);

    const { error: paymentError } = await supabase.from('payments').insert({
      customer_id: bill.customer_id,
      bill_id: bill.id,
      amount: Number(amount),
      payment_date: dateAD.toISOString().slice(0, 10),
      collected_by: user.id,
    });

    if (!paymentError) {
      await supabase.from('bills').update({ status: 'paid' }).eq('id', bill.id);
    }

    setSubmitting(false);
    if (paymentError) {
      setError(paymentError.message);
    } else {
      setSelectedBill('');
      setAmount('');
      setPaymentDateBS(todayBS());
      loadData();
    }
  }

  const styles = {
    layout: { display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    button: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14 },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
    empty: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
  };

  return (
    <Layout title="Payments">
      <div style={styles.layout}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Record a Payment</h3>
          {unpaidBills.length === 0 && <p style={styles.empty}>No unpaid bills right now. Generate one from the Billing page first.</p>}
          <div style={styles.field}>
            <label style={styles.label}>Unpaid Bill *</label>
            <select style={styles.input} value={selectedBill} onChange={(e) => handleBillChange(e.target.value)} required>
              <option value="">Select bill...</option>
              {unpaidBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.customers?.name} — {b.period_label} (Rs. {Number(b.amount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Amount Received (Rs.) *</label>
            <input style={styles.input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Payment Date (BS) *</label>
            <input style={styles.input} value={paymentDateBS} onChange={(e) => setPaymentDateBS(e.target.value)} required />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </form>

        <div>
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
              {payments.map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}>{p.customers?.name}</td>
                  <td style={styles.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                  <td style={styles.td}>{toBS(p.payment_date)}</td>
                  {isAdmin && <td style={styles.td}>{p.app_users?.full_name}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(Payments);
