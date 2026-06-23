import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { EVENT_CATEGORIES } from '../../utils/constants';
import Input from '../../components/shared/Input';
import Select from '../../components/shared/Select';
import Button from '../../components/shared/Button';
import EventCard from '../../components/events/EventCard';

const EMPTY_FILTERS = { search: '', category: '', startDate: '', endDate: '', location: '' };

const buildRequestKey = (filters, page) => JSON.stringify({ filters, page });

const EventsBrowse = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], count: 0, totalPages: 1 });
  const [error, setError] = useState('');
  const [loadedKey, setLoadedKey] = useState(null);

  // reset pagination during render when filters change, rather than in an effect
  const [prevAppliedFilters, setPrevAppliedFilters] = useState(appliedFilters);
  if (appliedFilters !== prevAppliedFilters) {
    setPrevAppliedFilters(appliedFilters);
    setPage(1);
  }

  const requestKey = buildRequestKey(appliedFilters, page);
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    const timeout = setTimeout(() => setAppliedFilters(filters), 300);
    return () => clearTimeout(timeout);
  }, [filters]);

  useEffect(() => {
    let active = true;
    const key = buildRequestKey(appliedFilters, page);

    const params = { page };
    Object.entries(appliedFilters).forEach(([filterKey, value]) => {
      if (value) params[filterKey] = value;
    });

    api
      .get('/events', { params })
      .then(({ data }) => {
        if (!active) return;
        setResult(data);
        setError('');
        setLoadedKey(key);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load events. Please try again.');
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">Browse Events</h1>

      <div className="flex flex-wrap gap-3 items-end mb-6">
        <Input
          label="Search"
          placeholder="Title or description"
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-48"
        />
        <Select
          label="Category"
          value={filters.category}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="w-44"
        >
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </Select>
        <Input
          label="From"
          type="date"
          value={filters.startDate}
          onChange={(e) => updateFilter('startDate', e.target.value)}
          className="w-40"
        />
        <Input
          label="To"
          type="date"
          value={filters.endDate}
          onChange={(e) => updateFilter('endDate', e.target.value)}
          className="w-40"
        />
        <Input
          label="Location"
          value={filters.location}
          onChange={(e) => updateFilter('location', e.target.value)}
          className="w-40"
        />
        <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      </div>

      {isLoading && <p className="text-text-muted">Loading events…</p>}
      {!isLoading && error && <p className="text-danger">{error}</p>}
      {!isLoading && !error && result.data.length === 0 && (
        <p className="text-text-muted">No events found.</p>
      )}

      {!isLoading && !error && result.data.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {result.data.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {result.totalPages > 1 && (
            <div className="flex gap-3 items-center justify-center mt-8">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm font-mono text-text-muted">
                Page {page} of {result.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventsBrowse;
