import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS } from '../lib/dateUtils';
import PrintBill from '../components/PrintBill';

function Billing() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [bill, setBill] = useState({
    receipt_number: '', from_month: '', to_month: '',
    num_months: 1, previous_dues: 0, penalty: 0, amount: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentBills, setRecentBills] = useState([]);
  const [settings, setSettings] = useState(null);
  const [printData, setPrintData] = useState(null); // { bill, customer, collectedBy }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: c } = await supabase
      .from('customers')
      .select('id, name, monthly_fee, area, phone, customer_code, house_number, address')
      .eq('status', 'active').order('name');
    setCustomers(c || []);

    const { data: b } = await supabase
      .from('bills')
      .select('*, customers(name, customer_code)')
      .order('created_at', { ascending: false }).limit(20);
    setRecentBills(b || []);

    const { data: sett } = await supabase.from('settings').select('*').eq('id', 1).single();
    setSettings(sett);
  }

  function selectCustomer(c) {
    setSelectedCustomer(c);
    setSearch(c.name);
    setShowDropdown(false);
    setBill((prev) => ({ ...prev, amount: c.monthly_fee, num_months: 1 }));
  }

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.customer_code || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!selectedCustomer || !bill.receipt_number || !bill.from_month || !bill.to_month) {
      setError('Please select a customer and fill all required fields.');
      return;
    }
    setSubmitting(true);

    const serviceAmount = Number(bill.amount);
    const totalAmount = serviceAmount + Number(bill.previous_dues) + Number(bill.penalty);
    const today = new Date().toISOString().slice(0, 10);
    const billNumber = `BILL-${bill.receipt_number}`;

    const { data: billData, error: billErr } = await supabase
      .from('bills')
      .insert({
        bill_number: billNumber,
        receipt_number: bill.receipt_number,
        customer_id: selectedCustomer.id,
        amount: serviceAmount,
        previous_dues: Number(bill.previous_dues),
        penalty: Number(bill.penalty),
        num_months: Number(bill.num_months),
        from_month: bill.from_month,
        to_month: bill.to_month,
        period_label: `${bill.from_month} – ${bill.to_month}`,
        paid_up_to: bill.to_month,
        generated_by: user.id,
        created_by: user.id,  // keep original column filled too
        bill_period: bill.from_month,
        bill_date: today,
        generated_date: today,
        status: 'paid',
      })
      .select()
      .single();

    if (billErr) {
      console.error('Bill insert error:', billErr);
      setError(`Failed to generate bill: ${billErr.message}`);
      setSubmitting(false);
      return;
    }

    // Auto-create payment record
    const { error: payErr } = await supabase.from('payments').insert({
      customer_id: selectedCustomer.id,
      bill_id: billData.id,
      amount: totalAmount,
      payment_date: today,
      collected_by: user.id,
    });

    if (payErr) console.error('Payment insert error:', payErr);

    // Fetch staff info for print
    const { data: staffData } = await supabase
      .from('app_users').select('full_name, staff_code').eq('id', user.id).single();

    setSubmitting(false);

    // Show print preview immediately
    setPrintData({
      bill: { ...billData, monthly_fee: selectedCustomer.monthly_fee },
      customer: selectedCustomer,
      collectedBy: staffData,
    });

    // Reset form
    setSelectedCustomer(null);
    setSearch('');
    setBill({ receipt_number: '', from_month: '', to_month: '', num_months: 1, previous_dues: 0, penalty: 0, amount: '' });
    loadData();
  }

  async function openPrintForBill(b) {
    const { data: cust } = await supabase
      .from('customers')
      .select('name, customer_code, phone, area, address, house_number, monthly_fee')
      .eq('id', b.customer_id).single();
    const { data: staff } = await supabase
      .from('app_users')
      .select('full_name, staff_code')
      .eq('id', b.generated_by || b.created_by).single();
    setPrintData({ bill: b, customer: cust, collectedBy: staff });
  }

  const total = Number(bill.amount) + Number(bill.previous_dues) + Number(bill.penalty);

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    title: { fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 20 },
    field: { marginBottom: 14, position: 'relative' },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' },
    dropItem: { padding: '10px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f8fafc' },
    selectedTag: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, marginBottom: 8 },
    clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 },
    totalBox: { background: '#f8fafc', borderRadius: 8, padding: '12px 16px', margin: '12px 0', border: '1px solid #e2e8f0' },
    totalRow: (bold) => ({ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 400, color: bold ? '#22c55e' : '#334155', marginBottom: bold ? 0 : 4 }),
    hr: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '6px 0 8px' },
    btn: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12, background: '#fee2e2', padding: '8px 12px', borderRadius: 8 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    printBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' },
  };

  return (
    <Layout title="Billing">
      {printData && (
        <PrintBill
          bill={printData.bill}
          customer={printData.customer}
          collectedBy={printData.collectedBy}
          settings={settings}
          onClose={() => setPrintData(null)}
        />
      )}

      <div style={s.layout}>
        {/* Left: form */}
        <form style={s.form} onSubmit={handleSubmit}>
          <h3 style={s.title}>Generate Bill</h3>

          {/* Customer search */}
          <div style={s.field}>
            <label style={s.label}>Customer *</label>
            {selectedCustomer ? (
              <div style={s.selectedTag}>
                <span>✓ {selectedCustomer.name} <span style={{ color: '#94a3b8' }}>({selectedCustomer.customer_code})</span></span>
                <button style={s.clearBtn} type="button"
                  onClick={() => { setSelectedCustomer(null); setSearch(''); setBill((b) => ({ ...b, amount: '' })); }}>×</button>
              </div>
            ) : (
              <>
                <input style={s.input} placeholder="Search by name, phone or customer code..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedCustomer(null); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  autoComplete="off" />
                {showDropdown && search.length > 0 && (
                  <div style={s.dropdown}>
                    {filteredCustomers.length === 0
                      ? <div style={{ padding: '10px 12px', color: '#94a3b8' }}>No customers found</div>
                      : filteredCustomers.slice(0, 8).map((c) => (
                        <div key={c.id} style={s.dropItem} onMouseDown={() => selectCustomer(c)}>
                          <strong>{c.name}</strong>
                          <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>
                            {c.customer_code} · {c.phone} · {c.area.replace('ward-', 'Ward ')}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Receipt number */}
          <div style={s.field}>
            <label style={s.label}>Receipt / Bill No. *</label>
            <input style={s.input} value={bill.receipt_number}
              onChange={(e) => setBill({ ...bill, receipt_number: e.target.value })}
              placeholder="e.g. 00421" required />
          </div>

          {/* Month range + count */}
          <div style={s.grid3}>
            <div>
              <label style={s.label}>From Month *</label>
              <input style={s.input} value={bill.from_month}
                onChange={(e) => setBill({ ...bill, from_month: e.target.value })}
                placeholder="e.g. Baisakh 2083" required />
            </div>
            <div>
              <label style={s.label}>To Month *</label>
              <input style={s.input} value={bill.to_month}
                onChange={(e) => setBill({ ...bill, to_month: e.target.value })}
                placeholder="e.g. Ashadh 2083" required />
            </div>
            <div>
              <label style={s.label}>No. of Months</label>
              <input style={s.input} type="number" min="1" value={bill.num_months}
                onChange={(e) => {
                  const months = Number(e.target.value);
                  setBill({ ...bill, num_months: months, amount: selectedCustomer ? Number(selectedCustomer.monthly_fee) * months : bill.amount });
                }} />
            </div>
          </div>

          {/* Dues + penalty */}
          <div style={s.grid2}>
            <div>
              <label style={s.label}>Previous Dues (Rs.)</label>
              <input style={s.input} type="number" min="0" value={bill.previous_dues}
                onChange={(e) => setBill({ ...bill, previous_dues: e.target.value })} />
            </div>
            <div>
              <label style={s.label}>Penalty / Fine (Rs.)</label>
              <input style={s.input} type="number" min="0" value={bill.penalty}
                onChange={(e) => setBill({ ...bill, penalty: e.target.value })} />
            </div>
          </div>

          {/* Live total */}
          {selectedCustomer && (
            <div style={s.totalBox}>
              <div style={s.totalRow(false)}>
                <span>Service ({bill.num_months} mo × Rs. {Number(selectedCustomer.monthly_fee).toLocaleString()})</span>
                <span>Rs. {Number(bill.amount).toLocaleString()}</span>
              </div>
              <div style={s.totalRow(false)}><span>Previous dues</span><span>Rs. {Number(bill.previous_dues).toLocaleString()}</span></div>
              <div style={s.totalRow(false)}><span>Penalty</span><span>Rs. {Number(bill.penalty).toLocaleString()}</span></div>
              <hr style={s.hr} />
              <div style={s.totalRow(true)}><span>Total Amount Due</span><span>Rs. {total.toLocaleString()}</span></div>
            </div>
          )}

          {error && <p style={s.error}>{error}</p>}
          <button style={s.btn} type="submit" disabled={submitting || !selectedCustomer}>
            {submitting ? 'Generating...' : 'Generate Bill & Print'}
          </button>
        </form>

        {/* Right: recent bills */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Recent Bills</h3>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Bill No.</th>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Period</th>
                <th style={s.th}>Amount</th>
                <th style={s.th}>Date (BS)</th>
                <th style={s.th}>Print</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.length === 0
                ? <tr><td colSpan={6} style={{ ...s.td, color: '#94a3b8' }}>No bills yet.</td></tr>
                : recentBills.map((b) => (
                  <tr key={b.id}>
                    <td style={s.td}>{b.bill_number}</td>
                    <td style={s.td}>{b.customers?.name}</td>
                    <td style={s.td}>{b.period_label || b.from_month}</td>
                    <td style={s.td}>Rs. {Number(b.amount).toLocaleString()}</td>
                    <td style={s.td}>{toBS(b.generated_date || b.bill_date)}</td>
                    <td style={s.td}>
                      <button style={s.printBtn} onClick={() => openPrintForBill(b)}>🖨 Print</button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(Billing);