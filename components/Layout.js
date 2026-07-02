import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◉' },
  { href: '/customers', label: 'Customers', icon: '◈' },
  { href: '/customers/register', label: 'Register Customer', icon: '＋' },
  { href: '/billing', label: 'Billing', icon: '▤' },
  { href: '/payments', label: 'Payments', icon: '◌' },
  { href: '/fee-requests', label: 'Fee Requests', icon: '↺' },
  { href: '/users', label: 'Users', icon: '◎', adminOnly: true },
  { href: '/settings', label: 'Settings', icon: '⚙', adminOnly: true },
];

export default function Layout({ title, children }) {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();

  const styles = {
    shell: { display: 'flex', minHeight: '100vh' },
    sidebar: {
      width: 240,
      background: '#0f172a',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px 16px',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
    },
    brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, padding: '0 8px' },
    brandIcon: { fontSize: 22, color: '#22c55e' },
    brandText: { fontSize: 13, fontWeight: 700, lineHeight: 1.4 },
    nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
    navItem: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 500,
      color: active ? '#fff' : '#94a3b8',
      background: active ? '#1e293b' : 'transparent',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%',
    }),
    logout: {
      marginTop: 12,
      padding: '10px 12px',
      borderRadius: 8,
      background: 'transparent',
      border: '1px solid #334155',
      color: '#94a3b8',
      fontSize: 14,
      cursor: 'pointer',
    },
    main: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
    topbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 32px',
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
    },
    pageTitle: { fontSize: 20, fontWeight: 700, margin: 0 },
    profile: { display: 'flex', alignItems: 'center', gap: 10 },
    avatar: {
      width: 36, height: 36, borderRadius: '50%',
      background: '#22c55e', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
    },
    content: { padding: 32, flex: 1 },
    footer: {
      background: '#0f172a',
      color: '#94a3b8',
      textAlign: 'center',
      padding: '16px 32px',
      fontSize: 12,
      lineHeight: 1.8,
    },
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>♻</span>
          <span style={styles.brandText}>Waste Management<br />Recycling Pvt. Ltd</span>
        </div>
        <nav style={styles.nav}>
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <button
              key={item.href}
              style={styles.navItem(router.pathname === item.href || router.pathname.startsWith(item.href + '/'))}
              onClick={() => router.push(item.href)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <button style={styles.logout} onClick={logout}>Logout</button>
      </aside>

      <div style={styles.main}>
        <header style={styles.topbar}>
          <h1 style={styles.pageTitle}>{title}</h1>
          <div style={styles.profile}>
            <div style={styles.avatar}>{user?.full_name?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>{user?.full_name}</strong>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
                {user?.role} {user?.staff_code ? `· ${user.staff_code}` : ''}
              </p>
            </div>
          </div>
        </header>

        <main style={styles.content}>{children}</main>

        <footer style={styles.footer}>
          <strong style={{ color: '#e2e8f0', fontSize: 13 }}>Waste Management Recycling Pvt. Ltd.</strong><br />
          Kathmandu, Nepal &nbsp;·&nbsp; Tel: 01-4XXXXXX &nbsp;·&nbsp; wastecity@email.com<br />
          <span style={{ fontSize: 11 }}>© {new Date().getFullYear()} All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}