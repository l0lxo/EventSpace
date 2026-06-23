import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import CapacityBar from '../../components/events/CapacityBar';

const EDITABLE_STATUSES = ['pending', 'modification_requested'];

const MyEventRow = ({ event, onCancelled }) => {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = () => {
    setIsSubmitting(true);
    setError('');
    api
      .delete(`/events/${event.id}`)
      .then(() => onCancelled(event.id))
      .catch((err) => setError(err.response?.data?.message ?? 'Could not cancel this event.'))
      .finally(() => setIsSubmitting(false));
  };

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
            {event.category}
          </p>
          <h3 className="font-display text-lg text-text">{event.title}</h3>
          <p className="text-sm font-mono text-text mt-1">
            {format(parseISO(event.date), 'MMM d, yyyy')} · {event.time}
          </p>
          <p className="text-sm text-text-muted">{event.location}</p>
        </div>
        <StatusBadge status={event.status} />
      </div>

      {(event.status === 'rejected' || event.status === 'modification_requested') && event.feedback && (
        <p className="text-sm text-text mt-3 bg-surface border border-border rounded-sm p-3">
          <span className="font-medium">Admin feedback:</span> {event.feedback}
        </p>
      )}

      <div className="mt-3 max-w-xs">
        <CapacityBar capacity={event.capacity} currentBookings={event.currentBookings} />
      </div>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}

      <div className="flex gap-3 items-center mt-3">
        {EDITABLE_STATUSES.includes(event.status) && (
          <Link to={`/organizer/events/${event.id}/edit`} className="text-accent text-sm">Edit</Link>
        )}
        <Link to={`/organizer/events/${event.id}/participants`} className="text-accent text-sm">
          Participants
        </Link>

        {event.status === 'pending' && !confirmingCancel && (
          <Button variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>
            Cancel event
          </Button>
        )}
        {event.status === 'pending' && confirmingCancel && (
          <span className="flex gap-2 items-center">
            <span className="text-sm text-text">Cancel this event?</span>
            <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleCancel}>
              Yes, cancel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)}>
              No
            </Button>
          </span>
        )}
      </div>
    </Card>
  );
};

const MyEvents = () => {
  const [events, setEvents] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api
      .get('/events/my-events')
      .then(({ data }) => {
        if (active) setEvents(data.data);
      })
      .catch(() => {
        if (active) {
          setEvents([]);
          setError('Could not load your events. Please try again.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCancelled = (eventId) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: 'cancelled' } : e))
    );
  };

  return (
    <div className="p-4 sm:p-10">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="font-display text-2xl text-text">My Events</h1>
        <Link to="/organizer/events/new">
          <Button>+ Create Event</Button>
        </Link>
      </div>

      {events === null && <p className="text-text-muted">Loading your events…</p>}
      {events !== null && error && <p className="text-danger">{error}</p>}
      {events !== null && !error && events.length === 0 && (
        <p className="text-text-muted">You haven't created any events yet.</p>
      )}

      {events !== null && !error && events.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          {events.map((event) => (
            <MyEventRow key={event.id} event={event} onCancelled={handleCancelled} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyEvents;
