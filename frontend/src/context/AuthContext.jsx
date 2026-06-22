/**
 * src/context/AuthContext.jsx
 *
 * Single source of truth for "who is logged in" across the app. On mount,
 * if a token is already in localStorage (left over from a previous visit),
 * it calls GET /auth/me to restore the session — this is what makes a
 * page refresh not log the user out. `isLoading` covers that initial
 * restore so ProtectedRoute can wait for it instead of redirecting to
 * /login on every refresh before the check finishes.
 */

import { useEffect, useState } from 'react';
import api, { getToken, setToken, clearToken } from '../utils/api';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      if (!getToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setCurrentUser(data.user);
      } catch {
        clearToken();
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setCurrentUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setToken(data.token);
    setCurrentUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Stateless JWT — there's nothing the server can fail to do that
      // would justify keeping the client logged in. Clear locally regardless.
    }
    clearToken();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
