import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [banners, setBanners] = useState([]);
  const [aiUsage, setAiUsage] = useState([]);
  const [tab, setTab] = useState('users');
  const [newTeam, setNewTeam] = useState({ name: '', description: '', color: '#3b82f6' });
  const [newBanner, setNewBanner] = useState({ title: '', image_url: '', link_url: '', order_num: 0 });
  const [newNotice, setNewNotice] = useState({ title: '', content: '', is_pinned: false });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me').then(r => {
      if (!r.data.is_admin) navigate('/');
      setUser(r.data);
    }).catch(() => navigate('/login'));
    loadAll();
  }, []);

  const loadAll = () => {
    api.get('/api/admin/users').then(r => setUsers(r.data)).catch(() => {});
    api.get('/api/teams/').then(r => setTeams(r.data)).catch(() => {});
    api.get('/api/banners/').then(r => setBanners(r.data)).catch(() => {});
    api.get('/api/admin/ai-usage').then(r => setAiUsage(r.data)).catch(() => {});
  };

  const toggleAdmin = async (id) => {
    await api.patch(`/api/admin/users/${id}/admin`);
    loadAll();
  };

  const deleteUser = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    await api.delete(`/api/admin/users/${id}`);
    loadAll();
  };

  const createTeam = async () => {
    await api.post('/api/teams/', newTeam);
    setNewTeam({ name: '', description: '', color: '#3b82f6' });
    loadAll();
  };

  const deleteTeam = async (id) => {
    if (!window.confirm('팀을 삭제할까요?')) return;
    await api.delete(`/api/teams/${id}`);
    loadAll();
  };

  const createBanner = async () => {
    await api.post('/api/banners/', newBanner);
    setNewBanner({ title: '', image_url: '', link_url: '', order_num: 0 });
    loadAll();
  };

  const deleteBanner = async (id) => {
    if (!window.confirm('배너를 삭제할까요?')) return;
    await api.delete(`/api/banners/${id}`);
    loadAll();
  };

  const createNotice = async () => {
    await api.post('/api/notices/', newNotice);
    setNewNotice({ title: '', content: '', is_pinned: false });
  };

  const tabs = [['users', '회원 관리'], ['teams', '팀 관리'], ['banners', '배너 관리'], ['notices', '공지 등록'], ['ai', 'AI 사용량']];

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0', marginBottom: 24 }}>관리자 패널</h2>

        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 0 }}>
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '9px 16px', border: 'none', borderBottom: tab === k ? '2px solid #ffd43b' : '2px solid transparent', background: 'transparent', color: tab === k ? '#ffd43b' : 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div>
            {users.map(u => (
              <div key={u.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, color: '#d0d0d0', fontWeight: 500 }}>{u.username}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginLeft: 10 }}>{u.email}</span>
                  {u.is_admin && <span style={{ fontSize: 10, background: 'rgba(255,210,60,.15)', color: '#ffd43b', padding: '2px 7px', borderRadius: 6, marginLeft: 8 }}>관리자</span>}
                </div>
                <button onClick={() => toggleAdmin(u.id)} style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {u.is_admin ? '권한 해제' : '관리자 지정'}
                </button>
                <button onClick={() => deleteUser(u.id)} style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#fca5a5', cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'teams' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>새 팀 추가</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
                <input value={newTeam.name} onChange={e => setNewTeam(t => ({ ...t, name: e.target.value }))} placeholder="팀 이름" style={iStyle} />
                <input value={newTeam.description} onChange={e => setNewTeam(t => ({ ...t, description: e.target.value }))} placeholder="설명" style={iStyle} />
                <button onClick={createTeam} style={btnYellow}>추가</button>
              </div>
            </div>
            {teams.map(t => (
              <div key={t.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, marginRight: 12 }} />
                <span style={{ fontSize: 14, color: '#d0d0d0', fontWeight: 500, flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{t.description}</span>
                <button onClick={() => deleteTeam(t.id)} style={{ ...btnRed, marginLeft: 12 }}>삭제</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'banners' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>새 배너 추가</div>
              <input value={newBanner.title} onChange={e => setNewBanner(b => ({ ...b, title: e.target.value }))} placeholder="배너 제목" style={{ ...iStyle, width: '100%', marginBottom: 10 }} />
              <input value={newBanner.image_url} onChange={e => setNewBanner(b => ({ ...b, image_url: e.target.value }))} placeholder="이미지 URL" style={{ ...iStyle, width: '100%', marginBottom: 10 }} />
              <input value={newBanner.link_url} onChange={e => setNewBanner(b => ({ ...b, link_url: e.target.value }))} placeholder="링크 URL" style={{ ...iStyle, width: '100%', marginBottom: 10 }} />
              <button onClick={createBanner} style={btnYellow}>추가</button>
            </div>
            {banners.map(b => (
              <div key={b.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: '#d0d0d0', flex: 1 }}>{b.title}</span>
                <button onClick={() => deleteBanner(b.id)} style={btnRed}>삭제</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'notices' && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '20px 22px' }}>
            <input value={newNotice.title} onChange={e => setNewNotice(n => ({ ...n, title: e.target.value }))} placeholder="공지 제목" style={{ ...iStyle, width: '100%', marginBottom: 10 }} />
            <textarea value={newNotice.content} onChange={e => setNewNotice(n => ({ ...n, content: e.target.value }))} placeholder="공지 내용" rows={4} style={{ ...iStyle, width: '100%', resize: 'vertical', marginBottom: 10 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={newNotice.is_pinned} onChange={e => setNewNotice(n => ({ ...n, is_pinned: e.target.checked }))} style={{ accentColor: '#ffd43b' }} /> 상단 고정
            </label>
            <button onClick={createNotice} style={btnYellow}>공지 등록</button>
          </div>
        )}

        {tab === 'ai' && (
          <div>
            {aiUsage.length === 0 ? <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13 }}>사용 내역이 없습니다.</div> :
              aiUsage.map((u, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 14, color: '#d0d0d0', fontWeight: 500, minWidth: 100 }}>{u.username}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>{u.date}</span>
                  <span style={{ fontSize: 12, color: '#ffd43b' }}>{u.count}회 사용</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

const iStyle = { padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: '#e0e0e0', fontSize: 13, outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' };
const btnYellow = { padding: '9px 18px', background: 'rgba(255,210,60,.12)', border: '1px solid rgba(255,210,60,.3)', borderRadius: 8, color: '#ffd43b', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
const btnRed = { padding: '5px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#fca5a5', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };