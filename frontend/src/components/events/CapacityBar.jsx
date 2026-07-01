import { useEffect, useRef, useState } from 'react';

// stays black even when full — success/danger/warning is reserved for status, not capacity
const CapacityBar = ({ capacity, currentBookings, pulseTick = 0 }) => {
  const seatsRemaining = Math.max(capacity - currentBookings, 0);
  const percentFilled = capacity > 0 ? Math.min((currentBookings / capacity) * 100, 100) : 0;

  const [isPulsing, setIsPulsing] = useState(false);
  const prevTick = useRef(pulseTick);

  useEffect(() => {
    if (pulseTick === prevTick.current) return undefined;
    prevTick.current = pulseTick;
    setIsPulsing(true);
    const timeout = setTimeout(() => setIsPulsing(false), 300);
    return () => clearTimeout(timeout);
  }, [pulseTick]);

  const pulseClass = isPulsing ? (seatsRemaining === 0 ? 'seat-count-pulse-danger' : 'seat-count-pulse') : '';

  return (
    <div>
      <div className="h-1.5 border border-border rounded-sm bg-surface overflow-hidden">
        <div
          className="h-full bg-text"
          style={{ width: `${percentFilled}%` }}
        />
      </div>
      <p className={`mt-1 text-xs font-mono text-text-muted seat-count ${pulseClass}`}>
        {seatsRemaining === 0
          ? `Full — ${capacity} / ${capacity} seats`
          : `${currentBookings} / ${capacity} seats booked`}
      </p>
    </div>
  );
};

export default CapacityBar;
