import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';
import { getFallbackNotices } from '../utils/localWorkspace';

const BACKEND = 'https://web-production-00104.up.railway.app';

const quickLinks = [
  { to: '/portfolio', eyebrow: 'Portfolio', label: '포트폴리오', description: '활동 기록과 링크를 깔끔하게 정리합니다.' },
  { to: '/team', eyebrow: 'Submit', label: '과제 제출', description: '팀별 과제, 링크, 첨부 파일을 한 번에 제출합니다.' },
  { to: '/ai', eyebrow: 'Analysis', label: 'AI 분석', description: '생기부 문장과 진로 방향을 빠르게 점검합니다.' },
];

const BannerSlider = memo(({ banners }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => setIdx((current) => (current + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const banner = banners[idx];
  const imgUrl = banner?.image_url?.startsWith('/api') ? `${BACKEND}${banner.image_url}` : banner?.image_url;

  return (
    <section className={`workspace-hero ${imgUrl ? 'has-image' : ''}`}>
      {imgUrl && <img src={imgUrl} alt="" />}
      <div className="hero-copy">
        <span>NC Club</span>
        <h1>{banner?.title || '오늘 할 일을 놓치지 않게, 동아리 활동을 한 화면에 모았습니다.'}</h1>
        <p>{banner?.content || '공지 확인, 포트폴리오 정리, 과제 제출, 분석까지 필요한 흐름만 남겼습니다.'}</p>
        <div className="hero-actions">
          <Link to="/team">과제 제출</Link>
          <Link to="/portfolio">포트폴리오 정리</Link>
        </div>
      </div>
      <div className="hero-status" aria-label="NC 현황">
        <strong>NC</strong>
        <span>Portfolio ready</span>
        <span>Team workspace</span>
        <span>Assignment submit</span>
      </div>
      {banner?.link_url && <a className="hero-link" href={banner.link_url} target="_blank" rel="noreferrer" aria-label={`${banner.title} 자세히 보기`} />}
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
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [banners, setBanners] = useState([]);
  const [notices, setNotices] = useState(() => getFallbackNotices());

  useEffect(() => {
    api.get('/api/auth/me').then((r) => {
      setUser(rememberCurrentUser(r.data));
    }).catch(() => {});
    api.get('/api/banners/').then((r) => setBanners(r.data.filter((b) => b.is_active))).catch(() => {});
    api.get('/api/notices/').then((r) => setNotices(r.data.length ? r.data : getFallbackNotices())).catch(() => {
      setNotices(getFallbackNotices());
    });
  }, []);

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="home-layout">
        <BannerSlider banners={banners} />

        <section className="quick-grid" aria-label="주요 메뉴">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className="quick-card">
              <small>{link.eyebrow}</small>
              <span>{link.label}</span>
              <p>{link.description}</p>
            </Link>
          ))}
        </section>

        <section className="assignment-strip">
          <div>
            <span>Assignment</span>
            <h2>과제 제출 칸을 바로 열어둘게요.</h2>
            <p>팀 공간에서 제목, 설명, 링크, 파일 첨부까지 제출할 수 있습니다.</p>
          </div>
          <Link to="/team">제출하러 가기</Link>
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
