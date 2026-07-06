import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import BSDatePicker from '../../components/BSDatePicker';
import BSMonthPicker from '../../components/BSMonthPicker';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { bsToAD, AREAS } from '../../lib/dateUtils';

function RegisterCustomer() {
  const { user } = useAuth();
  const router = useRouter();
  const [type, setType] = useState('individual'); // 'individual' or 'business'
  const [form, setForm] = useState({
    name: '', business_name: '', phone: '', address: '',
    area: 'ward-10', house_number: '', pan_number: '',
    monthly_fee: '', registration_date_bs: '', payment_start_ym: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  function switchType(t) {
    setType(t);
    setError('');
    setForm({ name: '', business_name: '', phone: '', address: '', area: 'ward-10', house_number: '', pan_number: '', monthly_fee: '', registration_date_bs: '', payment_start_ym: '' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const displayName = type === 'business' ? form.business_name : form.name;
    if (!displayName || !form.phone || !form.address || !form.monthly_fee) {
      setError('Please fill all required fields.'); return;
    }
    if (!form.registration_date_bs || !form.payment_start_ym) {
      setError('Please select registration date and payment start month.'); return;
    }
    const regAD = bsToAD(form.registration_date_bs);
    const payAD = bsToAD(`${form.payment_start_ym}/01`);
    if (!regAD || !payAD) { setError('Invalid date selected.'); return; }

    setSubmitting(true);
    const { error: err } = await supabase.from('customers').insert({
      name: displayName,
      business_name: type === 'business' ? form.business_name : null,
      phone: form.phone,
      address: form.address,
      area: form.area,
      house_number: type === 'individual' ? (form.house_number || null) : null,
      pan_number: type === 'business' ? (form.pan_number || null) : null,
      monthly_fee: Number(form.monthly_fee),
      registration_date: regAD.toISOString().slice(0, 10),
      payment_start_date: payAD.toISOString().slice(0, 10),
      registered_by: user.id,
      customer_type: type,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    // Redirect to appropriate list after registration
    router.push(type === 'business' ? '/businesses' : '/customers');
  }

  const s = {
    typeTabs: { display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' },
    typeTab: (active) => ({
      padding: '10px 28px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600,
      background: active ? '#fff' : 'transparent',
      color: active ? '#0f172a' : '#64748b',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
      cursor: 'pointer', transition: 'all 0.15s',
    }),
    form: { background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e2e8f0', maxWidth: 620 },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    btn: { padding: '12px 28px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 16, background: '#fee2e2', padding: '8px 12px', borderRadius: 8 },
    hint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
    bizNote: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1d4ed8' },
  };

  return (
    <Layout title="Register Customer">
      {/* Type selector */}
      <div style={s.typeTabs}>
        <button style={s.typeTab(type === 'individual')} type="button" onClick={() => switchType('individual')}>
          👤 Normal Customer
        </button>
        <button style={s.typeTab(type === 'business')} type="button" onClick={() => switchType('business')}>
          🏢 Business
        </button>
      </div>

      <form style={s.form} onSubmit={handleSubmit}>
        {type === 'business' && (
          <div style={s.bizNote}>
            Business customers get a <strong>B-001</strong> style ID and appear in the Businesses section, not the regular customer list.
          </div>
        )}

        {/* Name field — differs by type */}
        {type === 'individual' ? (
          <div style={s.field}>
            <label style={s.label}>Full Name *</label>
            <input style={s.input} value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
        ) : (
          <div style={s.field}>
            <label style={s.label}>Business Name *</label>
            <input style={s.input} value={form.business_name} onChange={(e) => update('business_name', e.target.value)} required />
          </div>
        )}

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Phone Number *</label>
            <input style={s.input} value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
          </div>
          {type === 'individual' ? (
            <div style={s.field}>
              <label style={s.label}>House Number (optional)</label>
              <input style={s.input} value={form.house_number} onChange={(e) => update('house_number', e.target.value)} />
            </div>
          ) : (
            <div style={s.field}>
              <label style={s.label}>PAN Number (optional)</label>
              <input style={s.input} value={form.pan_number} onChange={(e) => update('pan_number', e.target.value)} />
            </div>
          )}
        </div>

        <div style={s.field}>
          <label style={s.label}>Address *</label>
          <input style={s.input} value={form.address} onChange={(e) => update('address', e.target.value)} required />
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Area *</label>
            <select style={s.input} value={form.area} onChange={(e) => update('area', e.target.value)}>
              {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Monthly Fee (Rs.) *</label>
            <input style={s.input} type="number" min="0" value={form.monthly_fee} onChange={(e) => update('monthly_fee', e.target.value)} required />
          </div>
        </div>

        <div style={s.field}>
          <BSDatePicker label="Registration Date (BS)" required value={form.registration_date_bs} onChange={(v) => update('registration_date_bs', v)} />
        </div>

        <div style={s.field}>
          <BSMonthPicker label="Payment Start Month (BS)" required value={form.payment_start_ym} onChange={(v) => update('payment_start_ym', v)} />
        </div>

        {error && <p style={s.error}>{error}</p>}
        <button style={s.btn} type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : type === 'business' ? 'Register Business' : 'Register Customer'}
        </button>
      </form>
    </Layout>
  );
}

export default withAuth(RegisterCustomer);