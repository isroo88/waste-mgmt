import { getCustomerStatus, STATUS_COLORS } from '../lib/dateUtils';

export default function StatusBadge({ customer, lastPaymentDate }) {
  const { status, label } = getCustomerStatus(customer, lastPaymentDate);
  const colors = STATUS_COLORS[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
      }}
      title={label}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot }} />
      {label}
    </span>
  );
}
