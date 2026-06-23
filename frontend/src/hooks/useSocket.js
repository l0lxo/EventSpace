import { useContext } from 'react';
import { SocketContext } from '../context/socket-context';

// Intentionally no provider-missing check, unlike useAuth — null is a
// valid, expected state here (still connecting, or briefly disconnected).
export const useSocket = () => useContext(SocketContext);
