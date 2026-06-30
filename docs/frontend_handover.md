# EventSpace — Frontend Build Guide

This is your roadmap. The backend is fully built and tested — every route
described below is real, working, and already handling auth, validation,
capacity limits, emails, and real-time updates. You're building the UI
that talks to it.

---

## 0. Before you write any component code

### Pull the latest backend code and run it locally

```bash
cd backend
npm install
npm run dev
```

Confirm you see:
```
MongoDB connected successfully
Nodemailer is configured correctly and ready to send emails
[Reminder Cron] Scheduled — will run at the top of every hour.
Server running on port 5001
```

Get your own `.env` values from your partner (the `MONGO_URI`, `JWT_SECRET`)
— you both need to point at the same database while developing together,
or you'll each be looking at empty/different data.

### Set up your frontend environment file

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5001/api
VITE_SOCKET_URL=http://localhost:5001
```

### Seed some test data

Ask your partner for `docs/SAMPLE_CURL_COMMANDS.md` — running through that
gives you real students, organizers, an admin, and several approved events
already sitting in the database, so your screens have actual data to render
from day one instead of empty states.

### Install your dependencies

```bash
cd frontend
npm install axios react-router-dom socket.io-client react-hook-form date-fns
```

---

## 1. Build order — follow this sequence

Don't jump to admin screens before auth works, and don't build booking
before the event list works. Each phase below depends on the previous one
actually functioning.

### Phase 1 — Auth (do this first, nothing else works without it)
- Login page
- Register page (with role selection: student / organizer)
- Auth context (global state: current user, token, login/logout functions)
- Protected route wrapper (redirects to login if no token)
- Axios instance with the token automatically attached to every request

### Phase 2 — Student: browsing & booking (the core user journey)
- Events list page (search, filter by category/date/location, pagination)
- Event detail page
- Book button + cancel button
- Booking history page

### Phase 3 — Organizer
- Create event form (with the 14-day rule shown clearly in the UI)
- My events list (with status badges: pending/approved/rejected/etc.)
- Participant list view
- CSV export button

### Phase 4 — Admin
- Pending events review queue
- Approve/reject/request-modification actions
- User management table (search, filter, disable, delete)
- Analytics dashboard
- Participation reports

### Phase 5 — Real-time layer
- Socket.io connection setup
- Live seat-count updates on the event detail page
- Live notification bell/dropdown

### Phase 6 — Polish
- Loading states, error states, empty states everywhere
- Responsive design pass (mobile/tablet breakpoints)
- Toast notifications for success/error feedback

---

## 2. The API — what you're actually calling

Full reference: `docs/API_CONTRACT.md` in the repo root. Read that file
before building each screen — it has the exact request/response shape for
every endpoint. Below is the condensed version with the things you'll hit
immediately.

### Base URL
```
http://localhost:5001/api
```

### Auth header pattern
Every protected request needs:
```
Authorization: Bearer <token>
```

### Endpoints by screen

| Screen | Method | Endpoint |
|---|---|---|
| Login | POST | `/auth/login` |
| Register | POST | `/auth/register` |
| Restore session on app load | GET | `/auth/me` |
| Events list | GET | `/events?search=&category=&startDate=&endDate=&location=&page=` |
| Event detail | GET | `/events/:id` |
| Create event | POST | `/events` |
| Edit event | PUT | `/events/:id` |
| Cancel event | DELETE | `/events/:id` |
| My events (organizer) | GET | `/events/my-events` |
| Pending queue (admin) | GET | `/events/pending` |
| Approve/reject (admin) | PATCH | `/events/:id/review` |
| Book event | POST | `/bookings` |
| Cancel booking | DELETE | `/bookings/:id` |
| Booking history | GET | `/bookings/my-bookings?status=` |
| Participant list | GET | `/bookings/event/:eventId` |
| CSV export | GET | `/bookings/event/:eventId/export` |
| Analytics | GET | `/admin/analytics` |
| Participation report | GET | `/admin/reports/participation` |
| User list | GET | `/admin/users?role=&search=` |
| Disable user | PATCH | `/admin/users/:id/disable` |
| Delete user | DELETE | `/admin/users/:id` |
| Moderate event | PATCH | `/admin/events/:id/moderate` |
| Notifications | GET | `/notifications?isRead=` |
| Mark read | PATCH | `/notifications/:id/read` |
| Mark all read | PATCH | `/notifications/read-all` |

### Important field names to get right
- IDs come back as `id`, not `_id` — the backend already transforms this for you
- Event `status` values: `pending`, `approved`, `rejected`, `modification_requested`, `cancelled`
- Booking `status` values: `confirmed`, `cancelled`
- User `role` values: `student`, `organizer`, `admin`
- Event `category` is a fixed enum, not free text: `Technology`, `Sports`, `Cultural`, `Academic`, `Social`, `Career`, `Religious`, `Other` — build this as a `<select>`, not a text input
- Dates are ISO strings (`"2026-08-15"`), times are `"HH:MM"` 24-hour strings, kept as two separate fields

---

## 3. Setting up the Axios instance (do this once, use everywhere)

Create `src/utils/api.js`:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Automatically attaches the JWT to every outgoing request, so you never
// have to manually add the Authorization header in individual components.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If any request comes back 401 (expired/invalid token), automatically
// log the user out and send them to login — instead of every component
// having to handle this case individually.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

Then in any component:
```javascript
import api from '../utils/api';

