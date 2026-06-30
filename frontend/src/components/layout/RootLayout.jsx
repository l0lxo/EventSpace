import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from './NotificationBell';

const navLinkClass = ({ isActive }) =>
  `text-on-accent transition-opacity hover:opacity-80 ${isActive ? 'font-semibold underline underline-offset-4' : 'opacity-90'}`;

const RootLayout = () => {
  const { currentUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { state: { loggedOut: true } });
  };

  const navLinks = (
    <>
      <NavLink to="/events" className={navLinkClass} onClick={closeMenu}>Browse Events</NavLink>
      {currentUser?.role === 'student' && (
        <NavLink to="/my-bookings" className={navLinkClass} onClick={closeMenu}>My Bookings</NavLink>
      )}
      {currentUser?.role === 'organizer' && (
        <>
          <NavLink to="/organizer/events" className={navLinkClass} onClick={closeMenu}>My Events</NavLink>
          <NavLink to="/organizer/events/new" className={navLinkClass} onClick={closeMenu}>Create Event</NavLink>
        </>
      )}
      {currentUser?.role === 'admin' && (
        <>
          <NavLink to="/admin" className={navLinkClass} onClick={closeMenu}>Dashboard</NavLink>
          <NavLink to="/admin/pending" className={navLinkClass} onClick={closeMenu}>Pending Queue</NavLink>
          <NavLink to="/admin/users" className={navLinkClass} onClick={closeMenu}>Users</NavLink>
          <NavLink to="/admin/reports" className={navLinkClass} onClick={closeMenu}>Reports</NavLink>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-bg">
      <nav className="sticky top-0 z-50 bg-accent text-on-accent px-4 sm:px-6 py-4 font-body text-[15px]">
        <div className="flex items-center gap-4">
          <Link to="/events" className="font-display text-xl font-semibold text-on-accent">
            EventSpace
          </Link>

          <div className="hidden md:flex flex-wrap gap-x-4 gap-y-2 items-center flex-1">
            {navLinks}
          </div>

          <div className="hidden md:flex gap-4 items-center ml-auto">
            {currentUser ? (
              <>
                <NotificationBell />
                <span className="hidden sm:inline text-on-accent/70">
                  {currentUser.name} ({currentUser.role})
                </span>
                <button onClick={handleLogout} className="text-on-accent hover:opacity-80 transition-opacity">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navLinkClass}>Login</NavLink>
                <NavLink to="/register" className={navLinkClass}>Register</NavLink>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center gap-3 ml-auto">
            {currentUser && <NotificationBell />}
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="text-on-accent"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden flex flex-col gap-3 mt-3 pt-3 border-t border-white/25">
            {navLinks}
            <div className="flex flex-col gap-3 pt-3 border-t border-white/25">
              {currentUser ? (
                <>
                  <span className="text-on-accent/70">{currentUser.name} ({currentUser.role})</span>
                  <button
                    onClick={() => { closeMenu(); handleLogout(); }}
                    className="text-on-accent text-left hover:opacity-80 transition-opacity"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navLinkClass} onClick={closeMenu}>Login</NavLink>
                  <NavLink to="/register" className={navLinkClass} onClick={closeMenu}>Register</NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
      <Outlet />
    </div>
  );
};

export default RootLayout;
