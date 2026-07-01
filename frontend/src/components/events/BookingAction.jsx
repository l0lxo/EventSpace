import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import Button from '../../components/shared/Button';
import { CANCELLATION_WINDOW_HOURS, canCancelBooking } from '../../utils/bookingWindow';

const BookingAction = ({ event, onBooked, onCancelled }) => {
  const { currentUser } = useAuth();
  const isStudent = currentUser?.role === 'student';

  const [myBooking, setMyBooking] = useState(undefined); // undefined = not loaded yet
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => {
    // event detail response doesn't say whether the current student already booked it
    if (!isStudent) return;
    let active = true;

    api
      .get('/bookings/my-bookings', { params: { status: 'confirmed' } })
      .then(({ data }) => {
        if (!active) return;
        setMyBooking(data.data.find((b) => b.event?.id === event.id) ?? null);
      })
      .catch(() => {
        if (active) setMyBooking(null);
      });

    return () => {
      active = false;
    };
  }, [isStudent, event.id]);

  const handleBook = () => {
    setIsSubmitting(true);
    setError('');
    api
      .post('/bookings', { eventId: event.id })
      .then(({ data }) => {
        setMyBooking(data.booking);
        onBooked(data.seatsRemaining);
      })
      .catch((err) => setError(err.response?.data?.message ?? 'Could not book this event.'))
      .finally(() => setIsSubmitting(false));
  };

  const handleCancel = () => {
    setIsSubmitting(true);
    setError('');
    api
      .delete(`/bookings/${myBooking.id}`)
      .then(({ data }) => {
        setMyBooking(null);
        setConfirmingCancel(false);
        onCancelled(data.seatsRemaining);
      })
      .catch((err) => setError(err.response?.data?.message ?? 'Could not cancel this booking.'))
      .finally(() => setIsSubmitting(false));
  };

  if (!currentUser) {
    return (
      <p className="text-sm text-text-muted">
        <Link to="/login" className="text-text underline">Log in</Link> as a student to book a seat.
      </p>
    );
  }

  if (!isStudent) {
    return null;
  }

  if (myBooking === undefined) {
    return null; // booking status still loading
  }

  if (myBooking) {
    const canCancel = canCancelBooking(event);

    return (
      <div>
        <p className="text-sm text-success mb-2">You're booked for this event.</p>
        {error && <p className="text-sm text-danger mb-2">{error}</p>}

        {!canCancel && (
          <p className="text-sm text-text-muted">
            Cancellation window has passed — bookings must be cancelled at least{' '}
            {CANCELLATION_WINDOW_HOURS} hours before the event.
          </p>
        )}

        {canCancel && !confirmingCancel && (
          <Button variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>
            Cancel booking
          </Button>
        )}

        {canCancel && confirmingCancel && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-text">Cancel this booking?</span>
            <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleCancel}>
              Yes, cancel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
              No, keep it
            </Button>
          </div>
        )}
      </div>
    );
  }

  const seatsRemaining = event.capacity - event.currentBookings;

  if (seatsRemaining <= 0) {
    return <p className="text-sm text-text-muted">This event is full.</p>;
  }

  return (
    <div>
      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      <Button variant="success" isLoading={isSubmitting} onClick={handleBook}>
        Book a seat
      </Button>
    </div>
  );
};

export default BookingAction;