const { data } = await api.get('/events');
const { data } = await api.post('/bookings', { eventId });
```

---

## 4. Setting up Socket.io (Phase 5, but documented now)

```javascript
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  auth: { token: localStorage.getItem('token') },
});
```

**On an event detail page**, when it mounts:
```javascript
socket.emit('join_event_room', { eventId });

socket.on('capacity_updated', (data) => {
  if (data.eventId === eventId) {
    setSeatsRemaining(data.seatsRemaining);
  }
});

// Clean up when the component unmounts
return () => {
  socket.emit('leave_event_room', { eventId });
  socket.off('capacity_updated');
};
```

**Anywhere globally** (e.g. in your auth context, once logged in), for the
notification bell:
```javascript
socket.on('new_notification', (data) => {
  // push data.notification into your notifications state/badge count
});
```

The token you pass determines whether the socket is treated as a logged-in
user (joins their personal notification room automatically on the backend)
or anonymous (still receives public `capacity_updated` broadcasts, just not
personal notifications).

---

## 5. Common gotchas, so you don't lose time on them

- **CORS errors in the browser console** — almost always means your
  backend's `CLIENT_URL` in `.env` doesn't match your frontend's actual
  running port exactly (`http://localhost:5173`, not `5173` alone, not a
  trailing slash).
- **401 on every request even right after logging in** — check that the
  token is actually being saved to `localStorage` after login, and that
  your Axios interceptor is reading the same key name you saved it under.
- **A field that should be required isn't getting validated client-side**
  — the backend WILL reject it, but you should mirror those rules in your
  forms (react-hook-form validation rules) so users get instant feedback
  instead of waiting on a round trip to find out their event date is too soon.
- **The 14-day rule** — show the earliest valid date directly in the date
  picker (disable anything closer than 14 days) rather than letting people
  submit and then showing an error.
- **Category dropdown** — must use the exact enum strings above, case-sensitive.
- **Empty states** — every list screen (events, bookings, users, pending
  queue) needs a deliberate "nothing here yet" state, not a blank screen.

---

## 6. Questions to settle with your partner before you build certain screens

These were flagged as open decisions in the API contract — confirm the
final answer before building the UI around them:

1. **Cancellation window** — currently set to 24 hours before the event in
   the backend. Your "Cancel" button should be disabled/hidden once an
   event is inside that window, with a message explaining why.
2. **Modification-request flow** — when an organizer edits an event after
   an admin requests changes, it automatically goes back to `pending`
   status. Build the edit form to reflect this (e.g. "Resubmitting for
   review" confirmation).
3. **User deletion** — blocked entirely if the user has active bookings or
   (for organizers) events with active bookings; the API returns a clear
   error message in that case. Show that message directly instead of a
   generic "something went wrong."

---

## 7. Where things live in the repo

```
strathmore-events/
├── docs/
│   ├── API_CONTRACT.md              ← full endpoint reference, read this first
│   └── SAMPLE_CURL_COMMANDS.md      ← run these to seed test data
├── backend/                          ← fully built, don't need to touch this
└── frontend/                         ← you live here
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── context/                  ← AuthContext goes here
    │   ├── hooks/
    │   └── utils/
    │       └── api.js                ← the Axios instance from section 3
    └── .env                          ← VITE_API_URL, VITE_SOCKET_URL
```

---

## 8. Definition of done for each phase

Before moving to the next phase, confirm:
- [ ] **Phase 1**: You can register, log in, and the app remembers you on refresh
- [ ] **Phase 2**: A student can search, filter, book, see capacity, and cancel
- [ ] **Phase 3**: An organizer can submit an event and see its status change after admin review
- [ ] **Phase 4**: An admin can approve/reject and the analytics numbers match real data
- [ ] **Phase 5**: Two browser tabs open on the same event — booking in one updates the seat count in the other, live, with no refresh
- [ ] **Phase 6**: Resize the browser to phone width — nothing breaks or overlaps

If you get stuck on a specific endpoint's behavior, check
`docs/API_CONTRACT.md` first — every status code and error message you
might get back is documented there with exact response shapes.