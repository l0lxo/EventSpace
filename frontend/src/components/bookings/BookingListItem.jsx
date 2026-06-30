import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import Card from '../shared/Card';
import Button from '../shared/Button';
import StatusBadge from '../shared/StatusBadge';
import { CANCELLATION_WINDOW_HOURS, canCancelBooking } from '../../utils/bookingWindow';

const BookingListItem = ({ booking, onCancelled }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const handleCancel = () => {
    setIsSubmitting(true);
    setError('');
    api
      .delete(`/bookings/${booking.id}`)
      .then(({ data }) => {
        setConfirmingCancel(false);
        onCancelled(booking.id, data.seatsRemaining);
      })
      .catch((err) => setError(err.response?.data?.message ?? 'Could not cancel this booking.'))
      .finally(() => setIsSubmitting(false));
  };

  const canCancel = booking.event && booking.status === 'confirmed' && canCancelBooking(booking.event);

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          {booking.event ? (
            <Link to={`/events/${booking.event.id}`} className="font-display text-lg text-text">
              {booking.event.title}
            </Link>
          ) : (
            <p className="font-display text-lg text-text-muted">Event no longer available</p>
          )}
          {booking.event && (
            <>
              <p className="text-sm font-mono text-text mt-1">
                {format(parseISO(booking.event.date), 'MMM d, yyyy')} · {booking.event.time}
              </p>
              <p className="text-sm text-text-muted">{booking.event.location}</p>
            </>
          )}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}

      {booking.status === 'confirmed' && booking.event && !canCancel && (
        <p className="text-sm text-text-muted mt-3">
          Cancellation window has passed — bookings must be cancelled at least{' '}
          {CANCELLATION_WINDOW_HOURS} hours before the event.
        </p>
      )}

      {canCancel && !confirmingCancel && (
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmingCancel(true)}>
          Cancel booking
        </Button>
      )}

      {canCancel && confirmingCancel && (
        <div className="flex flex-wrap gap-2 items-center mt-3">
          <span className="text-sm text-text">Cancel this booking?</span>
          <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleCancel}>
            Yes, cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
            No, keep it
          </Button>
        </div>
      )}
    </Card>
  );
};

export default BookingListItem;
