import { memo, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import PrefetchLink from '../components/PrefetchLink';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

const BACKEND = 'https://web-production-00104.up.railway.app';
const emptyActivity = {
  score: 0,
  submitted_count: 0,
  draft_count: 0,
  portfolio_sections: 0,
  gallery_count: 0,
  badges: [],
};

const resolveFileUrl = (value = '') => (value?.startsWith('/api') ? `${BACKEND}${value}` : value);

const quickLinks = [
  { to: '/team', eyebrow: 'Assignment', label: '과제 제출', description: '관리자가 올린 파일을 받고 제출물을 올립니다.', meta: 'Submit' },
  { to: '/portfolio', eyebrow: 'Portfolio', label: '포트폴리오', description: '활동 기록과 외부 링크를 정리합니다.', meta: 'Archive' },
  { to: '/ai', eyebrow: 'Analysis', label: 'AI 분석', description: '생기부 문장과 진로 방향을 점검합니다.', meta: 'Review' },
];

const todayRows = [
  ['01', '공지 확인', '고정된 안내와 최근 공지를 먼저 봅니다.'],
  ['02', '과제 제출', '과제 화면에서 첨부 파일과 제출 상태를 확인합니다.'],
  ['03', '기록 정리', '포트폴리오에 활동 링크와 결과를 남깁니다.'],
];

const BannerSlider = memo(({ banners, assignments, notices, teams, user }) => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => setIdx((current) => (current + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const banner = banners[idx];
  const imgUrl = banner?.image_url?.startsWith('/api') ? `${BACKEND}${banner.image_url}` : banner?.image_url;
  const latestNotice = notices[0];
  const latestAssignment = assignments[0];

  return (
    <section className={`home-command ${imgUrl ? 'has-image' : ''}`}>
      {imgUrl && <img className="home-command-image" src={imgUrl} alt="" loading="lazy" decoding="async" />}
      <div className="command-copy">
        <span>NC Club Dashboard</span>
        <h1>{banner?.title || 'NC 활동 보드'}</h1>
        <p>{banner?.content || '오늘 확인할 공지, 팀 과제, 포트폴리오 기록을 한 화면에서 바로 이어갑니다.'}</p>
        <div className="command-actions">
          <PrefetchLink to="/team">과제 제출</PrefetchLink>
          <PrefetchLink to="/portfolio">기록 정리</PrefetchLink>
        </div>
      </div>

      <div className="command-board" aria-label="활동 요약">
        <div className="board-header">
          <span>Live room</span>
          <strong>{teams.length || 0} teams</strong>
        </div>
        <div className="board-row">
          <span>최근 공지</span>
          <p>{latestNotice?.title || '새 공지를 기다리고 있습니다.'}</p>
        </div>
        <div className="board-row">
          <span>팀 과제</span>
          <p>{latestAssignment?.title || '등록된 과제가 없습니다.'}</p>
        </div>
        <PrefetchLink to={user?.is_admin ? '/admin' : '/team'} className="board-link">
          {user?.is_admin ? '관리자 콘솔' : '과제'}
        </PrefetchLink>
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
  const [activity, setActivity] = useState(emptyActivity);
  const [banners, setBanners] = useState([]);
  const [notices, setNotices] = useState([]);
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [events, setEvents] = useState([]);
  const portfolioCount = activity.portfolio_sections > 0 ? 1 : 0;

  useEffect(() => {
    api.get('/api/auth/me').then((r) => {
      const remembered = rememberCurrentUser(r.data);
      setUser(remembered);
    }).catch(() => {});
    api.get('/api/activity/me').then((r) => setActivity(r.data)).catch(() => setActivity(emptyActivity));
    api.get('/api/banners/').then((r) => setBanners(r.data.filter((b) => b.is_active))).catch(() => {});
    api.get('/api/notices/').then((r) => setNotices(r.data)).catch(() => setNotices([]));
    api.get('/api/teams/').then((r) => setTeams(r.data)).catch(() => setTeams([]));
    api.get('/api/assignments/').then((r) => setAssignments(r.data || [])).catch(() => setAssignments([]));
    api.get('/api/gallery/').then((r) => setGallery(r.data || [])).catch(() => setGallery([]));
    api.get('/api/calendar/').then((r) => setEvents(r.data || [])).catch(() => setEvents([]));
  }, []);

  const orderedNotices = useMemo(() => notices.slice(-6).reverse(), [notices]);
  const dashboardStats = useMemo(() => [
    ['팀', `${teams.length}`, '활동 공간'],
    ['과제', `${assignments.length}`, '등록됨'],
    ['공지', `${notices.length}`, '확인 대기'],
    ['기록', `${portfolioCount}`, '포트폴리오'],
  ], [assignments.length, notices.length, portfolioCount, teams.length]);
  const recentAssignments = assignments.slice(0, 4);
  const scheduleItems = useMemo(() => (
    [
      ...events.map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        date: event.start_date,
        type: event.event_type || '일정',
        helper: event.end_date ? `종료 ${new Date(event.end_date).toLocaleString()}` : '등록 일정',
      })),
      ...assignments.filter((assignment) => assignment.due_at).map((assignment) => ({
        id: `assignment-${assignment.id}`,
        title: assignment.title,
        date: assignment.due_at,
        type: '마감',
        helper: '과제 제출 마감',
      })),
    ]
      .filter((item) => !Number.isNaN(new Date(item.date).getTime()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 6)
  ), [assignments, events]);

  useEffect(() => {
    if (!user || orderedNotices.length === 0) return;

    orderedNotices.forEach((notice) => {
      if (!notice.id) return;
      api.post(`/api/notices/${notice.id}/read`).catch(() => {});
    });
  }, [orderedNotices, user]);

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="home-layout home-dashboard">
        <BannerSlider banners={banners} assignments={assignments} notices={orderedNotices} teams={teams} user={user} />

        <section className="home-signal-grid" aria-label="활동 요약">
          {dashboardStats.map(([label, value, helper]) => (
            <article key={label} className="signal-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <p>{helper}</p>
            </article>
          ))}
        </section>

        <section className="home-activity-score" aria-label="활동 점수와 배지">
          <div className="activity-score-main">
            <span>Activity score</span>
            <strong>{activity.score}</strong>
            <p>과제 제출, 포트폴리오 정리, 프로젝트와 발표 기록을 기준으로 계산합니다.</p>
          </div>
          <div className="activity-score-metrics">
            <small>제출 {activity.submitted_count}</small>
            <small>작성 중 {activity.draft_count}</small>
            <small>포트폴리오 {activity.portfolio_sections}/5</small>
            <small>자료 {activity.gallery_count}</small>
          </div>
          <div className="activity-badge-row">
            {(activity.badges || []).map((badge) => (
              <span key={badge.key} className={badge.earned ? 'earned' : ''} title={badge.description}>
                {badge.label}
              </span>
            ))}
          </div>
        </section>

        <section className="home-control-grid" aria-label="오늘 작업">
          <div className="today-panel">
            <div className="section-head">
              <p>Today</p>
              <h2>오늘 이어갈 일</h2>
            </div>
            <div className="today-list">
              {todayRows.map(([step, title, body]) => (
                <div key={step} className="today-row">
                  <span>{step}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="module-panel">
            {quickLinks.map((link) => (
              <PrefetchLink key={link.to} to={link.to} className="module-card">
                <small>{link.eyebrow}</small>
                <strong>{link.label}</strong>
                <p>{link.description}</p>
                <span>{link.meta}</span>
              </PrefetchLink>
            ))}
          </div>
        </section>

        <section className="home-gallery-section" aria-label="활동 갤러리">
          <div className="section-head">
            <p>Gallery</p>
            <h2>활동 갤러리</h2>
          </div>
          {gallery.length > 0 ? (
            <div className="home-gallery-grid">
              {gallery.slice(0, 4).map((item) => {
                const imageUrl = resolveFileUrl(item.image_url);
                const fileUrl = resolveFileUrl(item.file_url);
                return (
                  <article key={item.id} className="home-gallery-card">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="home-gallery-file">자료</div>
                    )}
                    <div>
                      <strong>{item.title}</strong>
                      {item.description && <p>{item.description}</p>}
                      <div className="home-gallery-actions">
                        {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer">링크</a>}
                        {fileUrl && <a href={fileUrl} target="_blank" rel="noreferrer">파일</a>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="gallery-empty">
              <strong>아직 올라온 활동 자료가 없습니다.</strong>
              <p>관리자가 사진이나 발표 자료를 올리면 여기에 모입니다.</p>
            </div>
          )}
        </section>

        <section className="home-calendar-section" aria-label="다가오는 일정">
          <div className="section-head">
            <p>Calendar</p>
            <h2>다가오는 일정</h2>
          </div>
          {scheduleItems.length > 0 ? (
            <div className="home-calendar-list">
              {scheduleItems.map((item) => (
                <article key={item.id} className="home-calendar-item">
                  <time>{new Date(item.date).toLocaleDateString()}</time>
                  <div>
                    <span>{item.type}</span>
                    <strong>{item.title}</strong>
                    <p>{item.helper}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="gallery-empty">
              <strong>예정된 일정이 없습니다.</strong>
              <p>발표일, 활동일, 과제 마감일이 등록되면 이곳에 표시됩니다.</p>
            </div>
          )}
        </section>

        <section className="home-work-grid" aria-label="공지와 과제">
          <section className="notice-panel">
            <div className="section-head">
              <p>Notice</p>
              <h2>공지사항</h2>
            </div>

            {orderedNotices.length > 0 ? (
              <div className="notice-list">
                {orderedNotices.map((notice) => (
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

          <section className="deadline-panel">
            <div className="section-head">
              <p>Assignments</p>
              <h2>팀 과제</h2>
            </div>
            {recentAssignments.length > 0 ? (
              <div className="deadline-list">
                {recentAssignments.map((assignment) => (
                  <PrefetchLink key={assignment.id} to="/team" className="deadline-item">
                    <div>
                      <strong>{assignment.title}</strong>
                      <p>{assignment.content || '과제 화면에서 파일과 제출 상태를 확인하세요.'}</p>
                    </div>
                    <span>{assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : '열림'}</span>
                  </PrefetchLink>
                ))}
              </div>
            ) : (
              <div className="deadline-empty">
                <strong>등록된 과제가 없습니다.</strong>
                <p>관리자가 과제를 올리면 이 영역에 바로 표시됩니다.</p>
                <PrefetchLink to="/team">과제 보기</PrefetchLink>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
