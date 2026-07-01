import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';
import Card from '../components/shared/Card';

const MAX_POLLS = 5;
const POLL_INTERVAL_MS = 3000;

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') //?? searchParams.get('trxref');

  const [status, setStatus] = useState('pending'); // pending | success | failed | error
  const [bookingStatus, setBookingStatus] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    let timer;

    const poll = () => {
      api
        .get(`/payments/verify/${encodeURIComponent(reference)}`)
        .then(({ data }) => {
          if (cancelled) return;
          setBookingStatus(data.bookingStatus);

          if (data.status === 'success') {
            setStatus('success');
          } else if (data.status === 'failed' || data.status === 'abandoned') {
            setStatus('failed');
          } else {
            // still pending — retry up to MAX_POLLS times
            setPollCount((n) => {
              const next = n + 1;
              if (next >= MAX_POLLS) {
                setTimedOut(true);
              } else {
                timer = setTimeout(poll, POLL_INTERVAL_MS);
              }
              return next;
            });
          }
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        {status === 'pending' && !timedOut && (
          <>
            <p className="font-display text-lg text-text mb-2">Verifying payment…</p>
            <p className="text-sm text-text-muted">Please wait while we confirm your payment.</p>
          </>
        )}

        {status === 'pending' && timedOut && (
          <>
            <p className="font-display text-lg text-text mb-2">Still verifying…</p>
            <p className="text-sm text-text-muted mb-4">
              This is taking longer than expected. Check your email — if payment succeeded
              your ticket will arrive shortly. If you don't hear back, please contact support.
            </p>
            <Link to="/my-bookings" className="text-text underline text-sm">
              View my bookings
            </Link>
          </>
        )}

        {status === 'success' && (
          <>
            <p className="font-display text-lg text-success mb-2">Payment confirmed</p>
            <p className="text-sm text-text-muted mb-4">
              Your booking is confirmed. Check your email for your ticket.
            </p>
            <Link to="/my-bookings" className="text-text underline text-sm">
              View my bookings
            </Link>
          </>
        )}

        {status === 'failed' && (
          <>
            <p className="font-display text-lg text-danger mb-2">Payment not completed</p>
            <p className="text-sm text-text-muted mb-4">
              Your seat has been released. Please try booking again.
            </p>
            <Link to="/events" className="text-text underline text-sm">
              Browse events
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="font-display text-lg text-danger mb-2">Something went wrong</p>
            <p className="text-sm text-text-muted mb-4">
              We could not verify your payment. Please check your email or contact support.
            </p>
            <Link to="/events" className="text-text underline text-sm">
              Browse events
            </Link>
          </>
        )}
      </Card>
    </div>
  );
};

export default PaymentCallback;
