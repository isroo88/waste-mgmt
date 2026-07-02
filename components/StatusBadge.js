import { monthsSince, STATUS_COLORS } from '../lib/dateUtils';

export default function StatusBadge({ customer, lastPaymentDate }) {
  const ref = lastPaymentDate || customer.payment_start_date;
  const months = monthsSince(ref);

  let status, label;
  if (months <= 3) { status = 'green'; label = 'Paid up to date'; }
  else if (months <= 6) { status = 'yellow'; label = 'Overdue 3–6 months'; }
  else { status = 'red'; label = 'Overdue 6+ months'; }

  const colors = STATUS_COLORS[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: colors.bg, color: colors.text }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot }} />
      {label}
    </span>
  );
}