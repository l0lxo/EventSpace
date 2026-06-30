import { useEffect, useState } from 'react';
import api from '../../utils/api';
import Select from '../../components/shared/Select';
import SkeletonCard from '../../components/shared/SkeletonCard';
import BookingListItem from '../../components/bookings/BookingListItem';

const buildRequestKey = (status) => status || 'all';

const MyBookings = () => {
  const [status, setStatus] = useState('');
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loadedKey, setLoadedKey] = useState(null);
  const isLoading = loadedKey !== buildRequestKey(status);

  useEffect(() => {
    let active = true;
    const key = buildRequestKey(status);
    const params = status ? { status } : {};

    api
      .get('/bookings/my-bookings', { params })
      .then(({ data }) => {
        if (!active) return;
        setBookings(data.data);
        setError('');
        setLoadedKey(key);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load your bookings. Please try again.');
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [status]);

  const handleCancelled = (bookingId) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    );
  };

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">My Bookings</h1>

      <Select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-44 mb-6"
      >
        <option value="">All</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
      </Select>

      {isLoading && (
        <div className="space-y-4 max-w-2xl">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {!isLoading && error && <p className="text-danger">{error}</p>}
      {!isLoading && !error && bookings.length === 0 && (
        <p className="text-text-muted">No bookings found.</p>
      )}

      {!isLoading && !error && bookings.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          {bookings.map((booking) => (
            <BookingListItem key={booking.id} booking={booking} onCancelled={handleCancelled} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
