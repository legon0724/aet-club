import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import PrefetchLink from '../components/PrefetchLink';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

const appItems = [
  {
    to: '/notices',
    icon: '🔔',
    label: '공지',
    helper: '새 소식 확인',
    tone: 'coral',
  },
  {
    to: '/assignments',
    icon: '✏️',
    label: '과제',
    helper: '과제 작성·제출',
    tone: 'blue',
  },
  {
    to: '/portfolio',
    icon: '🗂️',
    label: '포트폴리오',
    helper: '활동 기록 정리',
    tone: 'amber',
  },
];

function formatDay(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function formatDue(value) {
  if (!value) return '마감일 없음';
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return '마감일 확인';
  return `${due.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 마감`;
}

export default function HomePage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [notices, setNotices] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get('/api/auth/me')
      .then((response) => setUser(rememberCurrentUser(response.data)))
      .catch(() => {});
    api.get('/api/notices/')
      .then((response) => setNotices(response.data || []))
      .catch(() => setNotices([]));
    api.get('/api/assignments/')
      .then((response) => setAssignments(response.data || []))
      .catch(() => setAssignments([]));
  }, []);

  const recentNotices = useMemo(() => (
    [...notices]
      .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3)
  ), [notices]);

  const upcomingAssignments = useMemo(() => (
    [...assignments]
      .sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at) - new Date(b.due_at);
      })
      .slice(0, 3)
  ), [assignments]);

  return (
    <div className="app-shell ipad-home-shell">
      <main className="ipad-home">
        <header className="ipad-status">
          <div>
            <span>{formatDay(now)}</span>
            <strong>{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</strong>
          </div>
          <div className="ipad-user-chip">
            <span>{(user?.username || 'A')[0].toUpperCase()}</span>
            <p><strong>{user?.username || 'NC 멤버'}</strong><small>NC Club</small></p>
          </div>
        </header>

        <section className="ipad-greeting">
          <p>NC CLUB</p>
          <h1>오늘도 좋은 활동을<br />시작해볼까요?</h1>
        </section>

        <section className="ipad-app-grid" aria-label="NC 앱">
          {appItems.map((item) => (
            <PrefetchLink key={item.to} to={item.to} className="ipad-app-link">
              <span className={`ipad-app-icon ${item.tone}`} aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
              <small>{item.helper}</small>
            </PrefetchLink>
          ))}
        </section>

        <section className="ipad-widget-grid">
          <PrefetchLink to="/notices" className="ipad-widget notice-widget">
            <header>
              <div><span className="widget-dot coral" />공지</div>
              <small>전체 보기</small>
            </header>
            <div className="widget-list">
              {recentNotices.length ? recentNotices.map((notice) => (
                <article key={notice.id}>
                  <div>
                    {notice.is_pinned && <span className="widget-pin">중요</span>}
                    <strong>{notice.title}</strong>
                  </div>
                  <small>{new Date(notice.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</small>
                </article>
              )) : <p className="widget-empty">새 공지가 없습니다.</p>}
            </div>
          </PrefetchLink>

          <PrefetchLink to="/assignments" className="ipad-widget assignment-widget">
            <header>
              <div><span className="widget-dot blue" />다가오는 과제</div>
              <small>과제 열기</small>
            </header>
            <div className="widget-list">
              {upcomingAssignments.length ? upcomingAssignments.map((assignment) => (
                <article key={assignment.id}>
                  <strong>{assignment.title}</strong>
                  <span>{formatDue(assignment.due_at)}</span>
                </article>
              )) : <p className="widget-empty">지금은 제출할 과제가 없습니다.</p>}
            </div>
          </PrefetchLink>
        </section>

        <footer className="ipad-home-note">
          <span>●</span> 공지 확인부터 과제 제출, 활동 기록까지 한 곳에서
        </footer>
      </main>
      <Navbar user={user} />
    </div>
  );
}
