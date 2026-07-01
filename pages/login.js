import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

// Internal convention: username "ramesh" maps to auth email "ramesh@wastemgmt.local"
// This lets staff log in with just a username while Supabase Auth still uses email under the hood.
function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@wastemgmt.local`;
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usernameToEmail(username), password);
      router.push('/dashboard');
    } catch (err) {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
    },
    card: {
      background: '#fff',
      borderRadius: 16,
      padding: 40,
      width: 380,
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    },
    brandRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
    icon: { fontSize: 32, color: '#22c55e' },
    title: { fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.3 },
    subtitle: { fontSize: 13, color: '#64748b', margin: '4px 0 0' },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6, marginTop: 16 },
    input: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #cbd5e1',
      fontSize: 14,
    },
    button: {
      width: '100%',
      marginTop: 24,
      padding: '12px',
      borderRadius: 8,
      border: 'none',
      background: '#22c55e',
      color: '#fff',
      fontWeight: 600,
      fontSize: 14,
    },
    error: { color: '#dc2626', fontSize: 13, marginTop: 12 },
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <span style={styles.icon}>♻</span>
          <div>
            <h1 style={styles.title}>Waste Management Recycling Pvt. Ltd</h1>
            <p style={styles.subtitle}>Customer Management & Billing System</p>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Username</label>
          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            required
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
