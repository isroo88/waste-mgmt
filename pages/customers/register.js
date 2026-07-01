import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { bsToAD, todayBS, AREAS } from '../../lib/dateUtils';

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
    registration_date_bs: todayBS(),
    payment_start_date_bs: todayBS(),
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const regAD = bsToAD(form.registration_date_bs);
    const startAD = bsToAD(form.payment_start_date_bs);
    if (!regAD || !startAD) {
      setError('Please enter valid BS dates in YYYY-MM-DD format.');
      return;
    }
    if (!form.name || !form.phone || !form.address || !form.monthly_fee) {
      setError('Please fill all required fields.');
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

    if (insertError) {
      setError(insertError.message);
    } else {
      router.push('/customers');
    }
  }

  const styles = {
    form: { background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e2e8f0', maxWidth: 600 },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    hint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
    button: { padding: '12px 28px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14 },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 16 },
  };

  return (
    <Layout title="Register Customer">
      <form style={styles.form} onSubmit={handleSubmit}>
        <div style={styles.field}>
          <label style={styles.label}>Full Name *</label>
          <input style={styles.input} value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Phone Number *</label>
            <input style={styles.input} value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>House Number (optional)</label>
            <input style={styles.input} value={form.house_number} onChange={(e) => update('house_number', e.target.value)} />
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Address *</label>
          <input style={styles.input} value={form.address} onChange={(e) => update('address', e.target.value)} required />
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Area *</label>
            <select style={styles.input} value={form.area} onChange={(e) => update('area', e.target.value)}>
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Monthly Fee (Rs.) *</label>
            <input
              style={styles.input}
              type="number"
              min="0"
              value={form.monthly_fee}
              onChange={(e) => update('monthly_fee', e.target.value)}
              required
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Registration Date (BS) *</label>
            <input
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={form.registration_date_bs}
              onChange={(e) => update('registration_date_bs', e.target.value)}
              required
            />
            <p style={styles.hint}>Nepali calendar, e.g. 2082-03-15</p>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Payment Start Date (BS) *</label>
            <input
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={form.payment_start_date_bs}
              onChange={(e) => update('payment_start_date_bs', e.target.value)}
              required
            />
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Register Customer'}
        </button>
      </form>
    </Layout>
  );
}

export default withAuth(RegisterCustomer);
