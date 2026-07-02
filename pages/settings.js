import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import { withAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

function Settings() {
  const [form, setForm] = useState({
    company_name: '',
    address: '',
    phone: '',
    email: '',
    qr_code_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (data) setForm({
      company_name: data.company_name || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      qr_code_url: data.qr_code_url || '',
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    const { error: updateError } = await supabase
      .from('settings')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSaving(false);
    if (updateError) setError(updateError.message);
    else setSuccess('Settings saved successfully.');
  }

  async function handleQRUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(''); setSuccess('');

    const ext = file.name.split('.').pop();
    const filename = `qr-code.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(filename, file, { upsert: true });

    if (uploadError) {
      setError('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(filename);

    const publicUrl = urlData.publicUrl;

    await supabase.from('settings').update({ qr_code_url: publicUrl }).eq('id', 1);
    setForm((f) => ({ ...f, qr_code_url: publicUrl }));
    setUploading(false);
    setSuccess('QR code uploaded successfully.');
  }

  const s = {
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
    card: { background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' },
    title: { fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 20 },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 },
    btn: { padding: '10px 24px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
    uploadBtn: { padding: '10px 20px', borderRadius: 8, border: '1px dashed #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: 14, cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center' },
    success: { color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
    error: { color: '#dc2626', fontSize: 13, marginBottom: 16 },
    qrBox: { width: 140, height: 140, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', background: '#f8fafc' },
    hint: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  };

  return (
    <Layout title="Settings">
      <div style={s.grid}>
        {/* Company Info */}
        <div style={s.card}>
          <h3 style={s.title}>Company Information</h3>
          {success && <p style={s.success}>{success}</p>}
          {error && <p style={s.error}>{error}</p>}
          <form onSubmit={handleSave}>
            <div style={s.field}>
              <label style={s.label}>Company Name</label>
              <input style={s.input} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Address</label>
              <input style={s.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Phone Number</label>
              <input style={s.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 01-4XXXXXX" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. info@company.com" />
            </div>
            <button style={s.btn} type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* QR Code Upload */}
        <div style={s.card}>
          <h3 style={s.title}>Payment QR Code</h3>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: -12, marginBottom: 16 }}>
            This QR code will appear on every generated bill for customers to scan and pay.
          </p>

          <div style={s.qrBox}>
            {form.qr_code_url ? (
              <img src={form.qr_code_url} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⬜</div>
                <div style={{ fontSize: 12 }}>QR not set yet</div>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleQRUpload}
          />
          <button style={s.uploadBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : form.qr_code_url ? '🔄 Replace QR Code' : '⬆ Upload QR Code'}
          </button>
          <p style={s.hint}>Accepted: PNG, JPG, SVG. Upload your eSewa / Khalti / bank QR image.</p>

          {form.qr_code_url && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Current URL:</p>
              <p style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>{form.qr_code_url}</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(Settings, 'admin');