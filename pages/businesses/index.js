import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { withAuth, useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toBS, monthsOverdueFromYM } from '../../lib/dateUtils';
import { yyyymmToLabel } from '../../components/BSMonthPicker';

const SHOW_STEP = 15;

function Businesses() {
  const { user } = useAuth();
  const router = useRouter();
  const [businesses, setBusinesses] = useState([]);
  const [lastBills, setLastBills] = useState({});
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('active');
  const [visible, setVisible] = useState(SHOW_STEP);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBusinesses(); }, []);

  async function loadBusinesses() {
    setLoading(true);
    const { data: biz } = await supabase
      .from('customers')
      .select('*, app_users(full_name)')
      .eq('customer_type', 'business')
      .order('customer_code');
    setBusinesses(biz || []);

    const { data: bills } = await supabase
      .from('bills').select('customer_id, paid_up_to').order('created_at', { ascending: false });
    const bMap = {};
    (bills || []).forEach((b) => { if (!bMap[b.customer_id]) bMap[b.customer_id] = b.paid_up_to; });
    setLastBills(bMap);
    setLoading(false);
  }

  const activeList = businesses.filter((b) => b.status === 'active');
  const inactiveList = businesses.filter((b) => b.status === 'deactivated');
  const sourceList = activeTab === 'active' ? activeList : inactiveList;

  const filtered = sourceList.filter((b) => {
    const name = b.business_name || b.name || '';
    const matchSearch = !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (b.customer_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.phone || '').includes(search);
    const matchArea = areaFilter === 'all' || b.area === areaFilter;
    return matchSearch && matchArea;
  });

  function getOverdueBadge(customerId) {
    const paidUpToYM = lastBills[customerId];
    if (!paidUpToYM || !/^\d{4}\/\d{2}$/.test(paidUpToYM)) return null;
    const overdue = monthsOverdueFromYM(paidUpToYM);
    if (overdue === null) return null;
    if (overdue <= 3) return { label: 'Current', color: '#15803d', bg: '#dcfce7' };
    if (overdue <= 6) return { label: `${overdue}mo overdue`, color: '#a16207', bg: '#fef9c3' };
    return { label: `${overdue}mo overdue`, color: '#b91c1c', bg: '#fee2e2' };
  }

  const s = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0' },
    tab: (a) => ({ padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', borderBottom: a ? '2px solid #22c55e' : '2px solid transparent', color: a ? '#0f172a' : '#94a3b8', cursor: 'pointer' }),
    tabCount: (a) => ({ display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: a ? '#22c55e' : '#e2e8f0', color: a ? '#fff' : '#64748b' }),
    registerBtn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    toolbar: { display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
    searchInput: { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    select: { padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    count: { fontSize: 13, color: '#64748b', marginBottom: 12 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 12, overflow: 'hidden' },
    th: { textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
    showMore: { width: '100%', padding: '12px', marginTop: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' },
    bizBadge: { display: 'inline-block', background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', marginRight: 6 },
    emptyState: { textAlign: 'center', padding: '48px 24px', color: '#94a3b8' },
    deactivatedRow: { opacity: 0.6 },
  };

  return (
    <Layout title="Businesses">
      <div style={s.header}>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{businesses.length} total businesses</p>
        <button style={s.registerBtn} onClick={() => router.push('/customers/register?type=business')}>
          + Register Business
        </button>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(activeTab === 'active')} onClick={() => { setActiveTab('active'); setVisible(SHOW_STEP); }}>
          Active <span style={s.tabCount(activeTab === 'active')}>{activeList.length}</span>
        </button>
        <button style={s.tab(activeTab === 'inactive')} onClick={() => { setActiveTab('inactive'); setVisible(SHOW_STEP); }}>
          Inactive <span style={s.tabCount(activeTab === 'inactive')}>{inactiveList.length}</span>
        </button>
      </div>

      <div style={s.toolbar}>
        <input style={s.searchInput} placeholder="Search by name, ID or phone..."
          value={search} onChange={(e) => { setSearch(e.target.value); setVisible(SHOW_STEP); }} />
        <select style={s.select} value={areaFilter} onChange={(e) => { setAreaFilter(e.target.value); setVisible(SHOW_STEP); }}>
          <option value="all">All Areas</option>
          <option value="ward-10">Ward 10</option>
          <option value="ward-14">Ward 14</option>
          <option value="ward-15">Ward 15</option>
        </select>
      </div>

      <p style={s.count}>Showing {Math.min(visible, filtered.length)} of {filtered.length}</p>

      {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : filtered.length === 0 ? (
        <div style={s.emptyState}>
          <p style={{ fontSize: 32, margin: '0 0 12px' }}>🏢</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#64748b', margin: '0 0 8px' }}>
            {activeTab === 'inactive' ? 'No inactive businesses' : 'No businesses yet'}
          </p>
          {activeTab === 'active' && (
            <button style={s.registerBtn} onClick={() => router.push('/customers/register?type=business')}>
              + Register Business
            </button>
          )}
        </div>
      ) : (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>ID</th>
                <th style={s.th}>Business Name</th>
                <th style={s.th}>Phone</th>
                <th style={s.th}>Area</th>
                <th style={s.th}>PAN</th>
                <th style={s.th}>Monthly Fee</th>
                <th style={s.th}>Registered (BS)</th>
                {activeTab === 'active' && <th style={s.th}>Paid Up To</th>}
                {activeTab === 'active' && <th style={s.th}>Status</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visible).map((b) => {
                const paidUpToYM = lastBills[b.id];
                const badge = getOverdueBadge(b.id);
                return (
                  <tr key={b.id}
                    style={activeTab === 'inactive' ? s.deactivatedRow : {}}
                    onClick={() => router.push(`/customers/${b.id}`)}>
                    <td style={s.td}><span style={s.bizBadge}>BIZ</span>{b.customer_code}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{b.business_name || b.name}</td>
                    <td style={s.td}>{b.phone}</td>
                    <td style={s.td}>{b.area.replace('ward-', 'Ward ')}</td>
                    <td style={s.td}>{b.pan_number || '—'}</td>
                    <td style={s.td}>Rs. {Number(b.monthly_fee).toLocaleString()}</td>
                    <td style={s.td}>{toBS(b.registration_date)}</td>
                    {activeTab === 'active' && (
                      <td style={s.td}>{paidUpToYM && /^\d{4}\/\d{2}$/.test(paidUpToYM) ? yyyymmToLabel(paidUpToYM) : '—'}</td>
                    )}
                    {activeTab === 'active' && (
                      <td style={s.td}>
                        {badge ? <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span> : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > visible && (
            <button style={s.showMore} onClick={() => setVisible((v) => v + SHOW_STEP)}>
              Show {Math.min(SHOW_STEP, filtered.length - visible)} more ({filtered.length - visible} remaining)
            </button>
          )}
        </>
      )}
    </Layout>
  );
}

export default withAuth(Businesses);