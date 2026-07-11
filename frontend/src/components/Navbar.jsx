import { Link, NavLink, useNavigate } from 'react-router-dom';
import { clearLocalSession, getCurrentLocalUser } from '../utils/localAuth';

const navItems = [
  ['/', '홈'],
  ['/portfolio', '포트폴리오'],
  ['/team', '과제'],
  ['/ai', 'AI 분석'],
];

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
        {navItems.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
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
