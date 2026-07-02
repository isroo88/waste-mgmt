import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth, useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function FeeRequests() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [requestedFee, setRequestedFee] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    // All active customers — any staff can request for any customer
    const { data: custData } = await supabase
      .from('customers')
      .select('id, name, monthly_fee, customer_code, area')
      .eq('status', 'active')
      .order('name');
    setCustomers(custData || []);

    // Requests — staff sees own, admin sees all
    let q = supabase
      .from('fee_requests')
      .select('*, customers(name, customer_code), app_users!fee_requests_requested_by_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (!isAdmin) q = q.eq('requested_by', user.id);
    const { data: reqData } = await q;
    setRequests(reqData || []);
  }

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_code || '').toLowerCase().includes(search.toLowerCase())
  );

  function selectCustomer(c) {
    setSelectedCustomer(c);
    setSearch(c.name);
    setShowDropdown(false);
    setRequestedFee('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedCustomer) { setError('Please select a customer.'); return; }
    if (!requestedFee || !reason) { setError('Please fill all fields.'); return; }
    if (Number(requestedFee) >= Number(selectedCustomer.monthly_fee)) {
      setError(`Requested fee must be lower than current fee (Rs. ${selectedCustomer.monthly_fee}). Use the customer profile to increase fees directly.`);
      return;
    }
    setSubmitting(true);
    const { error: insertError } = await supabase.from('fee_requests').insert({
      customer_id: selectedCustomer.id,
      requested_by: user.id,
      current_fee: selectedCustomer.monthly_fee,
      requested_fee: Number(requestedFee),
      reason,
    });
    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    setSuccess(`Decrease request submitted for ${selectedCustomer.name}. Awaiting admin approval.`);
    setSelectedCustomer(null);
    setSearch('');
    setRequestedFee('');
    setReason('');
    loadData();
  }

  async function handleReview(request, approve) {
    const newStatus = approve ? 'approved' : 'rejected';
    await supabase.from('fee_requests')
      .update({ status: newStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq('id', request.id);

    if (approve) {
      await supabase.from('customers')
        .update({ monthly_fee: request.requested_fee })
        .eq('id', request.customer_id);
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

  const s = {
    layout: { display: 'grid', gridTemplateColumns: !isAdmin ? '380px 1fr' : '1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    title: { fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 4 },
    subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 0, marginBottom: 20 },
    field: { marginBottom: 16, position: 'relative' },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' },
    dropItem: { padding: '10px 12px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f8fafc' },
    selectedTag: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, marginBottom: 8 },
    clearBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18 },
    feeHint: { fontSize: 12, color: '#64748b', marginTop: 4 },
    btn: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12, background: '#fee2e2', padding: '8px 12px', borderRadius: 8 },
    success: { color: '#15803d', fontSize: 13, marginBottom: 12, background: '#dcfce7', padding: '8px 12px', borderRadius: 8 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    pill: (status) => ({
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: status === 'approved' ? '#dcfce7' : status === 'rejected' ? '#fee2e2' : '#fef9c3',
      color: status === 'approved' ? '#15803d' : status === 'rejected' ? '#b91c1c' : '#a16207',
    }),
    actionBtn: (bg) => ({ padding: '6px 14px', borderRadius: 6, border: 'none', background: bg, color: '#fff', fontSize: 12, fontWeight: 600, marginRight: 8, cursor: 'pointer' }),
  };

  return (
    <Layout title="Fee Decrease Requests">
      <div style={s.layout}>
        {!isAdmin && (
          <form style={s.form} onSubmit={handleSubmit}>
            <h3 style={s.title}>Request a Fee Decrease</h3>
            <p style={s.subtitle}>For any active customer — requires admin approval.</p>

            <div style={s.field}>
              <label style={s.label}>Customer *</label>
              {selectedCustomer ? (
                <div style={s.selectedTag}>
                  <span>✓ {selectedCustomer.name} <span style={{ color: '#94a3b8' }}>({selectedCustomer.customer_code})</span></span>
                  <button style={s.clearBtn} type="button" onClick={() => { setSelectedCustomer(null); setSearch(''); setRequestedFee(''); }}>×</button>
                </div>
              ) : (
                <>
                  <input
                    style={s.input}
                    placeholder="Search by name or customer code..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedCustomer(null); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    autoComplete="off"
                  />
                  {showDropdown && search.length > 0 && (
                    <div style={s.dropdown}>
                      {filteredCustomers.length === 0
                        ? <div style={{ padding: '10px 12px', color: '#94a3b8' }}>No customers found</div>
                        : filteredCustomers.slice(0, 8).map((c) => (
                          <div key={c.id} style={s.dropItem} onMouseDown={() => selectCustomer(c)}>
                            <strong>{c.name}</strong>
                            <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>
                              {c.customer_code} · Current: Rs. {Number(c.monthly_fee).toLocaleString()} · {c.area.replace('ward-', 'Ward ')}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Requested New Fee (Rs.) *</label>
              <input
                style={s.input}
                type="number" min="0"
                value={requestedFee}
                onChange={(e) => setRequestedFee(e.target.value)}
                placeholder="Enter lower amount"
                required
              />
              {selectedCustomer && (
                <p style={s.feeHint}>
                  Current fee: <strong>Rs. {Number(selectedCustomer.monthly_fee).toLocaleString()}</strong>
                  {requestedFee && Number(requestedFee) < Number(selectedCustomer.monthly_fee) && (
                    <span style={{ color: '#22c55e' }}> → Rs. {Number(requestedFee).toLocaleString()} (saving Rs. {(Number(selectedCustomer.monthly_fee) - Number(requestedFee)).toLocaleString()})</span>
                  )}
                </p>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Reason *</label>
              <textarea style={s.textarea} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer requested reduction due to financial hardship" required />
            </div>

            {error && <p style={s.error}>{error}</p>}
            {success && <p style={s.success}>{success}</p>}
            <button style={s.btn} type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        )}

        {/* Requests table */}
        <div>
          {isAdmin && (success || error) && (
            <div style={{ marginBottom: 16 }}>
              {error && <p style={s.error}>{error}</p>}
              {success && <p style={s.success}>{success}</p>}
            </div>
          )}
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Current Fee</th>
                <th style={s.th}>Requested Fee</th>
                <th style={s.th}>Savings</th>
                <th style={s.th}>Reason</th>
                {isAdmin && <th style={s.th}>Requested By</th>}
                <th style={s.th}>Status</th>
                {isAdmin && <th style={s.th}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={8} style={{ ...s.td, color: '#94a3b8', textAlign: 'center' }}>No requests yet.</td></tr>
              ) : requests.map((r) => (
                <tr key={r.id}>
                  <td style={s.td}>
                    <strong>{r.customers?.name}</strong>
                    <br /><span style={{ fontSize: 11, color: '#94a3b8' }}>{r.customers?.customer_code}</span>
                  </td>
                  <td style={s.td}>Rs. {Number(r.current_fee).toLocaleString()}</td>
                  <td style={s.td}>Rs. {Number(r.requested_fee).toLocaleString()}</td>
                  <td style={s.td}>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>
                      Rs. {(Number(r.current_fee) - Number(r.requested_fee)).toLocaleString()}
                    </span>
                  </td>
                  <td style={{ ...s.td, maxWidth: 200, fontSize: 12 }}>{r.reason}</td>
                  {isAdmin && <td style={s.td}>{r.app_users?.full_name}</td>}
                  <td style={s.td}><span style={s.pill(r.status)}>{r.status}</span></td>
                  {isAdmin && (
                    <td style={s.td}>
                      {r.status === 'pending' ? (
                        <>
                          <button style={s.actionBtn('#22c55e')} onClick={() => handleReview(r, true)}>Approve</button>
                          <button style={s.actionBtn('#ef4444')} onClick={() => handleReview(r, false)}>Reject</button>
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