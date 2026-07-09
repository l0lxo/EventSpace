import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../../utils/api';
import { EVENT_CATEGORIES } from '../../utils/constants';
import Card from '../../components/shared/Card';
import Input from '../../components/shared/Input';
import Select from '../../components/shared/Select';
import Button from '../../components/shared/Button';

const buildRequestKey = (filters) => JSON.stringify(filters);

const EMPTY_FILTERS = { startDate: '', endDate: '', category: '' };

const Reports = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loadedKey, setLoadedKey] = useState(null);
  const isLoading = loadedKey !== buildRequestKey(appliedFilters);

  useEffect(() => {
    const timeout = setTimeout(() => setAppliedFilters(filters), 300);
    return () => clearTimeout(timeout);
  }, [filters]);

  useEffect(() => {
    let active = true;
    const key = buildRequestKey(appliedFilters);
    const params = {};
    Object.entries(appliedFilters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });

    api
      .get('/admin/reports/participation', { params })
      .then(({ data }) => {
        if (!active) return;
        setRows(data.data);
        setError('');
        setLoadedKey(key);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load the report. Please try again.');
        setLoadedKey(key);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleExport = () => {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Event', 'Date', 'Category', 'Capacity', 'Bookings', 'Cancellations', 'Fill Rate'];
    const lines = rows.map((row) => [
      escape(row.eventTitle),
      escape(format(parseISO(row.date), 'MMM d, yyyy')),
      escape(row.category),
      row.capacity,
      row.totalBookings,
      row.cancellations,
      escape(row.fillRate),
    ].join(','));

    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'participation-report.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-10">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h1 className="font-display text-2xl text-text">Participation Reports</h1>
        {!isLoading && !error && rows.length > 0 && (
          <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-6">
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
      </div>

      {isLoading && <p className="text-text-muted">Loading report…</p>}
      {!isLoading && error && <p className="text-danger">{error}</p>}
      {!isLoading && !error && rows.length === 0 && (
        <p className="text-text-muted">No approved events match these filters.</p>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4 text-right">Capacity</th>
                  <th className="py-2 pr-4 text-right">Bookings</th>
                  <th className="py-2 pr-4 text-right">Cancellations</th>
                  <th className="py-2 text-right">Fill rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.eventId} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-text">{row.eventTitle}</td>
                    <td className="py-2 pr-4 font-mono text-text-muted">
                      {format(parseISO(row.date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-2 pr-4 text-text-muted">{row.category}</td>
                    <td className="py-2 pr-4 font-mono text-text-muted text-right">{row.capacity}</td>
                    <td className="py-2 pr-4 font-mono text-text-muted text-right">{row.totalBookings}</td>
                    <td className="py-2 pr-4 font-mono text-text-muted text-right">{row.cancellations}</td>
                    <td className="py-2 font-mono text-text text-right">{row.fillRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Reports;
