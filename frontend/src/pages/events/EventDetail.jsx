import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import { getPosterUrl } from '../../utils/media';
import Card from '../../components/shared/Card';
import CapacityBar from '../../components/events/CapacityBar';
import BookingAction from '../../components/events/BookingAction';
import { useEventRoom } from '../../hooks/useEventRoom';

const EventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [pulseTick, setPulseTick] = useState(0);
  // derive loading from whether the id changed since the last successful fetch
  const [loadedFor, setLoadedFor] = useState(null);
  const [refetchKey, setRefetchKey] = useState(0);
  const isLoading = loadedFor !== id;

  useEffect(() => {
    let active = true;
    
    api
      .get(`/events/${id}`)
      .then(({ data }) => {
        if (!active) return;
        setEvent(data.event);
        setError('');
        setLoadedFor(id);
      })
      .catch((err) => {
        if (!active) return;
        setEvent(null);
        setError(err.response?.data?.message ?? 'Could not load this event.');
        setLoadedFor(id);
      });

    return () => {
      active = false;
    };
  }, [id, refetchKey]);

  // Live updates for anyone viewing this page — including other students'
  // bookings/cancellations and an admin force-cancelling mid-visit.
  const socket = useEventRoom(id);
  useEffect(() => {
    if (!socket) return undefined;

    const handleCapacityUpdated = (payload) => {
      if (payload.eventId !== id) return;
      setEvent((prev) => (prev ? { ...prev, currentBookings: payload.currentBookings } : prev));
      setPulseTick((t) => t + 1);
    };
    const handleStatusChanged = (payload) => {
      if (payload.eventId !== id) return;
      setEvent((prev) => (prev ? { ...prev, status: payload.status } : prev));
    };
    const handleDetailsUpdated = (payload) => {
      if (payload.eventId !== id) return;
      setLoadedFor(null);
      setRefetchKey((k) => k + 1);
    };

    socket.on('capacity_updated', handleCapacityUpdated);
    socket.on('event_status_changed', handleStatusChanged);
    socket.on('event_details_updated', handleDetailsUpdated);

    return () => {
      socket.off('capacity_updated', handleCapacityUpdated);
      socket.off('event_status_changed', handleStatusChanged);
      socket.off('event_details_updated', handleDetailsUpdated);
    };
  }, [socket, id]);

  if (isLoading) {
    return <p className="p-4 sm:p-10 text-text-muted">Loading event…</p>;
  }

  if (error || !event) {
    return (
      <div className="p-4 sm:p-10">
        <p className="text-danger">{error || 'Event not found.'}</p>
        <Link to="/events" className="text-text underline text-sm">← Back to events</Link>
      </div>
    );
  }

  const organizerName = event.createdBy?.organizationName || event.createdBy?.name;

  return (
    <div className="p-4 sm:p-10">
      <Link to="/events" className="text-text underline text-sm">← Back to events</Link>

      <Card className="max-w-2xl mt-4">
        {event.posterUrl && (
          <img
            src={getPosterUrl(event.posterUrl)}
            alt=""
            className="w-full h-56 object-cover rounded-sm border border-border mb-4"
          />
        )}
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
          {event.category}
        </p>
        <h1 className="font-display text-2xl text-text">{event.title}</h1>
        <p className="text-sm text-text-muted mt-1">Organized by {organizerName}</p>

        <div className="mt-4 space-y-1">
          <p className="text-sm font-mono text-text">
            {format(parseISO(event.date), 'EEEE, MMM d, yyyy')} · {event.time}
          </p>
          <p className="text-sm text-text-muted">{event.location}</p>
        </div>

        <p className="text-sm text-text mt-4 whitespace-pre-wrap">{event.description}</p>

        <div className="mt-5 max-w-xs">
          <CapacityBar capacity={event.capacity} currentBookings={event.currentBookings} pulseTick={pulseTick} />
        </div>

        {event.status === 'cancelled' ? (
          <p className="text-sm text-danger mt-5">This event has been cancelled.</p>
        ) : (
          <div className="mt-5">
            <BookingAction
              event={event}
              onBooked={(seatsRemaining) =>
                setEvent((prev) => ({ ...prev, currentBookings: prev.capacity - seatsRemaining }))
              }
              onCancelled={(seatsRemaining) =>
                setEvent((prev) => ({ ...prev, currentBookings: prev.capacity - seatsRemaining }))
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default EventDetail;
