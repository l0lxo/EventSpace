import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import Card from '../shared/Card';
import Button from '../shared/Button';
import CapacityBar from './CapacityBar';
import { getPosterUrl } from '../../utils/media';

const EventCard = ({ event, onDeleted }) => {
  const { currentUser } = useAuth();
  const organizerName = event.createdBy?.organizationName || event.createdBy?.name;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = () => {
    setIsDeleting(true);
    setError('');
    api
      .delete(`/admin/events/${event.id}`)
      .then(() => onDeleted?.(event.id))
      .catch((err) => setError(err.response?.data?.message ?? 'Could not delete this event.'))
      .finally(() => setIsDeleting(false));
  };

  return (
    // Card is the outer element (not the Link) so the admin delete control
    // below can sit as a sibling rather than a button nested inside an <a> —
    // nesting interactive elements inside a Link is invalid HTML and makes
    // click handling unreliable
    <Card className="cursor-pointer hover:border-accent hover:-translate-y-[3px] transition-[transform,border-color] duration-200 ease-out h-full flex flex-col">
      <Link to={`/events/${event.id}`} className="flex-1 flex flex-col">
        {event.posterUrl && (
          <img
            src={getPosterUrl(event.posterUrl)}
            alt=""
            className="w-full h-48 object-cover rounded-sm border border-border mb-3"
          />
        )}
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
          {event.category}
        </p>
        <h3 className="font-display text-lg text-text">{event.title}</h3>
        <p className="text-sm text-text-muted mt-1">{organizerName}</p>

        <p className="text-sm font-mono text-text mt-3">
          {format(parseISO(event.date), 'MMM d, yyyy')} · {event.time}
        </p>
        <p className="text-sm text-text-muted">{event.location}</p>

        <div className="mt-auto pt-4">
          <CapacityBar capacity={event.capacity} currentBookings={event.currentBookings} />
        </div>
      </Link>

      {currentUser?.role === 'admin' && (
        <div className="mt-3 pt-3 border-t border-border">
          {!confirmingDelete && (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete event
            </Button>
          )}
          {confirmingDelete && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-text">
                Delete this event? This will notify all attendees and the organizer.
              </span>
              <Button variant="danger" size="sm" isLoading={isDeleting} onClick={handleDelete}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                No
              </Button>
            </div>
          )}
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </div>
      )}
    </Card>
  );
};

export default EventCard;
