import { Link, NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  ['/', '홈'],
  ['/portfolio', '포트폴리오'],
  ['/team', '팀'],
  ['/ai', 'AI 분석'],
];

export default function Navbar({ user }) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="site-nav">
      <Link to="/" className="site-logo" aria-label="AET 홈">
        <span>AET</span>
      </Link>

      <div className="site-links">
        {navItems.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
        {user?.is_admin && <NavLink to="/admin">관리자</NavLink>}
      </div>

      <div className="site-account">
        {user?.username && <span>{user.username}</span>}
        <button type="button" onClick={logout}>로그아웃</button>
      </div>
    </nav>
  );
}
