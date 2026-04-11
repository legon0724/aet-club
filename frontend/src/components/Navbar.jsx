import { useNavigate, Link } from 'react-router-dom';

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('token'); navigate('/login'); };

  return (
    <nav style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52, gap: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <Link to="/" style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f0', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffe566', boxShadow: '0 0 6px rgba(255,229,102,.5)', display: 'inline-block' }} />
        AET
      </Link>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[['/', '홈'], ['/portfolio', '포트폴리오'], ['/team', '팀'], ['/ai', 'AI 생기부 분석']].map(([to, label]) => (
          <Link key={to} to={to} style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, transition: 'color .2s' }}
            onMouseEnter={e => e.target.style.color = '#e0e0e0'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.5)'}>
            {label}
          </Link>
        ))}
        {user?.is_admin && (
          <Link to="/admin" style={{ fontSize: 13, color: 'rgba(255,210,60,.7)', textDecoration: 'none', padding: '4px 10px', borderRadius: 6 }}>관리자</Link>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{user?.username}</span>
        <button onClick={logout} style={{ fontSize: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: 'rgba(255,255,255,.4)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
      </div>
    </nav>
  );
}