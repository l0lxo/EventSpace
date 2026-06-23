import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getToken } from '../utils/api';
import { SocketContext } from './socket-context';

export const SocketProvider = ({ children }) => {
  const { currentUser, isLoading } = useAuth();
  const [socket, setSocket] = useState(null);

  // reconnect on identity change so the backend re-joins the right user:${id} room;
  // connects even logged out since public browsing still needs capacity_updated broadcasts
  useEffect(() => {
    if (isLoading) return undefined;

    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      auth: { token: getToken() },
    });

    // only expose the socket once it's actually connected
    newSocket.on('connect', () => setSocket(newSocket));
    newSocket.on('disconnect', () => setSocket(null));

    return () => {
      newSocket.disconnect();
    };
  }, [isLoading, currentUser?.id]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};
