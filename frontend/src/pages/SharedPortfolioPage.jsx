import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { getCurrentLocalUser } from '../utils/localAuth';
import { getLocalPortfolioById } from '../utils/localWorkspace';
import { portfolioLinks, portfolioSections, resolvePortfolioFileUrl } from '../utils/portfolioDisplay';

export default function SharedPortfolioPage() {
  const { userId } = useParams();
  const [view, setView] = useState({ userId: '', status: 'loading', portfolio: null });
  const activeUser = getCurrentLocalUser();
  const status = view.userId === userId ? view.status : 'loading';
  const portfolio = view.userId === userId ? view.portfolio : null;

  useEffect(() => {
    let ignore = false;

    api.get(`/api/portfolio/${encodeURIComponent(userId)}`).then((response) => {
      if (!ignore) setView({ userId, status: 'ready', portfolio: response.data });
    }).catch(() => {
      const localPortfolio = getLocalPortfolioById(userId);
      if (localPortfolio?.is_public || activeUser?.is_admin || activeUser?.email === localPortfolio?.email) {
        if (!ignore) setView({ userId, status: localPortfolio ? 'ready' : 'missing', portfolio: localPortfolio });
        return;
      }
      if (!ignore) setView({ userId, status: 'private', portfolio: null });
    });

    return () => {
      ignore = true;
    };
  }, [activeUser?.email, activeUser?.is_admin, userId]);

  if (status === 'loading') {
    return <div className="shared-portfolio-page"><div className="route-loader" aria-label="포트폴리오 불러오는 중" /></div>;
  }

  if (!portfolio) {
    return (
      <main className="shared-portfolio-page">
        <section className="shared-portfolio-empty">
          <span>NC Portfolio</span>
          <h1>{status === 'private' ? '비공개 포트폴리오입니다.' : '포트폴리오를 찾을 수 없습니다.'}</h1>
          <p>공개 상태가 아니면 작성자와 관리자만 확인할 수 있습니다.</p>
          <Link className="modern-btn primary" to="/login">로그인</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shared-portfolio-page">
      <section className="shared-portfolio-hero">
        <Link className="site-logo" to="/" aria-label="NC 홈"><span>NC</span></Link>
        <div className="shared-profile">
          {portfolio.profile_image ? (
            <img src={resolvePortfolioFileUrl(portfolio.profile_image)} alt="" loading="lazy" decoding="async" />
          ) : (
            <strong>{(portfolio.username || portfolio.email || 'N')[0]}</strong>
          )}
          <div>
            <span>Public Portfolio</span>
            <h1>{portfolio.username || 'NC member'}</h1>
            <p>{portfolio.email || 'school email'}</p>
          </div>
        </div>
        <div className="shared-link-row">
          {portfolioLinks.map((link) => portfolio[link.key] && (
            <a key={link.key} href={portfolio[link.key]} target="_blank" rel="noreferrer">{link.label}</a>
          ))}
          {activeUser && <Link to="/portfolio">내 포트폴리오</Link>}
        </div>
      </section>

      <section className="shared-portfolio-grid">
        {portfolioSections.map((section, index) => (
          <article key={section.key} className="shared-portfolio-entry">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h2>{section.label}</h2>
            <p>{portfolio[section.key] || `${section.label} 내용을 추가해 주세요.`}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
