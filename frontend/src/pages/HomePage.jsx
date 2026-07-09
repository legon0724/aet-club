import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

const BACKEND = 'https://web-production-00104.up.railway.app';

const quickLinks = [
  { to: '/portfolio', label: '포트폴리오', description: '프로젝트와 활동 기록 정리' },
  { to: '/team', label: '팀 공간', description: '팀별 공지와 협업 확인' },
  { to: '/ai', label: 'AI 분석', description: '생기부 문장 초안 점검' },
];

const BannerSlider = memo(({ banners }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => setIdx((current) => (current + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) {
    return (
      <section className="home-hero">
        <p>AET Club</p>
        <h1>오늘 할 일을 놓치지 않게, 동아리 활동을 한 화면에 모았습니다.</h1>
      </section>
    );
  }

  const banner = banners[idx];
  const imgUrl = banner.image_url?.startsWith('/api') ? `${BACKEND}${banner.image_url}` : banner.image_url;

  return (
    <section className="home-hero with-image">
      {imgUrl && <img src={imgUrl} alt="" />}
      <div>
        <p>AET Notice</p>
        <h1>{banner.title}</h1>
      </div>
      {banner.link_url && <a href={banner.link_url} target="_blank" rel="noreferrer" aria-label={`${banner.title} 자세히 보기`} />}
      {banners.length > 1 && (
        <div className="banner-dots" aria-label="배너 선택">
          {banners.map((item, i) => (
            <button key={item.id ?? item.title} type="button" className={i === idx ? 'active' : ''} onClick={() => setIdx(i)} />
          ))}
        </div>
      )}
    </section>
  );
});

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [banners, setBanners] = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.get('/api/auth/me').then((r) => setUser(r.data)).catch(() => {});
    api.get('/api/banners/').then((r) => setBanners(r.data.filter((b) => b.is_active))).catch(() => {});
    api.get('/api/notices/').then((r) => setNotices(r.data)).catch(() => {});
  }, []);

  return (
    <div className="app-shell">
      <Navbar user={user} />
      <main className="home-layout">
        <BannerSlider banners={banners} />

        <section className="quick-grid" aria-label="주요 메뉴">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className="quick-card">
              <span>{link.label}</span>
              <p>{link.description}</p>
            </Link>
          ))}
        </section>

        <section className="notice-panel">
          <div className="section-head">
            <p>Notice</p>
            <h2>공지사항</h2>
          </div>

          {notices.length > 0 ? (
            <div className="notice-list">
              {notices.slice(-10).reverse().map((notice) => (
                <article key={notice.id} className="notice-item">
                  <div>
                    {notice.is_pinned && <span className="pin-label">고정</span>}
                    <h3>{notice.title}</h3>
                  </div>
                  <time>{new Date(notice.created_at).toLocaleDateString()}</time>
                  {notice.content && <p>{notice.content}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">아직 등록된 공지사항이 없습니다.</p>
          )}
        </section>
      </main>
    </div>
  );
}
