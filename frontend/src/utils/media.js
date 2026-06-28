// VITE_SOCKET_URL is the bare backend origin (no /api suffix) — reused here
// since posterUrl comes back as a relative path like /uploads/posters/...
const SERVER_ORIGIN = import.meta.env.VITE_SOCKET_URL;

export const getPosterUrl = (posterUrl) => (posterUrl ? `${SERVER_ORIGIN}${posterUrl}` : null);
