import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import RootLayout from './components/layout/RootLayout';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import EventsBrowse from './pages/events/EventsBrowse';
import EventDetail from './pages/events/EventDetail';
import MyBookings from './pages/bookings/MyBookings';
import CreateEvent from './pages/organizer/CreateEvent';
import MyEvents from './pages/organizer/MyEvents';
import EditEvent from './pages/organizer/EditEvent';
import Participants from './pages/organizer/Participants';
import Dashboard from './pages/admin/Dashboard';
import PendingQueue from './pages/admin/PendingQueue';
import UserManagement from './pages/admin/UserManagement';
import Reports from './pages/admin/Reports';
import NotFound from './pages/common/NotFound';
import Unauthorized from './pages/common/Unauthorized';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<RootLayout />}>
                {/* Public */}
                <Route index element={<EventsBrowse />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="events/:id" element={<EventDetail />} />
                <Route path="unauthorized" element={<Unauthorized />} />

                {/* Student-only */}
                <Route element={<ProtectedRoute roles={['student']} />}>
                  <Route path="my-bookings" element={<MyBookings />} />
                </Route>

                {/* Organizer-only */}
                <Route element={<ProtectedRoute roles={['organizer']} />}>
                  <Route path="organizer/events" element={<MyEvents />} />
                  <Route path="organizer/events/new" element={<CreateEvent />} />
                  <Route path="organizer/events/:id/edit" element={<EditEvent />} />
                  <Route path="organizer/events/:id/participants" element={<Participants />} />
                </Route>

                {/* Admin-only */}
                <Route element={<ProtectedRoute roles={['admin']} />}>
                  <Route path="admin" element={<Dashboard />} />
                  <Route path="admin/pending" element={<PendingQueue />} />
                  <Route path="admin/users" element={<UserManagement />} />
                  <Route path="admin/reports" element={<Reports />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
