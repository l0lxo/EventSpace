import { useEffect, useState } from 'react';
import api from '../../utils/api';
import Card from '../../components/shared/Card';

const SummaryCard = ({ label, value }) => (
  <Card>
    <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-mono text-text mt-2">{value}</p>
  </Card>
);

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api
      .get('/admin/analytics')
      .then(({ data }) => {
        if (active) setAnalytics(data);
      })
      .catch(() => {
        if (active) setError('Could not load analytics. Please try again.');
      });

    return () => {
      active = false;
    };
  }, []);

  if (analytics === null && !error) {
    return <p className="p-4 sm:p-10 text-text-muted">Loading analytics…</p>;
  }

  if (error) {
    return <p className="p-4 sm:p-10 text-danger">{error}</p>;
  }

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-5">Admin Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <SummaryCard label="Total Events" value={analytics.totalEvents} />
        <SummaryCard label="Total Bookings" value={analytics.totalBookings} />
        <SummaryCard label="Total Users" value={analytics.totalUsers} />
        <SummaryCard label="Upcoming Events" value={analytics.upcomingEventsCount} />
        <SummaryCard label="Avg Bookings / Event" value={analytics.averageBookingsPerEvent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display text-lg text-text mb-3">Events by Status</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(analytics.eventsByStatus).map(([status, count]) => (
                <tr key={status} className="border-b border-border last:border-0">
                  <td className="py-2 text-text-muted capitalize">{status}</td>
                  <td className="py-2 font-mono text-text text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="font-display text-lg text-text mb-3">Users by Role</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(analytics.usersByRole).map(([role, count]) => (
                <tr key={role} className="border-b border-border last:border-0">
                  <td className="py-2 text-text-muted capitalize">{role}</td>
                  <td className="py-2 font-mono text-text text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg text-text mb-3">Popular Categories</h2>
          {analytics.popularCategories.length === 0 ? (
            <p className="text-text-muted text-sm">No approved events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Events</th>
                  <th className="py-2 text-right">Bookings</th>
                </tr>
              </thead>
              <tbody>
                {analytics.popularCategories.map((c) => (
                  <tr key={c.category} className="border-b border-border last:border-0">
                    <td className="py-2 text-text">{c.category}</td>
                    <td className="py-2 font-mono text-text-muted text-right">{c.eventCount}</td>
                    <td className="py-2 font-mono text-text-muted text-right">{c.totalBookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
