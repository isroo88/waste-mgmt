import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { withAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'staff' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.username || !form.full_name || !form.password) {
      setError('Please fill all fields.');
      return;
    }

    setSubmitting(true);

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(result.error || 'Failed to create user.');
    } else {
      setSuccess(`User "${form.username}" created successfully.`);
      setForm({ username: '', full_name: '', password: '', role: 'staff' });
      loadUsers();
    }
  }

  async function toggleStatus(u) {
    const newStatus = u.status === 'active' ? 'deactivated' : 'active';
    await supabase.from('app_users').update({ status: newStatus }).eq('id', u.id);
    loadUsers();
  }

  const styles = {
    layout: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    button: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14 },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
    success: { color: '#15803d', fontSize: 13, marginBottom: 12, background: '#dcfce7', padding: '8px 12px', borderRadius: 8 },
    note: { fontSize: 12, color: '#94a3b8', marginTop: -8, marginBottom: 16 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    pill: (active) => ({
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: active ? '#dcfce7' : '#fee2e2',
      color: active ? '#15803d' : '#b91c1c',
    }),
    toggleBtn: (active) => ({
      padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, color: '#fff',
      background: active ? '#ef4444' : '#22c55e', cursor: 'pointer',
    }),
  };

  return (
    <Layout title="Users">
      <div style={styles.layout}>
        <form style={styles.form} onSubmit={handleCreate}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Staff / Admin</h3>
          <div style={styles.field}>
            <label style={styles.label}>Username *</label>
            <input style={styles.input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. ramesh" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Full Name *</label>
            <input style={styles.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Ramesh Sharma" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password *</label>
            <input style={styles.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Role *</label>
            <select style={styles.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p style={styles.note}>Staff will log in with just their username and password.</p>
          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </form>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Username</th>
              <th style={styles.th}>Full Name</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={styles.td}>{u.username}</td>
                <td style={styles.td}>{u.full_name}</td>
                <td style={{ ...styles.td, textTransform: 'capitalize' }}>{u.role}</td>
                <td style={styles.td}><span style={styles.pill(u.status === 'active')}>{u.status}</span></td>
                <td style={styles.td}>
                  <button style={styles.toggleBtn(u.status === 'active')} onClick={() => toggleStatus(u)}>
                    {u.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export default withAuth(Users, 'admin');