import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import EventForm from '../../components/events/EventForm';

const EDITABLE_STATUSES = ['pending', 'modification_requested'];

const toFormValues = (event) => ({
  title: event.title,
  description: event.description,
  date: format(parseISO(event.date), 'yyyy-MM-dd'),
  time: event.time,
  location: event.location,
  capacity: event.capacity,
  category: event.category,
  fundingRequested: event.fundingRequest?.requested ?? false,
  fundingBudget: event.fundingRequest?.budget ?? '',
  fundingJustification: event.fundingRequest?.justification ?? '',
  guestsRequested: event.externalGuests?.requested ?? false,
  guestsReason: event.externalGuests?.reason ?? '',
  posterUrl: event.posterUrl ?? null,
});

const EditEvent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState(null);
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
  }, [id]);

  const handleSubmit = async (payload) => {
    await api.put(`/events/${id}`, payload);
    navigate('/organizer/events');
  };

  if (isLoading) {
    return <p className="p-4 sm:p-10 text-text-muted">Loading event…</p>;
  }

  if (error || !event) {
    return (
      <div className="p-4 sm:p-10">
        <p className="text-danger">{error || 'Event not found.'}</p>
        <Link to="/organizer/events" className="text-accent text-sm">← Back to my events</Link>
      </div>
    );
  }

  if (!EDITABLE_STATUSES.includes(event.status)) {
    return (
      <div className="p-4 sm:p-10">
        <p className="text-danger">
          This event can no longer be edited (current status: {event.status}).
        </p>
        <Link to="/organizer/events" className="text-accent text-sm">← Back to my events</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">Edit Event</h1>
      <EventForm
        key={event.id}
        defaultValues={toFormValues(event)}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
        enforceAdvanceNotice={false}
      />
    </div>
  );
};

export default EditEvent;
