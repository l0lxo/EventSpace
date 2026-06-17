# Strathmore Events — API Contract

**Base URL (dev):** `http://localhost:5000/api`
**Auth scheme:** `Authorization: Bearer <token>` header on all protected routes
**Content-Type:** `application/json` unless noted (CSV export returns a file)

## Conventions used in this document

- `🔓 Public` — no token required
- `🔐 Auth` — any logged-in user
- `🎓 Student` — role must be `student`
- `🎤 Organizer` — role must be `organizer`
- `🛠 Admin` — role must be `admin`
- All dates are ISO 8601 strings: `"2026-07-15"`. Times are 24h strings: `"14:30"`.
- All IDs are MongoDB ObjectId strings.
- Every error response follows: `{ "message": "Human readable error" }`
- Every paginated list follows: `{ "data": [...], "count": n, "page": n, "totalPages": n }`

---

## 1. Authentication — `/api/auth`

### POST `/api/auth/register` 🔓
Register a new user. Email domain is validated server-side.

**Request body**
```json
{
  "name": "Jane Wanjiru",
  "email": "jane.wanjiru@strathmore.edu",
  "password": "minimum8chars",
  "role": "student",
  "studentID": "SM12345",
  "organizationName": null
}
```
Notes:
- `role` is one of `"student" | "organizer"`. Admins are never self-registered — seeded directly in the DB or promoted by another admin.
- `studentID` required if `role === "student"`.
- `organizationName` required if `role === "organizer"` (e.g. "Strathmore Drama Club").

**Response `201 Created`**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "64f1...",
    "name": "Jane Wanjiru",
    "email": "jane.wanjiru@strathmore.edu",
    "role": "student",
    "studentID": "SM12345",
    "organizationName": null
  }
}
```

**Errors**
| Code | Body | Reason |
|---|---|---|
| 400 | `{ "message": "Email must end with @strathmore.edu" }` | domain check failed |
| 400 | `{ "message": "Password must be at least 8 characters" }` | validation |
| 409 | `{ "message": "An account with this email already exists" }` | duplicate |

---

### POST `/api/auth/login` 🔓

**Request body**
```json
{
  "email": "jane.wanjiru@strathmore.edu",
  "password": "minimum8chars"
}
```

**Response `200 OK`**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "64f1...",
    "name": "Jane Wanjiru",
    "email": "jane.wanjiru@strathmore.edu",
    "role": "student"
  }
}
```

**Errors**
| Code | Body |
|---|---|
| 401 | `{ "message": "Invalid email or password" }` |
| 403 | `{ "message": "This account has been disabled. Contact admin." }` |

---

### GET `/api/auth/me` 🔐
Returns the currently logged-in user, derived from the token. Used by the frontend on app load to restore session.

**Response `200 OK`**
```json
{
  "user": {
    "id": "64f1...",
    "name": "Jane Wanjiru",
    "email": "jane.wanjiru@strathmore.edu",
    "role": "student",
    "studentID": "SM12345",
    "registrationDate": "2026-01-10T08:00:00.000Z"
  }
}
```

**Errors**: `401 { "message": "Invalid or expired token" }`

---

### POST `/api/auth/logout` 🔐
Stateless JWT — this mainly exists so the frontend has a consistent call to make (and to support future token-blacklisting if added). Frontend deletes the token client-side regardless.

**Response `200 OK`**: `{ "message": "Logged out successfully" }`

---

## 2. Events — `/api/events`

### GET `/api/events` 🔓
List all **approved, upcoming** events. This is the student-facing browse endpoint.

**Query params** (all optional)
| Param | Type | Example | Behavior |
|---|---|---|---|
| `search` | string | `?search=tech` | matches title or description, case-insensitive |
| `category` | string | `?category=Sports` | exact match |
| `startDate` | date | `?startDate=2026-07-01` | events on/after this date |
| `endDate` | date | `?endDate=2026-07-31` | events on/before this date |
| `location` | string | `?location=Auditorium` | partial match |
| `page` | number | `?page=2` | default 1 |
| `limit` | number | `?limit=20` | default 20 |

