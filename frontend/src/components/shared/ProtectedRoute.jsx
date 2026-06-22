/**
 * src/components/shared/ProtectedRoute.jsx
 *
 * Layout-route guard, used like:
 *   <Route element={<ProtectedRoute />}>...any logged-in user...</Route>
 *   <Route element={<ProtectedRoute roles={['organizer']} />}>...</Route>
 *
 * Renders <Outlet /> (the matched child route) only once both checks pass.
 * Waits on `isLoading` first — without that, a hard refresh would redirect
 * to /login for a split second before the session-restore call in
 * AuthContext even has a chance to run.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const ProtectedRoute = ({ roles }) => {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
