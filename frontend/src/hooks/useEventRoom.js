import { useEffect } from 'react';
import { useSocket } from './useSocket';

// joins the event's room for capacity/status broadcasts; caller attaches its own listeners
export const useEventRoom = (eventId) => {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !eventId) return undefined;

    socket.emit('join_event_room', { eventId });

    return () => {
      socket.emit('leave_event_room', { eventId });
    };
  }, [socket, eventId]);

  return socket;
};
