import { useEffect, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

const BACKEND = 'https://web-production-00104.up.railway.app';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('users');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me').then(r => {
      if (!r.data.is_admin) navigate('/');
      setUser(r.data);
    }).catch(() => navigate('/login'));
  }, []);

  const tabs = [
    ['users', '회원 관리'],
    ['teams', '팀 관리'],
    ['notices', '공지 관리'],
    ['banners', '배너 관리'],
    ['portfolios', '포트폴리오'],
    ['ai', 'AI 사용량'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0', marginBottom: 20 }}>관리자 패널</h2>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '10px 16px', border: 'none', borderBottom: tab === k ? '2px solid #ffd43b' : '2px solid transparent', background: 'transparent', color: tab === k ? '#ffd43b' : 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && <UsersTab />}
        {tab === 'teams' && <TeamsTab />}
        {tab === 'notices' && <NoticesTab />}
        {tab === 'banners' && <BannersTab />}
        {tab === 'portfolios' && <PortfoliosTab />}
        {tab === 'ai' && <AITab />}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    api.get('/api/admin/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/api/teams/').then(r => setTeams(r.data)).catch(() => {});
  }, []);

  const toggleAdmin = async (id, isAdmin) => {
    await api.patch(`/api/admin/users/${id}`, { is_admin: !isAdmin });
    setUsers(u => u.map(x => x.id === id ? { ...x, is_admin: !isAdmin } : x));
  };

  const assignTeam = async (id, teamId) => {
    await api.patch(`/api/admin/users/${id}`, { team_id: teamId || null });
    setUsers(u => u.map(x => x.id === id ? { ...x, team_id: teamId } : x));
  };

  const deleteUser = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    await api.delete(`/api/admin/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
  };

  return (
    <div>
      {users.map(u => (
        <div key={u.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0' }}>{u.username}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{u.email}</div>
          </div>
          <select value={u.team_id || ''} onChange={e => assignTeam(u.id, e.target.value)}
            style={{ padding: '5px 8px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: '#ccc', fontSize: 12, fontFamily: 'inherit' }}>
            <option value="">팀 없음</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => toggleAdmin(u.id, u.is_admin)}
            style={{ padding: '5px 12px', background: u.is_admin ? 'rgba(255,210,60,.15)' : 'rgba(255,255,255,.05)', border: '1px solid', borderColor: u.is_admin ? 'rgba(255,210,60,.3)' : 'rgba(255,255,255,.1)', borderRadius: 6, color: u.is_admin ? '#ffd43b' : 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {u.is_admin ? '관리자' : '일반'}
          </button>
          <button onClick={() => deleteUser(u.id)} style={dBtn}>삭제</button>
        </div>
      ))}
    </div>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [show, setShow] = useState(false);

  useEffect(() => { api.get('/api/teams/').then(r => setTeams(r.data)).catch(() => {}); }, []);

  const create = async () => {
    await api.post('/api/teams/', form);
    setForm({ name: '', description: '', color: '#3b82f6' });
    setShow(false);
    api.get('/api/teams/').then(r => setTeams(r.data));
  };

  const del = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    await api.delete(`/api/teams/${id}`);
    setTeams(t => t.filter(x => x.id !== id));
  };

  return (
    <div>
      <button onClick={() => setShow(f => !f)} style={yBtn}>+ 팀 추가</button>
      {show && (
        <div style={formBox}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="팀 이름" style={iStyle} />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="설명" style={iStyle} />
          <button onClick={create} style={yBtn}>생성</button>
        </div>
      )}
      {teams.map(t => (
        <div key={t.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0' }}>{t.name}</div>
            {t.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{t.description}</div>}
          </div>
          <button onClick={() => del(t.id)} style={dBtn}>삭제</button>
        </div>
      ))}
    </div>
  );
}

function NoticesTab() {
  const [notices, setNotices] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', is_pinned: false, team_id: '' });
  const [show, setShow] = useState(false);

  useEffect(() => {
    api.get('/api/notices/').then(r => setNotices(r.data)).catch(() => {});
    api.get('/api/teams/').then(r => setTeams(r.data)).catch(() => {});
  }, []);

  const create = async () => {
    await api.post('/api/notices/', { ...form, team_id: form.team_id || null });
    setForm({ title: '', content: '', is_pinned: false, team_id: '' });
    setShow(false);
    api.get('/api/notices/').then(r => setNotices(r.data));
  };

  const del = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    await api.delete(`/api/notices/${id}`);
    setNotices(n => n.filter(x => x.id !== id));
  };

  return (
    <div>
      <button onClick={() => setShow(f => !f)} style={yBtn}>+ 공지 작성</button>
      {show && (
        <div style={formBox}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="제목" style={iStyle} />
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="내용" rows={3} style={{ ...iStyle, resize: 'vertical' }} />
          <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
            style={{ ...iStyle, color: form.team_id ? '#e0e0e0' : 'rgba(255,255,255,.3)' }}>
            <option value="">전체 공지</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} style={{ accentColor: '#ffd43b' }} />
            고정 공지
          </label>
          <button onClick={create} style={yBtn}>등록</button>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        {notices.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>공지사항이 없습니다.</div>}
        {notices.map(n => (
          <div key={n.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {n.is_pinned && <span style={{ fontSize: 10, background: 'rgba(255,210,60,.15)', color: '#ffd43b', padding: '2px 6px', borderRadius: 4 }}>📌 고정</span>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0' }}>{n.title}</div>
              {n.content && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{n.content}</div>}
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
            <button onClick={() => del(n.id)} style={dBtn}>삭제</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BannersTab() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({ title: '', link_url: '', order_num: 0 });
  const [imageFile, setImageFile] = useState(null);
  const [show, setShow] = useState(false);
  const imgRef = { current: null };

  useEffect(() => { api.get('/api/banners/').then(r => setBanners(r.data)).catch(() => {}); }, []);

  const create = async () => {
    const formData = new FormData();
    if (form.title) formData.append('title', form.title);
    if (form.link_url) formData.append('link_url', form.link_url);
    formData.append('order_num', String(form.order_num));
    if (imageFile) formData.append('image_file', imageFile);
    await api.post('/api/banners/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    setForm({ title: '', link_url: '', order_num: 0 });
    setImageFile(null);
    setShow(false);
    api.get('/api/banners/').then(r => setBanners(r.data));
  };

  const del = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    await api.delete(`/api/banners/${id}`);
    setBanners(b => b.filter(x => x.id !== id));
  };

  const toggle = async (id, isActive) => {
    await api.patch(`/api/banners/${id}`, { is_active: !isActive });
    setBanners(b => b.map(x => x.id === id ? { ...x, is_active: !isActive } : x));
  };

  return (
    <div>
      <button onClick={() => setShow(f => !f)} style={yBtn}>+ 배너 추가</button>
      {show && (
        <div style={formBox}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="배너 제목 (이미지 없을 때 표시)" style={iStyle} />
          <input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="클릭 시 이동할 링크 URL (선택)" style={iStyle} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 6 }}>순서 번호 — 숫자가 작을수록 앞에 표시 (예: 1번이 2번보다 먼저)</div>
            <input value={form.order_num} onChange={e => setForm(f => ({ ...f, order_num: Number(e.target.value) }))} placeholder="순서 (0, 1, 2...)" type="number" style={iStyle} />
          </div>
          <div
            onClick={() => imgRef.current?.click()}
            style={{ border: '1px dashed rgba(255,255,255,.12)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,210,60,.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'}>
            <span>🖼️</span>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{imageFile ? imageFile.name : '배너 이미지 업로드 (선택)'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>JPG, PNG, WebP, GIF</div>
            </div>
          </div>
          <input ref={el => imgRef.current = el} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" onChange={e => setImageFile(e.target.files[0])} style={{ display: 'none' }} />
          <button onClick={create} style={yBtn}>추가</button>
        </div>
      )}
      {banners.map(b => {
        const imgUrl = b.image_url?.startsWith('/api') ? `${BACKEND}${b.image_url}` : b.image_url;
        return (
          <div key={b.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            {imgUrl && <img src={imgUrl} alt="" style={{ width: 60, height: 36, objectFit: 'cover', borderRadius: 6 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#d0d0d0' }}>{b.title || '제목 없음'} <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>순서: {b.order_num}</span></div>
              {b.link_url && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{b.link_url}</div>}
            </div>
            <button onClick={() => toggle(b.id, b.is_active)}
              style={{ padding: '5px 12px', background: b.is_active ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.05)', border: '1px solid', borderColor: b.is_active ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.1)', borderRadius: 6, color: b.is_active ? '#86efac' : 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {b.is_active ? '활성' : '비활성'}
            </button>
            <button onClick={() => del(b.id)} style={dBtn}>삭제</button>
          </div>
        );
      })}
    </div>
  );
}

function PortfoliosTab() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => { api.get('/api/admin/users').then(r => setUsers(r.data)).catch(() => {}); }, []);

  const view = async (userId) => {
    setSelected(userId);
    try {
      const r = await api.get(`/api/portfolio/${userId}`);
      setPortfolio(r.data);
    } catch { setPortfolio(null); }
  };

  const links = [
    { key: 'github_url', label: 'GitHub', icon: '🐙' },
    { key: 'blog_url', label: '블로그', icon: '📝' },
    { key: 'notion_url', label: 'Notion', icon: '📄' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>회원 목록</div>
        {users.map(u => (
          <div key={u.id} onClick={() => view(u.id)}
            style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: selected === u.id ? 'rgba(255,210,60,.1)' : 'rgba(255,255,255,.03)', border: `1px solid ${selected === u.id ? 'rgba(255,210,60,.3)' : 'rgba(255,255,255,.07)'}`, transition: 'all .15s' }}>
            <div style={{ fontSize: 13, color: selected === u.id ? '#ffd43b' : '#d0d0d0' }}>{u.username}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{u.email}</div>
          </div>
        ))}
      </div>

      <div>
        {!selected && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.2)', marginTop: 20 }}>왼쪽에서 회원을 선택하세요.</div>}
        {selected && !portfolio && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.2)', marginTop: 20 }}>포트폴리오가 없습니다.</div>}
        {portfolio && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '20px 24px' }}>
              {portfolio.profile_image && (
                <img src={`${BACKEND}${portfolio.profile_image}`} alt="프로필"
                  style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,210,60,.3)' }} />
              )}
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0' }}>{portfolio.username}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {links.map(l => portfolio[l.key] && (
                    <a key={l.key} href={portfolio[l.key]} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none' }}>{l.icon} {l.label}</a>
                  ))}
                </div>
              </div>
            </div>
            {[
              { key: 'intro', label: '자기소개' },
              { key: 'projects', label: '프로젝트' },
              { key: 'skills', label: '역량/기술' },
              { key: 'awards', label: '수상/활동' },
              { key: 'goals', label: '목표/진로' },
            ].map(s => portfolio[s.key] && (
              <div key={s.key} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                <div style={{ fontSize: 13, color: '#c0c0c0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{portfolio[s.key]}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AITab() {
  const [data, setData] = useState([]);
  useEffect(() => { api.get('/api/admin/ai-usage').then(r => setData(r.data)).catch(() => {}); }, []);
  return (
    <div>
      {data.map((d, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#d0d0d0' }}>{d.username}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{d.date}</div>
          </div>
          <div style={{ fontSize: 13, color: '#ffd43b' }}>{d.count}회 사용</div>
        </div>
      ))}
      {data.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>사용 내역이 없습니다.</div>}
    </div>
  );
}

const yBtn = { padding: '8px 16px', background: 'rgba(255,210,60,.12)', border: '1px solid rgba(255,210,60,.3)', borderRadius: 8, color: '#ffd43b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 };
const dBtn = { padding: '5px 10px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#fca5a5', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
const formBox = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 };
const iStyle = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#e0e0e0', fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box', marginBottom: 10 };