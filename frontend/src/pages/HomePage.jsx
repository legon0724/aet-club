import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';
import { getFallbackNotices } from '../utils/localWorkspace';

const BACKEND = 'https://web-production-00104.up.railway.app';

const quickLinks = [
  { to: '/portfolio', eyebrow: 'Portfolio', label: '포트폴리오', description: '활동 기록과 링크를 깔끔하게 정리합니다.' },
  { to: '/team', eyebrow: 'Classroom', label: '클래스룸', description: '팀별 과제와 제출물을 수업 피드처럼 확인합니다.' },
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
        <h1>{banner?.title || 'NC 클래스룸'}</h1>
        <p>{banner?.content || '공지, 과제, 포트폴리오, 분석을 더 빠르게 들어갈 수 있게 정리했습니다.'}</p>
        <div className="hero-actions">
          <Link to="/team">클래스룸 열기</Link>
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
            <span>Classroom</span>
            <h2>과제는 클래스룸에서 확인하고 제출합니다.</h2>
            <p>팀별 과제 피드, 제출물 목록, 새 제출 패널을 한 화면에서 관리합니다.</p>
          </div>
          <Link to="/team">클래스룸 이동</Link>
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
