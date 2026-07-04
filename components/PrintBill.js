import { toBS } from '../lib/dateUtils';
import { yyyymmToLabel } from '../components/BSMonthPicker';

function numberToWords(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (num === 0) return 'Zero';
  function helper(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n/10)] + ' ' + helper(n % 10);
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred ' + helper(n % 100);
    if (n < 100000) return helper(Math.floor(n/1000)) + 'Thousand ' + helper(n % 1000);
    if (n < 10000000) return helper(Math.floor(n/100000)) + 'Lakh ' + helper(n % 100000);
    return helper(Math.floor(n/10000000)) + 'Crore ' + helper(n % 10000000);
  }
  return helper(num).trim() + ' Rupees Only';
}

export default function PrintBill({ bill, customer, collectedBy, settings, onClose }) {
  if (!bill || !customer) return null;

  const total = Number(bill.amount);
  const numMonths = bill.num_months || 1;
  const monthlyFee = customer.monthly_fee || (total / numMonths);

  // Paid up to label
  const paidUpToLabel = bill.paid_up_to
    ? (bill.paid_up_to.includes('/') && bill.paid_up_to.length <= 7
        ? yyyymmToLabel(bill.paid_up_to)
        : bill.paid_up_to)
    : bill.to_month || '—';

  // Period label
  const fromLabel = bill.from_month
    ? (bill.from_month.length <= 7 ? yyyymmToLabel(bill.from_month) : bill.from_month)
    : '—';
  const toLabel = bill.to_month
    ? (bill.to_month.length <= 7 ? yyyymmToLabel(bill.to_month) : bill.to_month)
    : '—';

  // Due date = 15 days after generated date
  const dueDate = new Date(bill.generated_date || new Date());
  dueDate.setDate(dueDate.getDate() + 15);

  const p = {
    page: { width: '72mm', minHeight: '100vh', margin: '0 auto', background: '#fff', fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', color: '#000', padding: '4mm 3mm 8mm', boxSizing: 'border-box' },
    center: { textAlign: 'center' },
    logo: { width: 44, height: 44, borderRadius: '50%', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 22 },
    companyName: { fontSize: '13px', fontWeight: 'bold', margin: '0 0 2px' },
    companyMeta: { fontSize: '9px', color: '#444', margin: '0 0 6px', lineHeight: 1.5 },
    dashed: { borderTop: '1px dashed #000', margin: '6px 0' },
    solid: { borderTop: '1px solid #000', margin: '6px 0' },
    banner: { background: '#1a5c2e', color: '#fff', textAlign: 'center', padding: '4px 0', fontWeight: 'bold', fontSize: '11px', letterSpacing: 1, margin: '6px 0' },
    row3: { display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: 2 },
    boldVal: { fontWeight: 'bold', fontSize: '10px' },
    redVal: { fontWeight: 'bold', fontSize: '10px', color: '#c00' },
    billedLabel: { fontSize: '8px', color: '#22c55e', fontWeight: 'bold', letterSpacing: 1, margin: '6px 0 3px' },
    custName: { fontSize: '13px', fontWeight: 'bold', margin: '0 0 2px' },
    custMeta: { fontSize: '9px', margin: '0 0 2px', lineHeight: 1.5 },
    areaBadge: { display: 'inline-block', border: '1px solid #22c55e', borderRadius: 4, padding: '1px 6px', fontSize: '9px', color: '#1a5c2e', marginBottom: 4 },
    tableHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold', letterSpacing: 0.5, borderBottom: '1px solid #000', paddingBottom: 3, marginBottom: 4 },
    tableRow: { display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: 2 },
    subRow: { display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: 2 },
    totalRow: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', color: '#1a5c2e', margin: '4px 0' },
    paidUpTo: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '4px 8px', margin: '6px 0', textAlign: 'center' },
    wordsLabel: { fontSize: '8px', color: '#666', letterSpacing: 0.5, margin: '6px 0 2px' },
    words: { fontSize: '9px', fontWeight: 'bold' },
    methodsLabel: { fontSize: '8px', color: '#666', letterSpacing: 0.5, margin: '6px 0 3px' },
    pill: { border: '1px solid #aaa', borderRadius: 10, padding: '1px 7px', fontSize: '8px' },
    qrBox: { width: 52, height: 52, border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontSize: '8px', color: '#999', textAlign: 'center' },
    footer: { textAlign: 'center', fontSize: '8px', color: '#666', borderTop: '1px dashed #000', paddingTop: 6, marginTop: 6, lineHeight: 1.6 },
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-bill, #print-bill * { visibility: visible !important; }
          #print-bill { position: fixed; top: 0; left: 0; width: 72mm; }
          @page { size: 72mm auto; margin: 0; }
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ background: '#f1f5f9', borderRadius: 12, padding: 20, width: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: 14 }}>Bill Preview</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>🖨 Print</button>
              <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </div>

          <div id="print-bill" style={p.page}>
            {/* Header */}
            <div style={p.center}>
              <div style={p.logo}>♻</div>
              <p style={p.companyName}>{settings?.company_name || 'Waste Management Recycling Pvt. Ltd.'}</p>
              <p style={p.companyMeta}>
                {settings?.address || 'Kathmandu, Nepal'}<br />
                {settings?.phone ? `Tel: ${settings.phone}` : ''}{settings?.phone && settings?.email ? ' • ' : ''}{settings?.email || ''}
              </p>
            </div>

            <div style={p.banner}>TAX INVOICE / BILL</div>

            {/* Bill meta */}
            <div style={p.row3}>
              <div><div style={{ fontSize: '8px', color: '#666' }}>Bill No.</div><div style={p.boldVal}>{bill.bill_number}</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: '8px', color: '#666' }}>Bill Date</div><div style={p.boldVal}>{toBS(bill.generated_date)} (B.S.)</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: '8px', color: '#666' }}>Payment Due</div><div style={p.redVal}>{toBS(dueDate.toISOString().slice(0, 10))} (B.S.)</div></div>
            </div>

            <div style={p.dashed} />

            {/* Billed to */}
            <div style={p.billedLabel}>BILLED TO</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={p.custName}>{customer.name}</p>
                <p style={p.custMeta}>
                  Customer ID: {customer.customer_code}<br />
                  {customer.area.replace('ward-', 'Ward ')}{customer.house_number ? `, House No. ${customer.house_number}` : ''}, {customer.address}<br />
                  Phone: {customer.phone}
                </p>
              </div>
              <div style={p.areaBadge}>{customer.area.replace('ward-', 'Ward ')}</div>
            </div>

            <div style={p.dashed} />

            {/* Service table */}
            <div style={p.tableHeader}>
              <span style={{ flex: 1 }}>DESCRIPTION</span>
              <span style={{ minWidth: 28, textAlign: 'right' }}>MO.</span>
              <span style={{ minWidth: 44, textAlign: 'right' }}>RATE</span>
              <span style={{ minWidth: 44, textAlign: 'right' }}>AMT</span>
            </div>
            <div style={p.tableRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>Waste Collection Service</div>
                <div style={{ fontSize: '8px', color: '#555' }}>{fromLabel} – {toLabel}</div>
              </div>
              <span style={{ minWidth: 28, textAlign: 'right' }}>{numMonths}</span>
              <span style={{ minWidth: 44, textAlign: 'right' }}>Rs.{Number(monthlyFee).toLocaleString()}</span>
              <span style={{ minWidth: 44, textAlign: 'right' }}>Rs.{total.toLocaleString()}</span>
            </div>

            <div style={p.solid} />
            <div style={p.totalRow}><span>Total Amount Due</span><span>Rs. {total.toLocaleString()}</span></div>
            <div style={p.solid} />

            {/* Paid Up To — prominent */}
            <div style={p.paidUpTo}>
              <div style={{ fontSize: '8px', color: '#15803d', fontWeight: 'bold', letterSpacing: 0.5 }}>PAID UP TO</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#15803d' }}>{paidUpToLabel}</div>
            </div>

            {/* Amount in words */}
            <div style={p.wordsLabel}>AMOUNT IN WORDS</div>
            <div style={p.words}>{numberToWords(total)}</div>

            <div style={p.dashed} />

            {/* Payment methods + QR */}
            <div style={p.methodsLabel}>PAYMENT METHODS ACCEPTED</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
              <div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {['Cash', 'eSewa', 'Khalti'].map((m) => <span key={m} style={p.pill}>{m}</span>)}
                </div>
                <div style={{ fontSize: '9px', lineHeight: 1.6 }}>
                  <span style={{ color: '#666' }}>Collected by</span><br />
                  <strong>{collectedBy?.full_name}</strong> ({collectedBy?.staff_code})
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                {settings?.qr_code_url
                  ? <img src={settings.qr_code_url} alt="QR" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                  : <div style={p.qrBox}>QR not set</div>
                }
                <div style={{ fontSize: '8px', color: '#666', marginTop: 2 }}>Scan to Pay</div>
              </div>
            </div>

            <div style={p.footer}>
              Thank you for keeping our city clean.<br />
              This is a computer-generated bill.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}