import { useState } from 'react';
import api from '../../utils/api';
import Button from '../shared/Button';

const DECISIONS = [
  { value: 'approved', label: 'Approve', variant: 'success' },
  { value: 'rejected', label: 'Reject', variant: 'danger' },
  { value: 'modification_requested', label: 'Request changes', variant: 'warning' },
];

const EventReviewModal = ({ event, onClose, onReviewed }) => {
  const [decision, setDecision] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const feedbackRequired = decision === 'rejected' || decision === 'modification_requested';
  const canSubmit = decision && (!feedbackRequired || feedback.trim());

  const handleSubmit = () => {
    setIsSubmitting(true);
    setError('');
    api
      .patch(`/events/${event.id}/review`, {
        decision,
        feedback: feedbackRequired ? feedback : null,
      })
      .then(() => onReviewed(event.id))
      .catch((err) => setError(err.response?.data?.message ?? 'Could not submit review.'))
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-border rounded-md p-6 max-w-md w-full">
        <h2 className="font-display text-xl text-text mb-1">Review event</h2>
        <p className="text-sm text-text-muted mb-4">{event.title}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {DECISIONS.map((d) => (
            <Button
              key={d.value}
              variant={d.variant}
              size="sm"
              className={decision === d.value ? 'ring-2 ring-current ring-offset-1' : ''}
              onClick={() => setDecision(d.value)}
            >
              {d.label}
            </Button>
          ))}
        </div>

        {feedbackRequired && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-text mb-1">
              Feedback for the organizer
            </label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 text-sm font-body border border-border rounded-sm bg-white text-text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={DECISIONS.find((d) => d.value === decision)?.variant ?? 'primary'}
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            Submit review
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EventReviewModal;
