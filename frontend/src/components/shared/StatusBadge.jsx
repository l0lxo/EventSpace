/**
 * src/components/shared/StatusBadge.jsx
 *
 * The one recognizable visual motif used consistently across the entire
 * app — every event status, booking status, and user status renders
 * through this same component. Deliberately NOT a filled pill shape
 * (the generic SaaS-dashboard default) — a thin colored border with
 * colored text on a near-white tint reads as more restrained and more
 * "institutional software" than a bright filled badge.
 *
 * Usage:
 *   <StatusBadge status="approved" />
 *   <StatusBadge status="pending" />
 *   <StatusBadge status="rejected" />
 */

const STATUS_CONFIG = {
  // Event statuses
  pending: { label: 'Pending review', color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'danger' },
  modification_requested: { label: 'Changes requested', color: 'warning' },
  cancelled: { label: 'Cancelled', color: 'muted' },

  // Booking statuses
  confirmed: { label: 'Confirmed', color: 'success' },

  // Reuse for generic true/false disabled-user state if needed
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
