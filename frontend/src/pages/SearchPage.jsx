import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser } from '../utils/localAuth';

export default function SearchPage() {
  const [user] = useState(() => getCurrentLocalUser());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (e) => {
    e.preventDefault();
    const nextQuery = query.trim();
    setError('');
    if (nextQuery.length < 2) {
      setResults([]);
      setSearched(true);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await api.get('/api/search/', { params: { q: nextQuery } });
      setResults(response.data || []);
    } catch {
      setResults([]);
      setError('검색 결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="workspace-page search-page">
        <section className="page-hero compact search-hero">
          <div>
            <span>Search</span>
            <h1>공지, 과제, 포트폴리오를 한 번에 찾습니다.</h1>
            <p>필요한 자료를 기억나는 단어로 빠르게 찾아보세요.</p>
          </div>
          <form className="search-box" onSubmit={runSearch}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="검색어 입력" />
            <button className="modern-btn primary" type="submit">{loading ? '검색 중' : '검색'}</button>
          </form>
        </section>

        <section className="search-result-panel" aria-label="검색 결과">
          {error && <div className="inline-alert error">{error}</div>}
          {!searched && <p className="empty-state">두 글자 이상 입력하면 검색을 시작합니다.</p>}
          {searched && results.length === 0 && <p className="empty-state">검색 결과가 없습니다.</p>}
          {results.map((item) => (
            <Link key={`${item.type}-${item.id}`} to={item.href || '/'} className="search-result-card">
              <span>{item.type}</span>
              <strong>{item.title}</strong>
              {item.snippet && <p>{item.snippet}</p>}
              {item.date && <small>{new Date(item.date).toLocaleDateString()}</small>}
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
