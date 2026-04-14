import { useEffect, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

const BACKEND = 'https://web-production-00104.up.railway.app';

const BannerSlider = memo(({ banners }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[idx];
  const imgUrl = b.image_url?.startsWith('/api') ? `${BACKEND}${b.image_url}` : b.image_url;

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 32, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', height: 280 }}>
      {imgUrl
        ? <img src={imgUrl} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(255,210,60,.08) 0%, rgba(255,255,255,.02) 100%)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f0', textAlign: 'center', padding: '0 32px' }}>{b.title}</div>
          </div>
        )
      }
      {b.link_url && <a href={b.link_url} target="_blank" rel="noreferrer" style={{ position: 'absolute', inset: 0 }} />}

      {banners.length > 1 && (
        <>
          <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
            {banners.map((_, i) => (
              <div key={i} onClick={() => setIdx(i)}
                style={{ width: i === idx ? 24 : 7, height: 7, borderRadius: 4, background: i === idx ? '#ffd43b' : 'rgba(255,255,255,.35)', cursor: 'pointer', transition: 'all .3s' }} />
            ))}
          </div>
          <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,.4)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
            {idx + 1} / {banners.length}
          </div>
        </>
      )}
    </div>
  );
});

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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        <BannerSlider banners={banners} />

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>바로가기</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {quickLinks.map(l => (
              <Link key={l.to} to={l.to}
                style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '24px 16px', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,210,60,.06)'; e.currentTarget.style.borderColor = 'rgba(255,210,60,.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; }}>
                <span style={{ fontSize: 28 }}>{l.icon}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 500 }}>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {notices.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>📢 공지사항</div>
            {notices.slice(-10).map(n => (
              <div key={n.id} style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: n.content ? 8 : 0 }}>
                  {n.is_pinned && <span style={{ fontSize: 11, background: 'rgba(255,210,60,.15)', color: '#ffd43b', padding: '3px 8px', borderRadius: 5, fontWeight: 600 }}>📌 고정</span>}
                  <span style={{ fontSize: 15, color: '#d0d0d0', fontWeight: n.is_pinned ? 600 : 400 }}>{n.title}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                {n.content && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.content}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}