import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import Card from '../shared/Card';
import CapacityBar from './CapacityBar';

const EventCard = ({ event }) => {
  const organizerName = event.createdBy?.organizationName || event.createdBy?.name;

  return (
    <Link to={`/events/${event.id}`}>
      <Card className="hover:border-accent transition-colors h-full flex flex-col">
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
      </Card>
    </Link>
  );
};

export default EventCard;
