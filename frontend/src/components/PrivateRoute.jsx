import { Navigate, useLocation } from 'react-router-dom';
import { getCurrentLocalUser } from '../utils/localAuth';

export default function PrivateRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token || token.startsWith('local:')) return <Navigate to="/login" replace />;
  const user = getCurrentLocalUser();
  if (user?.must_change_password && location.pathname !== '/password-change') {
    return <Navigate to="/password-change" replace />;
  }
  if (!user?.must_change_password && location.pathname === '/password-change') {
    return <Navigate to="/" replace />;
  }
  return children;
}
