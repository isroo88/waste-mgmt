import { monthsOverdueFromYM, monthsSince, STATUS_COLORS } from '../lib/dateUtils';

export default function StatusBadge({ customer, lastPaymentDate, paidUpToYM }) {
  let status, label, overdue;

  if (paidUpToYM) {
    // Prefer BS month-based calculation from paid_up_to
    overdue = monthsOverdueFromYM(paidUpToYM);
    if (overdue === null) overdue = 0;
    if (overdue <= 3) { status = 'green'; label = 'Paid up to date'; }
    else if (overdue <= 6) { status = 'yellow'; label = `${overdue}mo overdue`; }
    else { status = 'red'; label = `${overdue}mo overdue`; }
  } else {
    // Fallback: use AD last payment date
    const ref = lastPaymentDate || customer?.payment_start_date;
    const months = monthsSince(ref);
    if (months <= 3) { status = 'green'; label = 'Paid up to date'; }
    else if (months <= 6) { status = 'yellow'; label = `${months}mo overdue`; }
    else { status = 'red'; label = `${months}mo overdue`; }
  }

  const colors = STATUS_COLORS[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: colors.bg, color: colors.text }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot }} />
      {label}
    </span>
  );
}