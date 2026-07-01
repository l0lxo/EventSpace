import { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { NotificationContext } from './notification-context';

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);

  const currentUserId = currentUser?.id ?? null;
  const [prevUserId, setPrevUserId] = useState(currentUserId);

  // React-recommended pattern: setState during render resets derived state without
  // a useEffect, avoiding cascading renders. React bails out immediately and
  // re-renders this component once more before committing — children are unaffected.
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setNotifications([]);
  }

  useEffect(() => {
    if (!currentUser) return undefined;
    let active = true;

    api
      .get('/notifications')
      .then(({ data }) => {
        if (active) setNotifications(data.data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNewNotification = ({ notification }) => {
      setNotifications((prev) => [notification, ...prev]);
    };

    socket.on('new_notification', handleNewNotification);
    return () => socket.off('new_notification', handleNewNotification);
  }, [socket]);

  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    api.patch(`/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    api.patch('/notifications/read-all').catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const contextValue = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead }),
    [notifications, unreadCount, markRead, markAllRead]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};
