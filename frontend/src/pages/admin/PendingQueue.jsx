import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import { getPosterUrl } from '../../utils/media';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import EventReviewModal from '../../components/admin/EventReviewModal';

const PendingQueue = () => {
  const [events, setEvents] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [reviewingEvent, setReviewingEvent] = useState(null);

  useEffect(() => {
    let active = true;

    api
      .get('/events/pending')
      .then(({ data }) => {
        if (active) setEvents(data.data);
      })
      .catch(() => {
        if (active) {
          setEvents([]);
          setError('Could not load the review queue. Please try again.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleReviewed = (eventId) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setReviewingEvent(null);
  };

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">Pending Events Review Queue</h1>

      {events === null && <p className="text-text-muted">Loading…</p>}
      {events !== null && error && <p className="text-danger">{error}</p>}
      {events !== null && !error && events.length === 0 && (
        <p className="text-text-muted">No events awaiting review.</p>
      )}

      {events !== null && !error && events.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          {events.map((event) => (
            <Card key={event.id}>
              <div className="flex gap-4">
                {event.posterUrl && (
                  <img
                    src={getPosterUrl(event.posterUrl)}
                    alt=""
                    className="w-20 h-20 object-cover rounded-sm border border-border flex-shrink-0"
                  />
                )}
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    {event.category}
                  </p>
                  <h3 className="font-display text-lg text-text">{event.title}</h3>
                  <p className="text-sm text-text-muted mt-1">
                    Submitted by {event.createdBy?.name} ({event.createdBy?.email})
                  </p>
                  <p className="text-sm font-mono text-text mt-2">
                    {format(parseISO(event.date), 'MMM d, yyyy')} · {event.time} · {event.location}
                  </p>
                  <p className="text-sm text-text-muted mt-1">
                    Submitted {format(parseISO(event.createdDate), 'MMM d, yyyy')} — review by{' '}
                    <span className="font-medium text-text">
                      {format(parseISO(event.reviewDeadline), 'MMM d, yyyy')}
                    </span>
                  </p>
                </div>
              </div>

              {(event.fundingRequest?.requested || event.externalGuests?.requested) && (
                <div className="flex gap-2 mt-3">
                  {event.fundingRequest?.requested && (
                    <span className="text-xs border border-border rounded-sm px-2 py-0.5 text-text-muted">
                      Funding requested: KES {event.fundingRequest.budget}
                    </span>
                  )}
                  {event.externalGuests?.requested && (
                    <span className="text-xs border border-border rounded-sm px-2 py-0.5 text-text-muted">
                      External guests requested
                    </span>
                  )}
                </div>
              )}

              <Button size="sm" className="mt-3" onClick={() => setReviewingEvent(event)}>
                Review
              </Button>
            </Card>
          ))}
        </div>
      )}

      {reviewingEvent && (
        <EventReviewModal
          event={reviewingEvent}
          onClose={() => setReviewingEvent(null)}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  );
};

export default PendingQueue;
