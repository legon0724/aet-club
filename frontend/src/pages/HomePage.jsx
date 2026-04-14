import { useEffect, useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

const BannerSlider = memo(({ banners }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[idx];

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 28, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px', transition: 'all .5s ease' }}>
        {b.image_url
          ? <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          : <div style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', textAlign: 'center' }}>{b.title}</div>
        }
        {b.link_url && (
          <a href={b.link_url} target="_blank" rel="noreferrer" style={{ position: 'absolute', inset: 0 }} />
        )}
      </div>
      {banners.length > 1 && (
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {banners.map((_, i) => (
            <div key={i} onClick={() => setIdx(i)}
              style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, background: i === idx ? '#ffd43b' : 'rgba(255,255,255,.3)', cursor: 'pointer', transition: 'all .3s' }} />
          ))}
        </div>
      )}
    </div>
  );
});

const NoticeItem = memo(({ notice }) => (
  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {notice.is_pinned && <span style={{ fontSize: 10, background: 'rgba(255,210,60,.15)', color: '#ffd43b', padding: '2px 6px', borderRadius: 4 }}>📌</span>}
      <span style={{ fontSize: 13, color: '#d0d0d0', fontWeight: notice.is_pinned ? 600 : 400 }}>{notice.title}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginLeft: 'auto' }}>{new Date(notice.created_at).toLocaleDateString()}</span>
    </div>
    {notice.content && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 4, lineHeight: 1.5 }}>{notice.content}</div>}
  </div>
));

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [banners, setBanners] = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.get('/api/auth/me').then(r => setUser(r.data)).catch(() => {});
    api.get('/api/banners/').then(r => setBanners(r.data.filter(b => b.is_active))).catch(() => {});
    api.get('/api/notices/').then(r => setNotices(r.data)).catch(() => {});
  }, []);

  const quickLinks = [
    { to: '/portfolio', icon: '👤', label: '포트폴리오' },
    { to: '/team', icon: '💬', label: '팀 공간' },
    { to: '/ai', icon: '🤖', label: 'AI 생기부 분석' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>

        <BannerSlider banners={banners} />

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>바로가기</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {quickLinks.map(l => (
              <Link key={l.to} to={l.to}
                style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '20px 16px', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,210,60,.06)'; e.currentTarget.style.borderColor = 'rgba(255,210,60,.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; }}>
                <span style={{ fontSize: 24 }}>{l.icon}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {notices.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14 }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', letterSpacing: '.06em', textTransform: 'uppercase' }}>📢 공지사항</div>
            {notices.slice(-5).map(n => <NoticeItem key={n.id} notice={n} />)}
          </div>
        )}
      </div>
    </div>
  );
}