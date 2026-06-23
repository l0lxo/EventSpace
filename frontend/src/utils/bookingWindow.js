// Mirrors CANCELLATION_WINDOW_HOURS in backend/routes/bookings.js — this
// client-side check only hides a Cancel button that would otherwise 400;
// the backend remains the actual enforcement point.
export const CANCELLATION_WINDOW_HOURS = 24;

export const getEventDateTime = (event) => {
  const [hours, minutes] = event.time.split(':').map(Number);
  const dt = new Date(event.date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
};

export const canCancelBooking = (event) => {
  const hoursUntilEvent = (getEventDateTime(event) - new Date()) / (1000 * 60 * 60);
  return hoursUntilEvent >= CANCELLATION_WINDOW_HOURS;
};
