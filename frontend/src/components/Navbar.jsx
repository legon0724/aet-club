import { NavLink, useNavigate } from 'react-router-dom';
import { mainNavItems } from '../config/navigation';
import PrefetchLink from './PrefetchLink';
import { clearLocalSession, getCurrentLocalUser } from '../utils/localAuth';
import { getRoutePrefetchHandlers } from '../utils/routePrefetchHandlers';

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const resolvedUser = user || getCurrentLocalUser();

  const logout = () => {
    clearLocalSession();
    navigate('/login');
  };

  return (
    <nav className="site-nav">
      <PrefetchLink to="/" className="site-logo" aria-label="NC 홈">
        <span>NC</span>
      </PrefetchLink>

      <div className="site-links">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            viewTransition
            end={item.exact}
            className={({ isActive }) => (isActive ? 'active' : '')}
            {...getRoutePrefetchHandlers(item.to)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </NavLink>
        ))}
        {resolvedUser?.is_admin && (
          <NavLink to="/admin" viewTransition {...getRoutePrefetchHandlers('/admin')}>
            <span className="nav-icon" aria-hidden="true">⚙️</span>
            <small>관리자</small>
          </NavLink>
        )}
      </div>

      <div className="site-account">
        {resolvedUser?.username && <span>{resolvedUser.username}</span>}
        <button type="button" onClick={logout} aria-label="로그아웃">↗</button>
      </div>
    </nav>
  );
}
