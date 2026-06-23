const STATUS_CONFIG = {
  pending: { label: 'Pending review', color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'danger' },
  modification_requested: { label: 'Changes requested', color: 'warning' },
  cancelled: { label: 'Cancelled', color: 'muted' },
  confirmed: { label: 'Confirmed', color: 'success' },
  disabled: { label: 'Disabled', color: 'danger' },
  active: { label: 'Active', color: 'success' },
};

const COLOR_STYLES = {
  success: 'text-success border-success bg-success-bg',
  danger: 'text-danger border-danger bg-danger-bg',
  warning: 'text-warning border-warning bg-warning-bg',
  muted: 'text-text-muted border-border bg-surface',
};

const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || { label: status, color: 'muted' };

  return (
    <span
      className={`
        inline-block px-2 py-0.5 text-xs font-medium rounded-sm border
        ${COLOR_STYLES[config.color]}
      `}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
