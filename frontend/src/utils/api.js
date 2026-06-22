/**
 * src/utils/api.js
 *
 * Single Axios instance every page/context uses to talk to the backend —
 * never call axios directly from a component. Centralizing it here means
 * the JWT attachment and the 401-auto-logout behavior apply everywhere
 * automatically, instead of every page remembering to do it itself.
 *
 * Token storage lives here (not in AuthContext) so this file has no
 * dependency on React or the context tree — it can be imported and used
 * from anywhere, including outside components.
 */

import axios from 'axios';

export const TOKEN_KEY = 'eventspace_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 here means the token is missing/invalid/expired — the backend's
// `protect` middleware already re-verified against the DB, so this isn't
// a fluke. Clear the stale token and bounce to login rather than leaving
// the app stuck in a logged-in-looking-but-broken state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