Results are always sorted chronologically (soonest first).

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": "64f2...",
      "title": "Tech Innovation Summit",
      "description": "A day of talks on emerging tech in East Africa.",
      "date": "2026-07-20",
      "time": "09:00",
      "location": "Auditorium",
      "capacity": 200,
      "currentBookings": 134,
      "seatsRemaining": 66,
      "category": "Technology",
      "status": "approved",
      "createdBy": { "id": "64e9...", "name": "Tech Club", "organizationName": "Strathmore Tech Club" },
      "createdDate": "2026-06-01T10:00:00.000Z"
    }
  ],
  "count": 1,
  "page": 1,
  "totalPages": 1
}
```

---

### GET `/api/events/:id` 🔓
Single event detail page.

**Response `200 OK`**: same shape as one item above, full object.

**Errors**: `404 { "message": "Event not found" }`

---

### POST `/api/events` 🎤 Organizer
Create a new event. Goes into `pending` status automatically.

**Request body**
```json
{
  "title": "Tech Innovation Summit",
  "description": "A day of talks on emerging tech in East Africa.",
  "date": "2026-07-20",
  "time": "09:00",
  "location": "Auditorium",
  "capacity": 200,
  "category": "Technology",
  "fundingRequest": {
    "requested": true,
    "budget": 50000,
    "justification": "Covers speaker travel, catering, and venue AV setup."
  },
  "externalGuests": {
    "requested": true,
    "reason": "Inviting two industry speakers from outside the university."
  }
}
```
Notes:
- `fundingRequest` and `externalGuests` are optional objects. Omit entirely, or send `{ "requested": false }`, if not needed.
- Server validates `date` is **at least 14 days** from the submission timestamp (`Date.now()`), rejecting otherwise.

**Response `201 Created`**
```json
{
  "event": {
    "id": "64f2...",
    "title": "Tech Innovation Summit",
    "status": "pending",
    "createdDate": "2026-06-17T12:00:00.000Z",
    "...": "rest of fields as submitted"
  }
}
```

**Errors**
| Code | Body |
|---|---|
| 400 | `{ "message": "Event date must be at least 14 days from today" }` |
| 400 | `{ "message": "Capacity must be a positive number" }` |
| 422 | `{ "message": "Missing required field: location" }` |

---

### PUT `/api/events/:id` 🎤 Organizer (own events only) / 🛠 Admin
Edit an event. Organizers can only edit their **own** events, and only while status is `pending` or `modification_requested`. Admins can edit any event at any time.

**Request body**: any subset of the creatable fields above.

**Response `200 OK`**: updated event object.

**Errors**
| Code | Body |
|---|---|
| 403 | `{ "message": "You can only edit your own events" }` |
| 403 | `{ "message": "Cannot edit an event that has already been approved" }` |
| 404 | `{ "message": "Event not found" }` |

---

### DELETE `/api/events/:id` 🎤 Organizer (own, pending only) / 🛠 Admin
Cancels/deletes an event. Sets `status: "cancelled"` rather than hard-deleting if bookings exist (preserves booking history integrity).

**Response `200 OK`**: `{ "message": "Event cancelled successfully" }`

**Side effect**: triggers cancellation emails to all students with `confirmed` bookings on that event, and a socket emit `event_status_changed`.

---

### GET `/api/events/my-events` 🎤 Organizer
Returns all events created by the logged-in organizer, regardless of status, including pending/rejected/modification_requested.

**Response `200 OK`**: same array shape as `GET /api/events`, plus `feedback` field populated if rejected or modification was requested.

---

### GET `/api/events/pending` 🛠 Admin
All events awaiting review, oldest first (so the admin clears the backlog in order, supporting the "reviewed by following Wednesday" rule).

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": "64f2...",
      "title": "Tech Innovation Summit",
      "status": "pending",
      "fundingRequest": { "requested": true, "budget": 50000, "justification": "..." },
      "externalGuests": { "requested": true, "reason": "..." },
      "createdBy": { "id": "64e9...", "name": "Tech Club", "email": "techclub@strathmore.edu" },
      "createdDate": "2026-06-10T09:00:00.000Z",
      "reviewDeadline": "2026-06-17T23:59:59.000Z"
    }
  ],
  "count": 1
}
```
`reviewDeadline` is computed server-side: the Wednesday following the week the event was submitted.

---

### PATCH `/api/events/:id/review` 🛠 Admin
Approve, reject, or request modifications on a pending event.

**Request body**
```json
{
  "decision": "approved",
  "feedback": null
}
```
or
```json
{
  "decision": "rejected",
  "feedback": "Venue capacity exceeds Auditorium's fire-safety limit. Please reduce to 150 or pick a larger venue."
}
```
or
```json
{
  "decision": "modification_requested",
  "feedback": "Please clarify the budget breakdown for the funding request before we can approve."
}
```
Notes:
- `decision` is one of `"approved" | "rejected" | "modification_requested"`.
- `feedback` is required when `decision` is `"rejected"` or `"modification_requested"`, optional/null for `"approved"`.

**Response `200 OK`**: updated event object.

**Side effect**: sends an email notification to the organizer (approval or rejection notice), creates a `Notification` document, and — if approved — the event becomes visible on `GET /api/events`.

---

