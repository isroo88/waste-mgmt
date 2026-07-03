import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import BSDatePicker from '../../components/BSDatePicker';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { bsToAD, AREAS } from '../../lib/dateUtils';

function RegisterCustomer() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    area: 'ward-10',
    house_number: '',
    monthly_fee: '',
    registration_date_bs: '',
    payment_start_date_bs: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.registration_date_bs || !form.payment_start_date_bs) {
      setError('Please select both registration date and payment start date.');
      return;
    }

    const regAD = bsToAD(form.registration_date_bs);
    const startAD = bsToAD(form.payment_start_date_bs);

    if (!regAD || !startAD) {
      setError('Invalid date selected. Please choose year, month and day.');
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from('customers').insert({
      name: form.name,
      phone: form.phone,
      address: form.address,
      area: form.area,
      house_number: form.house_number || null,
      monthly_fee: Number(form.monthly_fee),
      registration_date: regAD.toISOString().slice(0, 10),
      payment_start_date: startAD.toISOString().slice(0, 10),
      registered_by: user.id,
    });
    setSubmitting(false);

    if (insertError) setError(insertError.message);
    else router.push('/customers');
  }

  const s = {
    form: { background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e2e8f0', maxWidth: 620 },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    btn: { padding: '12px 28px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 16, background: '#fee2e2', padding: '8px 12px', borderRadius: 8 },
  };

  return (
    <Layout title="Register Customer">
      <form style={s.form} onSubmit={handleSubmit}>
        <div style={s.field}>
          <label style={s.label}>Full Name *</label>
          <input style={s.input} value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Phone Number *</label>
            <input style={s.input} value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>House Number (optional)</label>
            <input style={s.input} value={form.house_number} onChange={(e) => update('house_number', e.target.value)} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Address *</label>
          <input style={s.input} value={form.address} onChange={(e) => update('address', e.target.value)} required />
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Area *</label>
            <select style={s.input} value={form.area} onChange={(e) => update('area', e.target.value)}>
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Monthly Fee (Rs.) *</label>
            <input style={s.input} type="number" min="0" value={form.monthly_fee}
              onChange={(e) => update('monthly_fee', e.target.value)} required />
          </div>
        </div>

        <div style={s.field}>
          <BSDatePicker
            label="Registration Date (BS)"
            required
            value={form.registration_date_bs}
            onChange={(val) => update('registration_date_bs', val)}
          />
        </div>

        <div style={s.field}>
          <BSDatePicker
            label="Payment Start Date (BS)"
            required
            value={form.payment_start_date_bs}
            onChange={(val) => update('payment_start_date_bs', val)}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}
        <button style={s.btn} type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Register Customer'}
        </button>
      </form>
    </Layout>
  );
}

export default withAuth(RegisterCustomer);