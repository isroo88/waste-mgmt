import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS, todayBS } from '../lib/dateUtils';

function Billing() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: customerData } = await supabase
      .from('customers')
      .select('id, name, monthly_fee')
      .eq('status', 'active')
      .order('name');
    setCustomers(customerData || []);

    const { data: billData } = await supabase
      .from('bills')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
      .limit(30);
    setBills(billData || []);
  }

  function handleCustomerChange(id) {
    setSelectedCustomer(id);
    const c = customers.find((c) => c.id === id);
    if (c) setAmount(c.monthly_fee);
  }

  async function generateBillNumber() {
    const ts = Date.now().toString().slice(-8);
    return `BILL-${ts}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!selectedCustomer || !amount || !periodLabel) {
      setError('Please fill all fields.');
      return;
    }
    setSubmitting(true);
    const billNumber = await generateBillNumber();
    const { error: insertError } = await supabase.from('bills').insert({
      bill_number: billNumber,
      customer_id: selectedCustomer,
      amount: Number(amount),
      period_label: periodLabel,
      generated_by: user.id,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      setSelectedCustomer('');
      setAmount('');
      setPeriodLabel('');
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
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    statusPill: (status) => ({
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: status === 'paid' ? '#dcfce7' : '#fef9c3',
      color: status === 'paid' ? '#15803d' : '#a16207',
    }),
  };

  return (
    <Layout title="Billing">
      <div style={styles.layout}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Generate New Bill</h3>
          <div style={styles.field}>
            <label style={styles.label}>Customer *</label>
            <select style={styles.input} value={selectedCustomer} onChange={(e) => handleCustomerChange(e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Period (BS) *</label>
            <input
              style={styles.input}
              placeholder="e.g. 2082 Baisakh"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Amount (Rs.) *</label>
            <input style={styles.input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Generating...' : 'Generate Bill'}
          </button>
        </form>

        <div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Bill #</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Period</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Date (BS)</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id}>
                  <td style={styles.td}>{b.bill_number}</td>
                  <td style={styles.td}>{b.customers?.name}</td>
                  <td style={styles.td}>{b.period_label}</td>
                  <td style={styles.td}>Rs. {Number(b.amount).toLocaleString()}</td>
                  <td style={styles.td}>{toBS(b.generated_date)}</td>
                  <td style={styles.td}><span style={styles.statusPill(b.status)}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(Billing);
