import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { NotificationContext } from './notification-context';

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);

  // reset on identity change, done during render so we don't setState synchronously in an effect
  const currentUserId = currentUser?.id ?? null;
  const [prevUserId, setPrevUserId] = useState(currentUserId);
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

  const markRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    api.patch('/notifications/read-all').catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};
