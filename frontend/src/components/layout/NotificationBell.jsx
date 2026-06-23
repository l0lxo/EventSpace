import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useNotifications } from '../../hooks/useNotifications';

const NotificationBell = () => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((open) => !open)}
        className="relative text-text-muted hover:text-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none font-mono text-accent">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          {/* fixed+inset on mobile so it doesn't clip off the edge of the nav */}
          <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white border border-border rounded-md z-50">
            <div className="flex justify-between items-center px-4 py-2 border-b border-border">
              <span className="text-sm font-medium text-text">Notifications</span>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs text-accent">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-text-muted px-4 py-4">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border last:border-0 ${n.isRead ? '' : 'bg-surface'}`}
                  >
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="text-left w-full"
                      disabled={n.isRead}
                    >
                      <p className="text-sm text-text">{n.message}</p>
                      <p className="text-xs text-text-muted mt-1">
                        {formatDistanceToNow(parseISO(n.sentDate), { addSuffix: true })}
                      </p>
                    </button>
                    {n.relatedEvent && (
                      <Link
                        to={`/events/${n.relatedEvent.id}`}
                        className="text-xs text-accent mt-1 inline-block"
                        onClick={() => setIsOpen(false)}
                      >
                        View event
                      </Link>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
