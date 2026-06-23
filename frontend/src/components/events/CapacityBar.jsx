// stays navy even when full — success/danger/warning is reserved for status, not capacity
const CapacityBar = ({ capacity, currentBookings }) => {
  const seatsRemaining = Math.max(capacity - currentBookings, 0);
  const percentFilled = capacity > 0 ? Math.min((currentBookings / capacity) * 100, 100) : 0;

  return (
    <div>
      <div className="h-1.5 border border-border rounded-sm bg-surface overflow-hidden">
        <div
          className="h-full bg-accent"
          style={{ width: `${percentFilled}%` }}
        />
      </div>
      <p className="mt-1 text-xs font-mono text-text-muted">
        {seatsRemaining === 0
          ? `Full — ${capacity} / ${capacity} seats`
          : `${currentBookings} / ${capacity} seats booked`}
      </p>
    </div>
  );
};

export default CapacityBar;
