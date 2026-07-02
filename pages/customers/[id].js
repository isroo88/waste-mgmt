import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS, bsToAD, todayBS } from '../../lib/dateUtils';

function CustomerDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAdmin } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [feeLog, setFeeLog] = useState([]);
  const [tab, setTab] = useState('profile');
  const [newFee, setNewFee] = useState('');
  const [decreaseReason, setDecreaseReason] = useState('');
  const [showDecreaseForm, setShowDecreaseForm] = useState(false);
  const [feeError, setFeeError] = useState('');
  const [feeSuccess, setFeeSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bill generation state
  const [showBillForm, setShowBillForm] = useState(false);
  const [bill, setBill] = useState({ receipt_number: '', from_month: '', to_month: '', num_months: 1, previous_dues: 0, penalty: 0, amount: '' });
  const [billError, setBillError] = useState('');
  const [billSuccess, setBillSuccess] = useState('');
  const [billSubmitting, setBillSubmitting] = useState(false);

  // Payment filter state
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    if (id && user) loadData();
  }, [id, user]);

  useEffect(() => {
    applyPaymentFilter();
  }, [payments, sortOrder, filterFrom, filterTo]);

  async function loadData() {
    const { data: c } = await supabase
      .from('customers')
      .select('*, app_users(full_name, staff_code)')
      .eq('id', id).single();
    setCustomer(c);
    if (c) {
      setNewFee(c.monthly_fee);
      setBill((b) => ({ ...b, amount: c.monthly_fee }));
    }

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

  function applyPaymentFilter() {
    let result = [...payments];
    if (filterFrom) result = result.filter((p) => p.payment_date >= filterFrom);
    if (filterTo) result = result.filter((p) => p.payment_date <= filterTo);
    result.sort((a, b) =>
      sortOrder === 'desc'
        ? new Date(b.payment_date) - new Date(a.payment_date)
        : new Date(a.payment_date) - new Date(b.payment_date)
    );
    setFilteredPayments(result);
  }

  // Any staff can increase instantly; decrease requires reason + approval unless admin
  async function handleFeeUpdate(e) {
    e.preventDefault();
    setFeeError(''); setFeeSuccess('');
    const fee = Number(newFee);
    if (fee === Number(customer.monthly_fee)) { setFeeError('New fee is the same as current fee.'); return; }

    if (fee > Number(customer.monthly_fee) || isAdmin) {
      // Instant update — increase by anyone, or admin decrease
      setSubmitting(true);
      await supabase.from('customers').update({ monthly_fee: fee }).eq('id', customer.id);
      await supabase.from('fee_change_log').insert({
        customer_id: customer.id,
        changed_by: user.id,
        old_fee: customer.monthly_fee,
        new_fee: fee,
        change_type: fee > Number(customer.monthly_fee) ? 'instant_increase' : 'instant_decrease_admin',
      });
      setSubmitting(false);
      setFeeSuccess('Fee updated successfully.');
      loadData();
    } else {
      // Staff decrease — show reason form
      setShowDecreaseForm(true);
    }
  }

  async function handleDecreaseRequest(e) {
    e.preventDefault();
    setFeeError('');
    if (!decreaseReason.trim()) { setFeeError('Please enter a reason.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('fee_requests').insert({
      customer_id: customer.id,
      requested_by: user.id,
      current_fee: customer.monthly_fee,
      requested_fee: Number(newFee),
      reason: decreaseReason,
    });
    setSubmitting(false);
    if (error) { setFeeError(error.message); return; }
    setFeeSuccess('Decrease request submitted. Awaiting admin approval.');
    setShowDecreaseForm(false);
    setDecreaseReason('');
  }

  async function handleGenerateBill(e) {
    e.preventDefault();
    setBillError(''); setBillSuccess('');
    if (!bill.receipt_number || !bill.from_month || !bill.to_month || !bill.amount) {
      setBillError('Please fill all required fields.'); return;
    }
    setBillSubmitting(true);
    const total = Number(bill.amount) + Number(bill.previous_dues) + Number(bill.penalty);
    const { error } = await supabase.from('bills').insert({
      bill_number: `BILL-${bill.receipt_number}`,
      receipt_number: bill.receipt_number,
      customer_id: customer.id,
      amount: Number(bill.amount),
      previous_dues: Number(bill.previous_dues),
      penalty: Number(bill.penalty),
      num_months: Number(bill.num_months),
      from_month: bill.from_month,
      to_month: bill.to_month,
      period_label: `${bill.from_month} – ${bill.to_month}`,
      paid_up_to: bill.to_month,
      generated_by: user.id,
      generated_date: new Date().toISOString().slice(0, 10),
      status: 'unpaid',
    });
    setBillSubmitting(false);
    if (error) { setBillError(error.message); return; }
    setBillSuccess(`Bill ${bill.receipt_number} generated. Go to Billing to print.`);
    setBill({ receipt_number: '', from_month: '', to_month: '', num_months: 1, previous_dues: 0, penalty: 0, amount: customer.monthly_fee });
    setShowBillForm(false);
  }

  if (!customer) return <Layout title="Customer"><p style={{ color: '#94a3b8' }}>Loading...</p></Layout>;

  const s = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    name: { fontSize: 22, fontWeight: 700, margin: 0 },
    meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
    tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' },
    tab: (a) => ({ padding: '10px 18px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', borderBottom: a ? '2px solid #22c55e' : '2px solid transparent', color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer' }),
    section: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 },
    infoLabel: { fontSize: 12, color: '#94a3b8', margin: 0 },
    infoValue: { fontSize: 15, fontWeight: 600, margin: '4px 0 0' },
    divider: { border: 'none', borderTop: '1px solid #f1f5f9', margin: '20px 0' },
    feeRow: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, width: '160px' },
    inputFull: { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, width: '100%' },
    btn: (bg) => ({ padding: '10px 20px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }),
    outlineBtn: { padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    success: { color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: 8, fontSize: 13, margin: '12px 0 0' },
    error: { color: '#dc2626', fontSize: 13, margin: '8px 0 0' },
    billBox: { background: '#f8fafc', borderRadius: 10, padding: 20, border: '1px solid #e2e8f0', marginTop: 20 },
    billGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
    filterRow: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0', cursor: 'pointer' },
    td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
    generateBtn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  };

  return (
    <Layout title={customer.name}>
      <div style={s.header}>
        <div>
          <h2 style={s.name}>{customer.name}</h2>
          <p style={s.meta}>
            {customer.customer_code} · {customer.phone} · {customer.area.replace('ward-', 'Ward ')} · Registered by {customer.app_users?.full_name} ({customer.app_users?.staff_code})
          </p>
        </div>
        <StatusBadge customer={customer} lastPaymentDate={payments[0]?.payment_date} />
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        <button style={s.tab(tab === 'payments')} onClick={() => setTab('payments')}>Payment History ({payments.length})</button>
        <button style={s.tab(tab === 'feelog')} onClick={() => setTab('feelog')}>Fee Change Log</button>
      </div>

      {tab === 'profile' && (
        <div style={s.section}>
          {/* Info grid */}
          <div style={s.grid}>
            <div><p style={s.infoLabel}>Address</p><p style={s.infoValue}>{customer.address}{customer.house_number ? `, House ${customer.house_number}` : ''}</p></div>
            <div><p style={s.infoLabel}>Phone</p><p style={s.infoValue}>{customer.phone}</p></div>
            <div><p style={s.infoLabel}>Registration Date (BS)</p><p style={s.infoValue}>{toBS(customer.registration_date)}</p></div>
            <div><p style={s.infoLabel}>Payment Start Date (BS)</p><p style={s.infoValue}>{toBS(customer.payment_start_date)}</p></div>
          </div>

          <hr style={s.divider} />

          {/* Inline fee edit */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ ...s.infoLabel, marginBottom: 4 }}>Current Monthly Fee</p>
            <p style={{ fontSize: 26, fontWeight: 800, margin: '0 0 14px', color: '#0f172a' }}>Rs. {Number(customer.monthly_fee).toLocaleString()}</p>

            {!showDecreaseForm ? (
              <form style={s.feeRow} onSubmit={handleFeeUpdate}>
                <div>
                  <label style={s.label}>New Fee (Rs.)</label>
                  <input style={s.input} type="number" min="0" value={newFee} onChange={(e) => setNewFee(e.target.value)} />
                </div>
                <button style={s.btn('#22c55e')} type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Update Fee'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleDecreaseRequest}>
                <p style={{ fontSize: 13, color: '#a16207', background: '#fef9c3', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                  Decreasing fee requires admin approval. Enter a reason below.
                </p>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>Reason for decrease *</label>
                  <textarea
                    style={{ ...s.inputFull, minHeight: 72, resize: 'vertical' }}
                    value={decreaseReason}
                    onChange={(e) => setDecreaseReason(e.target.value)}
                    placeholder="e.g. Customer requested reduction due to financial hardship"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={s.btn('#22c55e')} type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
                  <button style={s.outlineBtn} type="button" onClick={() => setShowDecreaseForm(false)}>Cancel</button>
                </div>
              </form>
            )}
            {feeError && <p style={s.error}>{feeError}</p>}
            {feeSuccess && <p style={s.success}>{feeSuccess}</p>}
            {!isAdmin && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Increasing fee applies instantly. Decreasing requires admin approval.</p>}
          </div>

          <hr style={s.divider} />

          {/* Generate bill inline */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 14 }}>Generate Bill</strong>
                <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>Create an invoice for this customer</p>
              </div>
              <button style={s.generateBtn} onClick={() => setShowBillForm(!showBillForm)}>
                {showBillForm ? '✕ Cancel' : '+ Generate Bill'}
              </button>
            </div>

            {showBillForm && (
              <form style={s.billBox} onSubmit={handleGenerateBill}>
                <div style={s.billGrid}>
                  <div>
                    <label style={s.label}>Receipt / Bill No. *</label>
                    <input style={s.inputFull} value={bill.receipt_number} onChange={(e) => setBill({ ...bill, receipt_number: e.target.value })} placeholder="e.g. 00421" required />
                  </div>
                  <div>
                    <label style={s.label}>From Month (BS) *</label>
                    <input style={s.inputFull} value={bill.from_month} onChange={(e) => setBill({ ...bill, from_month: e.target.value })} placeholder="e.g. Baisakh 2083" required />
                  </div>
                  <div>
                    <label style={s.label}>To Month (BS) *</label>
                    <input style={s.inputFull} value={bill.to_month} onChange={(e) => setBill({ ...bill, to_month: e.target.value })} placeholder="e.g. Ashadh 2083" required />
                  </div>
                  <div>
                    <label style={s.label}>No. of Months *</label>
                    <input style={s.inputFull} type="number" min="1" value={bill.num_months} onChange={(e) => setBill({ ...bill, num_months: e.target.value, amount: Number(customer.monthly_fee) * Number(e.target.value) })} required />
                  </div>
                  <div>
                    <label style={s.label}>Previous Dues (Rs.)</label>
                    <input style={s.inputFull} type="number" min="0" value={bill.previous_dues} onChange={(e) => setBill({ ...bill, previous_dues: e.target.value })} />
                  </div>
                  <div>
                    <label style={s.label}>Penalty / Fine (Rs.)</label>
                    <input style={s.inputFull} type="number" min="0" value={bill.penalty} onChange={(e) => setBill({ ...bill, penalty: e.target.value })} />
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 12, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Service ({bill.num_months} month × Rs. {Number(customer.monthly_fee).toLocaleString()})</span>
                    <span>Rs. {Number(bill.amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Previous dues</span><span>Rs. {Number(bill.previous_dues).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span>Penalty</span><span>Rs. {Number(bill.penalty).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <span>Total</span>
                    <span style={{ color: '#22c55e' }}>Rs. {(Number(bill.amount) + Number(bill.previous_dues) + Number(bill.penalty)).toLocaleString()}</span>
                  </div>
                </div>
                {billError && <p style={s.error}>{billError}</p>}
                {billSuccess && <p style={s.success}>{billSuccess}</p>}
                <button style={s.btn('#0f172a')} type="submit" disabled={billSubmitting}>
                  {billSubmitting ? 'Generating...' : 'Generate Bill'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div style={s.section}>
          <div style={s.filterRow}>
            <div>
              <label style={{ ...s.label, marginBottom: 4 }}>From (AD date)</label>
              <input style={{ ...s.input, width: 150 }} type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ ...s.label, marginBottom: 4 }}>To (AD date)</label>
              <input style={{ ...s.input, width: 150 }} type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <div>
              <label style={{ ...s.label, marginBottom: 4 }}>Sort</label>
              <select style={{ ...s.input, width: 150 }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
            <button style={s.outlineBtn} onClick={() => { setFilterFrom(''); setFilterTo(''); setSortOrder('desc'); }}>Reset</button>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            Showing {filteredPayments.length} of {payments.length} payments ·
            Total: <strong>Rs. {filteredPayments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}</strong>
          </p>

          {filteredPayments.length === 0 ? <p style={{ color: '#94a3b8' }}>No payments found.</p> : (
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Amount</th>
                <th style={s.th} onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>Date (BS) {sortOrder === 'desc' ? '↓' : '↑'}</th>
                <th style={s.th}>Collected By</th>
              </tr></thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td style={s.td}>Rs. {Number(p.amount).toLocaleString()}</td>
                    <td style={s.td}>{toBS(p.payment_date)}</td>
                    <td style={s.td}>{p.app_users?.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'feelog' && (
        <div style={s.section}>
          {feeLog.length === 0 ? <p style={{ color: '#94a3b8' }}>No fee changes recorded yet.</p> : (
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Old Fee</th>
                <th style={s.th}>New Fee</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Changed By</th>
                <th style={s.th}>Date</th>
              </tr></thead>
              <tbody>
                {feeLog.map((f) => (
                  <tr key={f.id}>
                    <td style={s.td}>Rs. {Number(f.old_fee).toLocaleString()}</td>
                    <td style={s.td}>Rs. {Number(f.new_fee).toLocaleString()}</td>
                    <td style={s.td}>{f.change_type.replace(/_/g, ' ')}</td>
                    <td style={s.td}>{f.app_users?.full_name}</td>
                    <td style={s.td}>{toBS(f.created_at)}</td>
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