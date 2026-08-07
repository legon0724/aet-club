import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

export default function NoticesPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [notices, setNotices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/auth/me')
      .then((response) => setUser(rememberCurrentUser(response.data)))
      .catch(() => {});
    api.get('/api/notices/')
      .then((response) => {
        const next = [...(response.data || [])].sort((a, b) => (
          Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || new Date(b.created_at) - new Date(a.created_at)
        ));
        setNotices(next);
        setSelectedId(next[0]?.id || '');
      })
      .catch(() => setError('공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredNotices = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return notices;
    return notices.filter((notice) => (
      `${notice.title} ${notice.content || ''}`.toLowerCase().includes(keyword)
    ));
  }, [notices, query]);

  const selected = notices.find((notice) => notice.id === selectedId) || filteredNotices[0] || null;

  useEffect(() => {
    if (!selected?.id) return;
    api.post(`/api/notices/${selected.id}/read`).catch(() => {});
  }, [selected?.id]);

  return (
    <div className="app-shell app-page-shell notices-app-shell">
      <Navbar user={user} />
      <main className="app-window notices-window">
        <aside className="notice-sidebar">
          <header className="app-window-title">
            <span className="mini-app-icon coral">🔔</span>
            <div><small>NC CLUB</small><h1>공지</h1></div>
          </header>
          <label className="notice-search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공지 검색" />
          </label>
          <div className="notice-list-clean">
            {loading && <p className="app-empty">공지를 불러오는 중입니다.</p>}
            {error && <p className="app-error">{error}</p>}
            {!loading && !error && filteredNotices.length === 0 && <p className="app-empty">표시할 공지가 없습니다.</p>}
            {filteredNotices.map((notice) => (
              <button
                key={notice.id}
                type="button"
                className={selected?.id === notice.id ? 'active' : ''}
                onClick={() => setSelectedId(notice.id)}
              >
                <div>
                  {notice.is_pinned && <span>중요</span>}
                  <strong>{notice.title}</strong>
                </div>
                <p>{notice.content || '내용이 없는 공지입니다.'}</p>
                <small>{new Date(notice.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="notice-reader">
          {selected ? (
            <article>
              <header>
                <div>
                  {selected.is_pinned && <span className="reader-pin">중요 공지</span>}
                  <h2>{selected.title}</h2>
                </div>
                <time>{new Date(selected.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
              </header>
              <div className="notice-body">{selected.content || '내용이 없는 공지입니다.'}</div>
              <footer><span>✓</span> 이 공지를 확인했습니다.</footer>
            </article>
          ) : (
            <div className="notice-reader-empty"><span>🔔</span><p>왼쪽에서 공지를 선택하세요.</p></div>
          )}
        </section>
      </main>
    </div>
  );
}
