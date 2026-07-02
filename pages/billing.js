import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toBS } from '../lib/dateUtils';

function Billing() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [bill, setBill] = useState({ receipt_number: '', from_month: '', to_month: '', num_months: 1, previous_dues: 0, penalty: 0, amount: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentBills, setRecentBills] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: c } = await supabase
      .from('customers')
      .select('id, name, monthly_fee, area, phone, customer_code')
      .eq('status', 'active')
      .order('name');
    setCustomers(c || []);

    const { data: b } = await supabase
      .from('bills')
      .select('*, customers(name, customer_code)')
      .order('created_at', { ascending: false })
      .limit(20);
    setRecentBills(b || []);
  }

  function selectCustomer(c) {
    setSelectedCustomer(c);
    setSearch(c.name);
    setShowDropdown(false);
    setBill((b) => ({ ...b, amount: c.monthly_fee, num_months: 1 }));
  }

  function handleSearchChange(val) {
    setSearch(val);
    setSelectedCustomer(null);
    setShowDropdown(true);
  }

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.customer_code || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedCustomer || !bill.receipt_number || !bill.from_month || !bill.to_month) {
      setError('Please select a customer and fill all required fields.');
      return;
    }
    setSubmitting(true);

    const total = Number(bill.amount) + Number(bill.previous_dues) + Number(bill.penalty);
    const today = new Date().toISOString().slice(0, 10);

    // Insert bill — marked paid immediately
    const { data: billData, error: billErr } = await supabase
      .from('bills')
      .insert({
        bill_number: `BILL-${bill.receipt_number}`,
        receipt_number: bill.receipt_number,
        customer_id: selectedCustomer.id,
        amount: Number(bill.amount),
        previous_dues: Number(bill.previous_dues),
        penalty: Number(bill.penalty),
        num_months: Number(bill.num_months),
        from_month: bill.from_month,
        to_month: bill.to_month,
        period_label: `${bill.from_month} – ${bill.to_month}`,
        paid_up_to: bill.to_month,
        generated_by: user.id,
        generated_date: today,
        status: 'paid', // auto-paid on generation
      })
      .select()
      .single();

    if (billErr) { setError(billErr.message); setSubmitting(false); return; }

    // Auto-create payment record
    await supabase.from('payments').insert({
      customer_id: selectedCustomer.id,
      bill_id: billData.id,
      amount: total,
      payment_date: today,
      collected_by: user.id,
    });

    setSubmitting(false);
    setSuccess(`Bill BILL-${bill.receipt_number} generated and payment recorded.`);
    setSelectedCustomer(null);
    setSearch('');
    setBill({ receipt_number: '', from_month: '', to_month: '', num_months: 1, previous_dues: 0, penalty: 0, amount: '' });
    loadData();
  }

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    title: { fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 20 },
    field: { marginBottom: 14, position: 'relative' },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' },
    dropItem: { padding: '10px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f8fafc' },
    selectedTag: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, marginBottom: 8 },
    clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 },
    totalBox: { background: '#f8fafc', borderRadius: 8, padding: '12px 16px', margin: '12px 0', border: '1px solid #e2e8f0' },
    totalRow: (bold) => ({ display: 'flex', justifyContent: 'space-between', fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 400, color: bold ? '#22c55e' : '#334155', marginBottom: bold ? 0 : 4 }),
    divider: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '6px 0 8px' },
    btn: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
    success: { color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
  };

  const total = Number(bill.amount) + Number(bill.previous_dues) + Number(bill.penalty);

  return (
    <Layout title="Billing">
      <div style={s.layout}>

        {/* Left: Bill generation form */}
        <form style={s.form} onSubmit={handleSubmit}>
          <h3 style={s.title}>Generate Bill</h3>

          {/* Customer search */}
          <div style={s.field}>
            <label style={s.label}>Customer *</label>
            {selectedCustomer ? (
              <div style={s.selectedTag}>
                <span>✓ {selectedCustomer.name} <span style={{ color: '#94a3b8' }}>({selectedCustomer.customer_code})</span></span>
                <button style={s.clearBtn} type="button" onClick={() => { setSelectedCustomer(null); setSearch(''); setBill((b) => ({ ...b, amount: '' })); }}>×</button>
              </div>
            ) : (
              <>
                <input
                  style={s.input}
                  placeholder="Search by name, phone or customer code..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  autoComplete="off"
                />
                {showDropdown && search.length > 0 && (
                  <div style={s.dropdown}>
                    {filteredCustomers.length === 0
                      ? <div style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 14 }}>No customers found</div>
                      : filteredCustomers.slice(0, 8).map((c) => (
                        <div key={c.id} style={s.dropItem} onMouseDown={() => selectCustomer(c)}>
                          <strong>{c.name}</strong>
                          <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>{c.customer_code} · {c.phone} · {c.area.replace('ward-', 'Ward ')}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* Receipt number */}
          <div style={s.field}>
            <label style={s.label}>Receipt / Bill No. *</label>
            <input style={s.input} value={bill.receipt_number} onChange={(e) => setBill({ ...bill, receipt_number: e.target.value })} placeholder="e.g. 00421" required />
          </div>

          {/* Month range */}
          <div style={{ ...s.grid3, marginBottom: 14 }}>
            <div>
              <label style={s.label}>From Month *</label>
              <input style={s.input} value={bill.from_month} onChange={(e) => setBill({ ...bill, from_month: e.target.value })} placeholder="e.g. Baisakh 2083" required />
            </div>
            <div>
              <label style={s.label}>To Month *</label>
              <input style={s.input} value={bill.to_month} onChange={(e) => setBill({ ...bill, to_month: e.target.value })} placeholder="e.g. Ashadh 2083" required />
            </div>
            <div>
              <label style={s.label}>Months</label>
              <input
                style={s.input}
                type="number"
                min="1"
                value={bill.num_months}
                onChange={(e) => setBill({ ...bill, num_months: e.target.value, amount: selectedCustomer ? Number(selectedCustomer.monthly_fee) * Number(e.target.value) : '' })}
              />
            </div>
          </div>

          {/* Dues and penalty */}
          <div style={{ ...s.grid2, marginBottom: 14 }}>
            <div>
              <label style={s.label}>Previous Dues (Rs.)</label>
              <input style={s.input} type="number" min="0" value={bill.previous_dues} onChange={(e) => setBill({ ...bill, previous_dues: e.target.value })} />
            </div>
            <div>
              <label style={s.label}>Penalty / Fine (Rs.)</label>
              <input style={s.input} type="number" min="0" value={bill.penalty} onChange={(e) => setBill({ ...bill, penalty: e.target.value })} />
            </div>
          </div>

          {/* Live total */}
          {selectedCustomer && (
            <div style={s.totalBox}>
              <div style={s.totalRow(false)}><span>Service ({bill.num_months} mo × Rs. {Number(selectedCustomer.monthly_fee).toLocaleString()})</span><span>Rs. {Number(bill.amount).toLocaleString()}</span></div>
              <div style={s.totalRow(false)}><span>Previous dues</span><span>Rs. {Number(bill.previous_dues).toLocaleString()}</span></div>
              <div style={s.totalRow(false)}><span>Penalty</span><span>Rs. {Number(bill.penalty).toLocaleString()}</span></div>
              <hr style={s.divider} />
              <div style={s.totalRow(true)}><span>Total Amount Due</span><span>Rs. {total.toLocaleString()}</span></div>
            </div>
          )}

          {error && <p style={s.error}>{error}</p>}
          {success && <p style={s.success}>{success}</p>}
          <button style={s.btn} type="submit" disabled={submitting || !selectedCustomer}>
            {submitting ? 'Generating...' : 'Generate Bill & Record Payment'}
          </button>
        </form>

        {/* Right: Recent bills table */}
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
              </tr>
            </thead>
            <tbody>
              {recentBills.length === 0
                ? <tr><td colSpan={5} style={{ ...s.td, color: '#94a3b8' }}>No bills yet.</td></tr>
                : recentBills.map((b) => (
                  <tr key={b.id}>
                    <td style={s.td}>{b.bill_number}</td>
                    <td style={s.td}>{b.customers?.name}</td>
                    <td style={s.td}>{b.period_label || b.from_month}</td>
                    <td style={s.td}>Rs. {Number(b.amount).toLocaleString()}</td>
                    <td style={s.td}>{toBS(b.generated_date)}</td>
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