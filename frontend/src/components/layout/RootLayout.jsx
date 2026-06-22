/**
 * src/components/layout/RootLayout.jsx
 *
 * Temporary nav shell wrapping every route so the full route tree is
 * actually clickable while pages are still placeholders (Phase 1 goal:
 * prove routing/role-gating works before building real pages). The real
 * navbar (with the notification bell, per PROJECT_HANDOFF.md section 4
 * cross-cutting list) replaces this in a later phase.
 */

import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const RootLayout = () => {
  const { currentUser, logout } = useAuth();

  return (
    <div className="min-h-screen bg-bg">
      <nav className="border-b border-border px-6 py-3 flex gap-4 items-center text-sm font-body">
        <Link to="/" className="text-accent">Browse Events</Link>
        {currentUser?.role === 'student' && (
          <Link to="/my-bookings" className="text-accent">My Bookings</Link>
        )}
        {currentUser?.role === 'organizer' && (
          <>
            <Link to="/organizer/events" className="text-accent">My Events</Link>
            <Link to="/organizer/events/new" className="text-accent">Create Event</Link>
          </>
        )}
        {currentUser?.role === 'admin' && (
          <>
            <Link to="/admin" className="text-accent">Dashboard</Link>
            <Link to="/admin/pending" className="text-accent">Pending Queue</Link>
            <Link to="/admin/users" className="text-accent">Users</Link>
            <Link to="/admin/reports" className="text-accent">Reports</Link>
          </>
        )}
        <div className="ml-auto flex gap-4 items-center">
          {currentUser ? (
            <>
              <span className="text-text-muted">{currentUser.name} ({currentUser.role})</span>
              <button onClick={logout} className="text-accent">Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-accent">Login</Link>
              <Link to="/register" className="text-accent">Register</Link>
            </>
          )}
        </div>
      </nav>
      <Outlet />
    </div>
  );
};

export default RootLayout;
