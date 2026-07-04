import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import BSDatePicker from '../../components/BSDatePicker';
import BSMonthPicker, { yyyymmToLabel, calcMonthsBetween } from '../../components/BSMonthPicker';
import PrintBill from '../../components/PrintBill';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS, toBSMonth, yyyymmToLabel as dateYYYYMMToLabel, monthsOverdueFromYM } from '../../lib/dateUtils';

function CustomerDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAdmin } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [feeLog, setFeeLog] = useState([]);
  const [settings, setSettings] = useState(null);
  const [lastBill, setLastBill] = useState(null);
  const [tab, setTab] = useState('profile');

  // Fee state
  const [newFee, setNewFee] = useState('');
  const [decreaseReason, setDecreaseReason] = useState('');
  const [showDecreaseForm, setShowDecreaseForm] = useState(false);
  const [feeError, setFeeError] = useState('');
  const [feeSuccess, setFeeSuccess] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // Bill modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [bill, setBill] = useState({ receipt_number: '', from_ym: '', to_ym: '' });
  const [billError, setBillError] = useState('');
  const [billSubmitting, setBillSubmitting] = useState(false);
  const [printData, setPrintData] = useState(null);

  // Payment filter
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterFromYM, setFilterFromYM] = useState('');

  useEffect(() => { if (id && user) loadData(); }, [id, user]);

  async function loadData() {
    const { data: c } = await supabase
      .from('customers').select('*, app_users(full_name, staff_code)').eq('id', id).single();
    setCustomer(c);
    if (c) setNewFee(c.monthly_fee);

    const { data: p } = await supabase
      .from('payments').select('*, app_users(full_name)').eq('customer_id', id).order('payment_date', { ascending: false });
    setPayments(p || []);

    const { data: f } = await supabase
      .from('fee_change_log').select('*, app_users(full_name)').eq('customer_id', id).order('created_at', { ascending: false });
    setFeeLog(f || []);

    // Get last bill for paid_up_to
    const { data: bills } = await supabase
      .from('bills').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
    setLastBill(bills?.[0] || null);

    const { data: sett } = await supabase.from('settings').select('*').eq('id', 1).single();
    setSettings(sett);
  }

  // Payment filter — convert YYYY/MM filter to AD for comparison
  const filteredPayments = payments
    .filter((p) => {
      if (!filterFromYM) return true;
      const filterAD = new Date(`${filterFromYM.split('/')[0]}-${filterFromYM.split('/')[1]}-01`);
      return new Date(p.payment_date) >= filterAD;
    })
    .sort((a, b) => sortOrder === 'desc'
      ? new Date(b.payment_date) - new Date(a.payment_date)
      : new Date(a.payment_date) - new Date(b.payment_date));
  const paymentsTotal = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Payment summary calculations
  const paidUpToYM = lastBill?.paid_up_to?.length <= 7 ? lastBill.paid_up_to : null;
  const lastPaymentDateYM = payments[0] ? toBSMonth(payments[0].payment_date) : null;
  const overdue = paidUpToYM ? monthsOverdueFromYM(paidUpToYM) : null;

  async function handleFeeUpdate(e) {
    e.preventDefault();
    setFeeError(''); setFeeSuccess('');
    const fee = Number(newFee);
    if (fee === Number(customer.monthly_fee)) { setFeeError('New fee is the same as current fee.'); return; }
    if (fee > Number(customer.monthly_fee) || isAdmin) {
      setFeeSubmitting(true);
      await supabase.from('customers').update({ monthly_fee: fee }).eq('id', customer.id);
      await supabase.from('fee_change_log').insert({ customer_id: customer.id, changed_by: user.id, old_fee: customer.monthly_fee, new_fee: fee, change_type: fee > Number(customer.monthly_fee) ? 'instant_increase' : 'instant_decrease_admin' });
      setFeeSubmitting(false);
      setFeeSuccess('Fee updated successfully.');
      loadData();
    } else { setShowDecreaseForm(true); }
  }

  async function handleDecreaseRequest(e) {
    e.preventDefault();
    setFeeError('');
    if (!decreaseReason.trim()) { setFeeError('Please enter a reason.'); return; }
    setFeeSubmitting(true);
    const { error } = await supabase.from('fee_requests').insert({ customer_id: customer.id, requested_by: user.id, current_fee: customer.monthly_fee, requested_fee: Number(newFee), reason: decreaseReason });
    setFeeSubmitting(false);
    if (error) { setFeeError(error.message); return; }
    setFeeSuccess('Decrease request submitted. Awaiting admin approval.');
    setShowDecreaseForm(false); setDecreaseReason('');
  }

  const numMonths = calcMonthsBetween(bill.from_ym, bill.to_ym);
  const serviceAmount = customer ? Number(customer.monthly_fee) * numMonths : 0;

  async function handleGenerateBill(e) {
    e.preventDefault();
    setBillError('');
    if (!bill.receipt_number || !bill.from_ym || !bill.to_ym) { setBillError('Please fill all required fields.'); return; }
    if (numMonths < 1) { setBillError('Payment Upto must be same or later than Payment From.'); return; }
    setBillSubmitting(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data: billData, error: billErr } = await supabase.from('bills').insert({
      bill_number: `BILL-${bill.receipt_number}`,
      receipt_number: bill.receipt_number,
      customer_id: customer.id,
      amount: serviceAmount,
      num_months: numMonths,
      from_month: bill.from_ym,
      to_month: bill.to_ym,
      period_label: `${yyyymmToLabel(bill.from_ym)} – ${yyyymmToLabel(bill.to_ym)}`,
      paid_up_to: bill.to_ym,
      generated_by: user.id,
      generated_date: today,
      status: 'paid',
    }).select().single();

    if (billErr) { setBillError(`Failed: ${billErr.message}`); setBillSubmitting(false); return; }

    await supabase.from('payments').insert({ customer_id: customer.id, bill_id: billData.id, amount: serviceAmount, payment_date: today, collected_by: user.id });

    const { data: staffData } = await supabase.from('app_users').select('full_name, staff_code').eq('id', user.id).single();
    setBillSubmitting(false);
    setShowBillModal(false);
    setPrintData({ bill: { ...billData, monthly_fee: customer.monthly_fee }, customer, collectedBy: staffData });
    setBill({ receipt_number: '', from_ym: '', to_ym: '' });
    loadData();
  }

  if (!customer) return <Layout title="Customer"><p style={{ color: '#94a3b8' }}>Loading...</p></Layout>;

  const s = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    name: { fontSize: 22, fontWeight: 700, margin: 0 },
    meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
    tabs: { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e2e8f0' },
    tab: (a) => ({ padding: '10px 18px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', borderBottom: a ? '2px solid #22c55e' : '2px solid transparent', color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer' }),
    section: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 },
    infoLabel: { fontSize: 12, color: '#94a3b8', margin: 0 },
    infoValue: { fontSize: 15, fontWeight: 600, margin: '4px 0 0' },
    divider: { border: 'none', borderTop: '1px solid #f1f5f9', margin: '20px 0' },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    inputFull: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    btn: (bg) => ({ padding: '10px 20px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }),
    outlineBtn: { padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    success: { color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: 8, fontSize: 13, margin: '12px 0 0' },
    error: { color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: 8, fontSize: 13, margin: '8px 0 0' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modal: { background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 16, fontWeight: 700, margin: 0 },
    closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
    summaryBox: { background: '#f8fafc', borderRadius: 8, padding: '12px 16px', margin: '12px 0', border: '1px solid #e2e8f0' },
    summaryRow: (bold) => ({ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 400, color: bold ? '#22c55e' : '#334155', marginBottom: bold ? 0 : 4 }),
    hr: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '6px 0 8px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
    th: { textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0', cursor: 'pointer' },
    td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  };

  const overdueColor = overdue === null ? '#64748b' : overdue <= 3 ? '#15803d' : overdue <= 6 ? '#a16207' : '#b91c1c';
  const overdueBg = overdue === null ? '#f8fafc' : overdue <= 3 ? '#dcfce7' : overdue <= 6 ? '#fef9c3' : '#fee2e2';

  return (
    <Layout title={customer.name}>
      {printData && <PrintBill bill={printData.bill} customer={printData.customer} collectedBy={printData.collectedBy} settings={settings} onClose={() => setPrintData(null)} />}

      {/* Bill modal */}
      {showBillModal && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setShowBillModal(false); }}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Generate Bill — {customer.name}</h3>
              <button style={s.closeBtn} onClick={() => setShowBillModal(false)}>×</button>
            </div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <strong>{customer.name}</strong> · {customer.customer_code} · {customer.area.replace('ward-', 'Ward ')}
              <br />Current fee: <strong>Rs. {Number(customer.monthly_fee).toLocaleString()}/month</strong>
              {paidUpToYM && <><br />Last paid up to: <strong>{yyyymmToLabel(paidUpToYM)}</strong></>}
            </div>
            <form onSubmit={handleGenerateBill}>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>Receipt / Bill No. *</label>
                <input style={s.inputFull} value={bill.receipt_number} onChange={(e) => setBill({ ...bill, receipt_number: e.target.value })} placeholder="e.g. 00421" required />
              </div>
              <div style={{ marginBottom: 14 }}>
                <BSMonthPicker label="Payment From (BS)" required value={bill.from_ym} onChange={(val) => setBill({ ...bill, from_ym: val })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <BSMonthPicker label="Payment Upto (BS)" required value={bill.to_ym} onChange={(val) => setBill({ ...bill, to_ym: val })} />
              </div>

              {bill.from_ym && bill.to_ym && numMonths >= 1 && (
                <div style={s.summaryBox}>
                  <div style={s.summaryRow(false)}><span>Period</span><span>{yyyymmToLabel(bill.from_ym)} → {yyyymmToLabel(bill.to_ym)}</span></div>
                  <div style={s.summaryRow(false)}><span>Months</span><span>{numMonths}</span></div>
                  <div style={s.summaryRow(false)}><span>Rate</span><span>Rs. {Number(customer.monthly_fee).toLocaleString()}/mo</span></div>
                  <hr style={s.hr} />
                  <div style={s.summaryRow(true)}><span>Total Amount Due</span><span>Rs. {serviceAmount.toLocaleString()}</span></div>
                </div>
              )}

              {billError && <p style={s.error}>{billError}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...s.btn('#22c55e'), flex: 1 }} type="submit" disabled={billSubmitting}>
                  {billSubmitting ? 'Generating...' : 'Generate Bill & Print'}
                </button>
                <button style={s.outlineBtn} type="button" onClick={() => setShowBillModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={s.header}>
        <div>
          <h2 style={s.name}>{customer.name}</h2>
          <p style={s.meta}>{customer.customer_code} · {customer.phone} · {customer.area.replace('ward-', 'Ward ')} · Registered by {customer.app_users?.full_name} ({customer.app_users?.staff_code})</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={s.btn('#0f172a')} onClick={() => setShowBillModal(true)}>+ Generate Bill</button>
          <StatusBadge customer={customer} lastPaymentDate={payments[0]?.payment_date} paidUpToYM={paidUpToYM} />
        </div>
      </div>

      {/* Payment summary block */}
      <div style={{ ...s.grid3, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
          <p style={s.infoLabel}>Paid Up To</p>
          <p style={{ ...s.infoValue, color: '#15803d', fontSize: 17 }}>
            {paidUpToYM ? yyyymmToLabel(paidUpToYM) : '—'}
          </p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
          <p style={s.infoLabel}>Last Payment</p>
          <p style={{ ...s.infoValue, fontSize: 17 }}>
            {lastPaymentDateYM ? yyyymmToLabel(lastPaymentDateYM) : '—'}
          </p>
        </div>
        <div style={{ background: overdueBg, borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
          <p style={{ ...s.infoLabel, color: overdueColor }}>
            {overdue === null ? 'Status' : overdue <= 0 ? 'Status' : 'Months Overdue'}
          </p>
          <p style={{ ...s.infoValue, color: overdueColor, fontSize: 17 }}>
            {overdue === null ? 'No bills yet'
              : overdue <= 0 ? '✓ Up to date'
              : `${overdue} month${overdue !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        <button style={s.tab(tab === 'payments')} onClick={() => setTab('payments')}>Payment History ({payments.length})</button>
        <button style={s.tab(tab === 'feelog')} onClick={() => setTab('feelog')}>Fee Change Log</button>
      </div>

      {/* PROFILE TAB */}
      {tab === 'profile' && (
        <div style={s.section}>
          <div style={s.grid}>
            <div><p style={s.infoLabel}>Address</p><p style={s.infoValue}>{customer.address}{customer.house_number ? `, House ${customer.house_number}` : ''}</p></div>
            <div><p style={s.infoLabel}>Phone</p><p style={s.infoValue}>{customer.phone}</p></div>
            <div><p style={s.infoLabel}>Registration Date (BS)</p><p style={s.infoValue}>{toBS(customer.registration_date)}</p></div>
            <div><p style={s.infoLabel}>Payment Start Month (BS)</p><p style={s.infoValue}>{toBSMonth(customer.payment_start_date)}</p></div>
          </div>

          <hr style={s.divider} />

          <p style={s.infoLabel}>Current Monthly Fee</p>
          <p style={{ fontSize: 26, fontWeight: 800, margin: '0 0 14px', color: '#0f172a' }}>Rs. {Number(customer.monthly_fee).toLocaleString()}</p>

          {!showDecreaseForm ? (
            <form style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={handleFeeUpdate}>
              <div>
                <label style={s.label}>New Fee (Rs.)</label>
                <input style={{ ...s.input, width: 150 }} type="number" min="0" value={newFee} onChange={(e) => setNewFee(e.target.value)} />
              </div>
              <button style={s.btn('#22c55e')} type="submit" disabled={feeSubmitting}>{feeSubmitting ? 'Saving...' : 'Update Fee'}</button>
            </form>
          ) : (
            <form onSubmit={handleDecreaseRequest}>
              <p style={{ fontSize: 13, color: '#a16207', background: '#fef9c3', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>Decreasing fee requires admin approval.</p>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>Reason *</label>
                <textarea style={{ ...s.inputFull, minHeight: 72, resize: 'vertical' }} value={decreaseReason} onChange={(e) => setDecreaseReason(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.btn('#22c55e')} type="submit" disabled={feeSubmitting}>{feeSubmitting ? 'Submitting...' : 'Submit Request'}</button>
                <button style={s.outlineBtn} type="button" onClick={() => setShowDecreaseForm(false)}>Cancel</button>
              </div>
            </form>
          )}
          {feeError && <p style={s.error}>{feeError}</p>}
          {feeSuccess && <p style={s.success}>{feeSuccess}</p>}
          {!isAdmin && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Increasing fee applies instantly. Decreasing requires admin approval.</p>}
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div style={s.section}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <BSMonthPicker label="Show payments from (BS)" value={filterFromYM} onChange={setFilterFromYM} />
            </div>
            <div>
              <label style={s.label}>Sort</label>
              <select style={s.input} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </div>
            {filterFromYM && <button style={{ ...s.outlineBtn, alignSelf: 'flex-end' }} onClick={() => setFilterFromYM('')}>✕ Reset</button>}
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {filteredPayments.length} of {payments.length} · Total: <strong style={{ color: '#22c55e' }}>Rs. {paymentsTotal.toLocaleString()}</strong>
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

      {/* FEE LOG TAB */}
      {tab === 'feelog' && (
        <div style={s.section}>
          {feeLog.length === 0 ? <p style={{ color: '#94a3b8' }}>No fee changes recorded yet.</p> : (
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>Old Fee</th><th style={s.th}>New Fee</th>
                <th style={s.th}>Type</th><th style={s.th}>Changed By</th><th style={s.th}>Date</th>
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