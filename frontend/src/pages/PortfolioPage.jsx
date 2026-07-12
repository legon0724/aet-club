import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';
import { fileToDataUrl, getLocalPortfolio, getPublicLocalPortfolios, saveLocalPortfolio } from '../utils/localWorkspace';

const BACKEND = 'https://web-production-00104.up.railway.app';

const emptyForm = {
  intro: '',
  projects: '',
  skills: '',
  awards: '',
  goals: '',
  is_public: false,
  github_url: '',
  blog_url: '',
  notion_url: '',
};

const links = [
  { key: 'github_url', label: 'GitHub' },
  { key: 'blog_url', label: 'Blog' },
  { key: 'notion_url', label: 'Notion' },
];

const sections = [
  { key: 'intro', label: '자기소개', placeholder: '관심 분야, 성격, 작업 방식이 드러나게 작성하세요.' },
  { key: 'projects', label: '프로젝트', placeholder: '프로젝트명, 기간, 역할, 사용 기술, 결과를 정리하세요.' },
  { key: 'skills', label: '역량 / 기술', placeholder: '언어, 프레임워크, 협업 도구, 강점을 나눠 적으세요.' },
  { key: 'awards', label: '수상 / 활동', placeholder: '대회, 활동, 맡은 역할과 결과를 함께 기록하세요.' },
  { key: 'goals', label: '목표 / 진로', placeholder: '앞으로 만들고 싶은 것과 진로 방향을 작성하세요.' },
];

const portfolioLine = [
  { step: '01', label: '프로필', detail: '기본 정보 정리' },
  { step: '02', label: '활동', detail: '프로젝트와 역량 기록' },
  { step: '03', label: '제출', detail: '공개 여부와 링크 점검' },
];

const resolveFileUrl = (value = '') => (value?.startsWith('/api') ? `${BACKEND}${value}` : value);

const isOwnPortfolio = (item, activeUser) => {
  const sameEmail = item.email?.toLowerCase() === activeUser?.email?.toLowerCase();
  const sameId = String(item.user_id || '') === String(activeUser?.id || '');
  return sameEmail || sameId;
};

