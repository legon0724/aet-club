import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [notices, setNotices] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me')
      .then(r => { setUser(r.data); setLoading(false); })
      .catch(() => { localStorage.removeItem('token'); navigate('/login'); });
    api.get('/api/notices/').then(r => setNotices(r.data)).catch(() => {});
    api.get('/api/banners/').then(r => setBanners(r.data)).catch(() => {});
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>로딩 중...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>안녕하세요, {user?.username}님 👋</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>AET AI Engineering Team</p>
        </div>

        {banners.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {banners.map(b => (
              <div key={b.id} style={{ background: 'rgba(255,210,60,.08)', border: '1px solid rgba(255,210,60,.15)', borderRadius: 10, padding: '14px 18px', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#ffd43b' }}>{b.title}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 14, letterSpacing: '.06em', textTransform: 'uppercase' }}>공지사항</div>
          {notices.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>공지사항이 없습니다.</div>
          ) : notices.map(n => (
            <div key={n.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              {n.is_pinned && <span style={{ fontSize: 10, background: 'rgba(255,210,60,.15)', color: '#ffd43b', padding: '2px 7px', borderRadius: 6, fontWeight: 500 }}>📌 고정</span>}
              <span style={{ fontSize: 13, color: '#d0d0d0' }}>{n.title}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>{new Date(n.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}