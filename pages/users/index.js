import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { withAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const SHOW_INITIAL = 5;
const SHOW_STEP = 5;

function Users() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'staff' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(SHOW_INITIAL);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.username || !form.full_name || !form.password) {
      setError('Please fill all fields.'); return;
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

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 },
    form: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0', height: 'fit-content' },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' },
    button: { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 12 },
    success: { color: '#15803d', fontSize: 13, marginBottom: 12, background: '#dcfce7', padding: '8px 12px', borderRadius: 8 },
    note: { fontSize: 12, color: '#94a3b8', marginTop: -8, marginBottom: 16 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9' },
    pill: (active) => ({ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: active ? '#dcfce7' : '#fee2e2', color: active ? '#15803d' : '#b91c1c' }),
    toggleBtn: (active) => ({ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, color: '#fff', background: active ? '#ef4444' : '#22c55e', cursor: 'pointer' }),
    showMore: { width: '100%', padding: '12px', marginTop: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' },
    count: { fontSize: 13, color: '#64748b', marginBottom: 10 },
  };

  return (
    <Layout title="Users">
      <div style={s.layout}>
        <form style={s.form} onSubmit={handleCreate}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Add Staff / Admin</h3>
          <div style={s.field}>
            <label style={s.label}>Username *</label>
            <input style={s.input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. ramesh" required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Full Name *</label>
            <input style={s.input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Ramesh Sharma" required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password *</label>
            <input style={s.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Role *</label>
            <select style={s.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p style={s.note}>Staff log in with username and password only.</p>
          {error && <p style={s.error}>{error}</p>}
          {success && <p style={s.success}>{success}</p>}
          <button style={s.button} type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </form>

        <div>
          <p style={s.count}>
            Showing {Math.min(visible, users.length)} of {users.length} users
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Username</th>
                <th style={s.th}>Full Name</th>
                <th style={s.th}>Staff Code</th>
                <th style={s.th}>Role</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, visible).map((u) => (
                <tr key={u.id}
                  style={{ cursor: u.role === 'staff' ? 'pointer' : 'default' }}
                  onClick={() => u.role === 'staff' && router.push(`/users/${u.id}`)}
                  onMouseEnter={(e) => { if (u.role === 'staff') e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                >
                  <td style={s.td}>{u.username}</td>
                  <td style={s.td}>{u.full_name}</td>
                  <td style={s.td}>{u.staff_code || '—'}</td>
                  <td style={{ ...s.td, textTransform: 'capitalize' }}>{u.role}</td>
                  <td style={s.td}><span style={s.pill(u.status === 'active')}>{u.status}</span></td>
                  <td style={s.td}>
                    <button style={s.toggleBtn(u.status === 'active')} onClick={() => toggleStatus(u)}>
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length > visible && (
            <button style={s.showMore} onClick={() => setVisible((v) => v + SHOW_STEP)}>
              Show {Math.min(SHOW_STEP, users.length - visible)} more ({users.length - visible} remaining)
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(Users, 'admin');