## 3. Bookings — `/api/bookings`

### POST `/api/bookings` 🎓 Student
Book a seat on an approved event.

**Request body**
```json
{
  "eventId": "64f2..."
}
```

**Response `201 Created`**
```json
{
  "booking": {
    "id": "64f3...",
    "eventId": "64f2...",
    "studentID": "64e1...",
    "bookingDate": "2026-06-17T12:30:00.000Z",
    "status": "confirmed"
  },
  "seatsRemaining": 65
}
```

**Errors**
| Code | Body |
|---|---|
| 400 | `{ "message": "Event is not open for booking" }` (not approved, or already happened) |
| 409 | `{ "message": "This event is at full capacity" }` |
| 409 | `{ "message": "You already have a booking for this event" }` |
| 404 | `{ "message": "Event not found" }` |

**Side effects**:
- Increments `currentBookings` on the Event document.
- Emits socket event `capacity_updated` to all clients in that event's room: `{ eventId, currentBookings, seatsRemaining }`.
- Sends booking confirmation email to the student.
- If this booking fills the event to capacity, sends "capacity full" email to the organizer.

---

### DELETE `/api/bookings/:id` 🎓 Student (own bookings only)
Cancel a booking. Allowed only within the permitted cancellation window (e.g. up to 24 hours before the event — confirm exact window with your team and document it here once decided).

**Response `200 OK`**
```json
{
  "message": "Booking cancelled successfully",
  "seatsRemaining": 66
}
```

**Errors**
| Code | Body |
|---|---|
| 403 | `{ "message": "You can only cancel your own bookings" }` |
| 400 | `{ "message": "Cancellation window has passed for this event" }` |
| 404 | `{ "message": "Booking not found" }` |

**Side effects**:
- Decrements `currentBookings`.
- Emits socket event `capacity_updated`.
- Sends cancellation confirmation email to student.

---

### GET `/api/bookings/my-bookings` 🎓 Student
Booking history for the logged-in student, most recent first.

**Query params**: `?status=confirmed` or `?status=cancelled` (optional filter)

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": "64f3...",
      "event": {
        "id": "64f2...",
        "title": "Tech Innovation Summit",
        "date": "2026-07-20",
        "time": "09:00",
        "location": "Auditorium"
      },
      "bookingDate": "2026-06-17T12:30:00.000Z",
      "status": "confirmed"
    }
  ],
  "count": 1
}
```

---

### GET `/api/bookings/event/:eventId` 🎤 Organizer (own event only) / 🛠 Admin
Participant list for a specific event.

**Response `200 OK`**
```json
{
  "data": [
    {
      "bookingId": "64f3...",
      "studentName": "Jane Wanjiru",
      "studentEmail": "jane.wanjiru@strathmore.edu",
      "studentID": "SM12345",
      "bookingDate": "2026-06-17T12:30:00.000Z",
      "status": "confirmed"
    }
  ],
  "count": 134
}
```

**Errors**: `403 { "message": "You can only view participants for your own events" }`

---

### GET `/api/bookings/event/:eventId/export` 🎤 Organizer (own event only) / 🛠 Admin
Exports the participant list as a downloadable CSV.

**Response `200 OK`**
Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="tech-innovation-summit-participants.csv"`

Body (raw CSV):
```csv
studentName,studentEmail,studentID,bookingDate,status
Jane Wanjiru,jane.wanjiru@strathmore.edu,SM12345,2026-06-17T12:30:00.000Z,confirmed
```

---

## 4. Admin — `/api/admin`

### GET `/api/admin/analytics` 🛠 Admin
System-wide analytics dashboard data.

**Response `200 OK`**
```json
{
  "totalEvents": 142,
  "eventsByStatus": {
    "pending": 8,
    "approved": 110,
    "rejected": 15,
    "cancelled": 9
  },
  "totalBookings": 3204,
  "totalUsers": 850,
  "usersByRole": {
    "student": 800,
    "organizer": 48,
    "admin": 2
  },
  "popularCategories": [
    { "category": "Technology", "eventCount": 30, "totalBookings": 1200 },
    { "category": "Sports", "eventCount": 22, "totalBookings": 900 }
  ],
  "upcomingEventsCount": 25,
  "averageBookingsPerEvent": 22.6
}
```

---

### GET `/api/admin/reports/participation` 🛠 Admin
Detailed participation report, optionally scoped by date range or category.

**Query params**: `?startDate=2026-01-01&endDate=2026-06-30&category=Technology` (all optional)

**Response `200 OK`**
```json
{
  "data": [
    {
      "eventId": "64f2...",
      "eventTitle": "Tech Innovation Summit",
      "date": "2026-07-20",
      "category": "Technology",
      "capacity": 200,
      "totalBookings": 134,
      "cancellations": 6,
      "fillRate": "67%"
    }
  ],
  "count": 1
}
```

