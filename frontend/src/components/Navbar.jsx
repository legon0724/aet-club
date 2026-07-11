import { Link, NavLink, useNavigate } from 'react-router-dom';
import { mainNavItems } from '../config/navigation';
import { clearLocalSession, getCurrentLocalUser } from '../utils/localAuth';

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const resolvedUser = user || getCurrentLocalUser();

  const logout = () => {
    clearLocalSession();
    navigate('/login');
  };

  return (
    <nav className="site-nav">
      <Link to="/" className="site-logo" aria-label="AET 홈">
        <span>NC</span>
      </Link>

      <div className="site-links">
        {mainNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.exact} className={({ isActive }) => (isActive ? 'active' : '')}>
            {item.label}
          </NavLink>
        ))}
        {resolvedUser?.is_admin && <NavLink to="/admin">관리자</NavLink>}
      </div>

      <div className="site-account">
        {resolvedUser?.username && <span>{resolvedUser.username}</span>}
        <button type="button" onClick={logout}>로그아웃</button>
      </div>
    </nav>
  );
}