export default function PortfolioPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [portfolio, setPortfolio] = useState({});
  const [publicPortfolios, setPublicPortfolios] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [profileImage, setProfileImage] = useState(null);
  const [profilePreview, setProfilePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const imgRef = useRef(null);

  const hydratePortfolio = useCallback((data) => {
    const next = { ...emptyForm, ...data };
    setPortfolio(next);
    setForm({
      intro: next.intro || '',
      projects: next.projects || '',
      skills: next.skills || '',
      awards: next.awards || '',
      goals: next.goals || '',
      is_public: Boolean(next.is_public),
      github_url: next.github_url || '',
      blog_url: next.blog_url || '',
      notion_url: next.notion_url || '',
    });
    if (next.profile_image) {
      setProfilePreview(resolveFileUrl(next.profile_image));
    }
  }, []);

  const loadPortfolio = useCallback((activeUser) => {
    const resolvedUser = activeUser || getCurrentLocalUser();
    api.get('/api/portfolio/me').then((r) => hydratePortfolio(r.data)).catch(() => {
      hydratePortfolio(getLocalPortfolio(resolvedUser));
    });
  }, [hydratePortfolio]);

  const loadPublicPortfolios = useCallback((activeUser) => {
    const resolvedUser = activeUser || getCurrentLocalUser();
    api.get('/api/portfolio/public').then((r) => {
      setPublicPortfolios((r.data || []).filter((item) => !isOwnPortfolio(item, resolvedUser)));
    }).catch(() => {
      setPublicPortfolios(getPublicLocalPortfolios(resolvedUser));
    });
  }, []);

  useEffect(() => {
    const localUser = getCurrentLocalUser();
    api.get('/api/auth/me').then((r) => {
      const remembered = rememberCurrentUser(r.data);
      setUser(remembered);
      loadPortfolio(remembered);
      loadPublicPortfolios(remembered);
    }).catch(() => {
      loadPortfolio(localUser);
      loadPublicPortfolios(localUser);
    });
  }, [loadPortfolio, loadPublicPortfolios]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfileImage(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const persistPortfolio = async (nextForm, options = {}) => {
    setSaving(true);
    setMsg('');
    const activeUser = user || getCurrentLocalUser();
    const { closeEditor = true, message = '저장되었습니다.' } = options;

    try {
      const formData = new FormData();
      Object.entries(nextForm).forEach(([key, value]) => formData.append(key, String(value ?? '')));
      if (profileImage) formData.append('profile_image_file', profileImage);
      await api.put('/api/portfolio/me', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg(message);
      if (closeEditor) setEditing(false);
      loadPortfolio(activeUser);
      loadPublicPortfolios(activeUser);
    } catch {
      const imageData = profileImage ? await fileToDataUrl(profileImage) : portfolio.profile_image;
      const saved = saveLocalPortfolio(activeUser, { ...nextForm, profile_image: imageData || '' });
      hydratePortfolio(saved);
      loadPublicPortfolios(activeUser);
      setMsg(message);
      if (closeEditor) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const save = () => persistPortfolio(form);

  const handleVisibilityChange = (e) => {
    const isPublic = e.target.checked;
    const nextForm = { ...form, is_public: isPublic };
    setForm(nextForm);
    persistPortfolio(nextForm, {
      closeEditor: false,
      message: isPublic ? '공개로 저장되었습니다.' : '비공개로 저장되었습니다.',
    });
  };

  const printPortfolio = () => {
    const previousTitle = document.title;
    const fileName = `${user?.username || 'NC'}-portfolio`;

    document.title = fileName;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };

    window.addEventListener('afterprint', restoreTitle);
    window.print();
    window.setTimeout(restoreTitle, 1000);
  };

  const printPortfolioData = editing ? form : portfolio;

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="workspace-page portfolio-page">
        <section className="portfolio-print-document" aria-hidden="true">
          <header>
            <span>NC Portfolio</span>
            <h1>{user?.username || 'NC member'}</h1>
            <p>{user?.email || 'school email'}</p>
          </header>
          <div className="portfolio-print-links">
            {links.map((link) => printPortfolioData[link.key] && (
              <p key={link.key}><strong>{link.label}</strong> {printPortfolioData[link.key]}</p>
            ))}
          </div>
          {sections.map((section, index) => (
            <article key={section.key}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{section.label}</h2>
              <p>{printPortfolioData[section.key] || `${section.label} 내용을 추가해 주세요.`}</p>
            </article>
          ))}
        </section>

        <section className="page-hero compact">
          <div>
            <span>Portfolio</span>
            <h1>활동 기록을 대학 제출용으로 정리합니다.</h1>
            <p>프로젝트, 기술, 수상, 진로를 한 화면에서 관리하세요.</p>
          </div>
          <div className="portfolio-hero-side">
            <div className="portfolio-actions">
              <button className="modern-btn ghost" type="button" onClick={printPortfolio}>PDF 저장</button>
              <button className="modern-btn primary" type="button" onClick={() => setEditing((current) => !current)}>
                {editing ? '보기로 전환' : '편집'}
              </button>
            </div>
            <div className="peer-portfolio-panel" aria-label="공개된 다른 포트폴리오">
              <span>다른 애들</span>
              {publicPortfolios.length ? (
                <div className="peer-portfolio-list">
                  {publicPortfolios.map((item) => (
                    <article key={item.user_id || item.email} className="peer-portfolio-card">
                      {item.profile_image ? (
                        <img src={resolveFileUrl(item.profile_image)} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <strong>{(item.username || item.email || 'N')[0]}</strong>
                      )}
                      <div>
                        <b>{item.username || 'NC member'}</b>
                        <small>{item.intro || item.projects || item.skills || '공개된 포트폴리오입니다.'}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>아직 공개된 친구 포트폴리오가 없습니다.</p>
              )}
            </div>
          </div>
        </section>

        <section className="portfolio-line" aria-label="포트폴리오 작성 흐름">
          {portfolioLine.map((item) => (
            <div key={item.step} className="portfolio-line-item">
              <span>{item.step}</span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </section>

        <section className="profile-card">
          <button className="profile-avatar" type="button" onClick={() => editing && imgRef.current?.click()} disabled={!editing}>
            {profilePreview ? <img src={profilePreview} alt="프로필" loading="lazy" decoding="async" /> : <span>{(user?.username || 'N')[0]}</span>}
            {editing && <small>변경</small>}
          </button>
          <input ref={imgRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleImageChange} hidden />

          <div className="profile-meta">
            <strong>{user?.username || 'NC member'}</strong>
            <span>{user?.email || 'school email'}</span>
            {editing ? (
              <div className="link-editor">
                {links.map((link) => (
                  <input
                    key={link.key}
                    value={form[link.key]}
                    onChange={(e) => setForm((current) => ({ ...current, [link.key]: e.target.value }))}
                    placeholder={`${link.label} URL`}
                  />
                ))}
              </div>
            ) : (
              <div className="pill-row">
                {links.map((link) => portfolio[link.key] && (
                  <a key={link.key} href={portfolio[link.key]} target="_blank" rel="noreferrer">{link.label}</a>
                ))}
                {!links.some((link) => portfolio[link.key]) && <span>링크를 추가해 주세요</span>}
              </div>
            )}
          </div>

          <label className="public-toggle">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={handleVisibilityChange}
              disabled={saving}
            />
            공개
            {saving && <small>저장 중...</small>}
          </label>
        </section>

        {msg && <div className="inline-alert success">{msg}</div>}

        <section className="portfolio-grid">
          {sections.map((section, index) => (
            <article key={section.key} className="workspace-card portfolio-entry">
              <span className="portfolio-entry-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="card-head">
                <span>{section.label}</span>
              </div>
              {editing ? (
                <textarea
                  className="workspace-textarea"
                  value={form[section.key]}
                  onChange={(e) => setForm((current) => ({ ...current, [section.key]: e.target.value }))}
                  rows={7}
                  placeholder={section.placeholder}
                />
              ) : (
                <p className={portfolio[section.key] ? 'portfolio-text' : 'portfolio-text muted'}>
                  {portfolio[section.key] || `${section.label} 내용을 추가해 주세요.`}
                </p>
              )}
            </article>
          ))}
        </section>

        {editing && (
          <div className="floating-save">
            <button className="modern-btn ghost" type="button" onClick={() => { setEditing(false); loadPortfolio(); }}>취소</button>
            <button className="modern-btn primary" type="button" onClick={save} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