---

### GET `/api/admin/users` 🛠 Admin
List all users for management.

**Query params**: `?role=student&search=jane&page=1&limit=20`

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": "64e1...",
      "name": "Jane Wanjiru",
      "email": "jane.wanjiru@strathmore.edu",
      "role": "student",
      "studentID": "SM12345",
      "isDisabled": false,
      "registrationDate": "2026-01-10T08:00:00.000Z"
    }
  ],
  "count": 1,
  "page": 1,
  "totalPages": 1
}
```

---

### PATCH `/api/admin/users/:id/disable` 🛠 Admin
Toggles a user's disabled status (soft block — they can't log in but data is preserved).

**Request body**: `{ "isDisabled": true }`

**Response `200 OK`**: `{ "message": "User disabled successfully", "user": {...} }`

---

### DELETE `/api/admin/users/:id` 🛠 Admin
Permanently deletes a user account.

**Response `200 OK`**: `{ "message": "User deleted successfully" }`

**Errors**: `400 { "message": "Cannot delete a user with active event bookings. Disable instead." }` (business rule — confirm with team whether deletion should cascade or be blocked)

---

### PATCH `/api/admin/events/:id/moderate` 🛠 Admin
Moderate event content post-approval (e.g. flag inappropriate description, force-cancel a live event).

**Request body**
```json
{
  "action": "flag",
  "reason": "Description contains promotional spam unrelated to event."
}
```
`action` is one of `"flag" | "unflag" | "force_cancel"`.

**Response `200 OK`**: updated event object.

---

## 5. Notifications — `/api/notifications`

### GET `/api/notifications` 🔐
Logged-in user's notifications, most recent first.

**Query params**: `?isRead=false` (optional filter)

**Response `200 OK`**
```json
{
  "data": [
    {
      "id": "64f4...",
      "message": "Your event 'Tech Innovation Summit' has been approved.",
      "type": "event_approved",
      "sentDate": "2026-06-17T13:00:00.000Z",
      "isRead": false
    }
  ],
  "count": 1
}
```

`type` is one of: `booking_confirmed | booking_cancelled | event_reminder | event_approved | event_rejected | modification_requested | capacity_full`

---

### PATCH `/api/notifications/:id/read` 🔐
Marks a single notification as read.

**Response `200 OK`**: `{ "message": "Marked as read" }`

---

### PATCH `/api/notifications/read-all` 🔐
Marks all of the user's notifications as read.

**Response `200 OK`**: `{ "message": "All notifications marked as read", "count": 5 }`

---

## 6. Socket.io Events (real-time layer)

Not REST, but documented here since the frontend needs the exact event names and payloads.

**Connection**: client connects to `VITE_SOCKET_URL` (same host as API, different protocol).

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `join_event_room` | `{ eventId: "64f2..." }` | Subscribes the client to updates for one event's page |
| `leave_event_room` | `{ eventId: "64f2..." }` | Unsubscribes when navigating away |

### Server → Client

| Event | Payload | Fired when |
|---|---|---|
| `capacity_updated` | `{ eventId, currentBookings, seatsRemaining }` | Any booking or cancellation on that event |
| `event_status_changed` | `{ eventId, status }` | Admin approves/rejects/cancels the event |
| `new_notification` | `{ notification: {...} }` | Any notification created for the connected user |

---

## 7. Standard Error Codes Reference

| Code | Meaning | When |
|---|---|---|
| 400 | Bad Request | Validation failed, business rule violated |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Valid token, wrong role/ownership |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate booking, capacity full, duplicate email |
| 422 | Unprocessable Entity | Missing required fields |
| 429 | Too Many Requests | Rate limit hit (login attempts) |
| 500 | Server Error | Unexpected — should be rare and logged |

---

## 8. Open decisions to confirm as a team before building

These are flagged in the spec but need an exact number/rule picked so both sides build the same thing:

1. **Booking cancellation window** — how many hours/days before an event can a student still cancel? (e.g. "up to 24 hours before")
2. **User deletion vs. disable** — does deleting a user with bookings cascade-delete their bookings, or is deletion blocked entirely (only disable allowed)?
3. **Modification request flow** — when an admin requests modifications, does the event return to `pending` automatically after the organizer edits it, or does it need a fresh submission?
4. **Multiple categories** — is `category` a single fixed value from an enum (Technology, Sports, Cultural, Academic, Social, Other) or free text? Recommend enum for clean filtering.

Pick these now, write the answer directly into this document, and move on — don't let them block Phase 2.