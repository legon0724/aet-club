import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

const BACKEND = 'https://web-production-00104.up.railway.app';

export default function PortfolioPage() {
  const [user, setUser] = useState(null);
  const [portfolio, setPortfolio] = useState({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    intro: '', projects: '', skills: '', awards: '', goals: '',
    is_public: false, github_url: '', blog_url: '', notion_url: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const imgRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me').then(r => setUser(r.data)).catch(() => navigate('/login'));
    loadPortfolio();
  }, []);

  const loadPortfolio = () => {
    api.get('/api/portfolio/me').then(r => {
      setPortfolio(r.data);
      setForm({
        intro: r.data.intro || '',
        projects: r.data.projects || '',
        skills: r.data.skills || '',
        awards: r.data.awards || '',
        goals: r.data.goals || '',
        is_public: r.data.is_public || false,
        github_url: r.data.github_url || '',
        blog_url: r.data.blog_url || '',
        notion_url: r.data.notion_url || '',
      });
      if (r.data.profile_image) {
        setProfilePreview(`${BACKEND}${r.data.profile_image}`);
      }
    }).catch(() => {});
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfileImage(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) formData.append(k, String(v));
      });
      if (profileImage) formData.append('profile_image_file', profileImage);
      await api.put('/api/portfolio/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMsg('저장되었습니다.');
      setEditing(false);
      loadPortfolio();
    } catch { setMsg('저장 실패'); }
    finally { setSaving(false); }
  };

  const links = [
    { key: 'github_url', label: 'GitHub', icon: '🐙', color: '#e0e0e0' },
    { key: 'blog_url', label: '블로그', icon: '📝', color: '#60a5fa' },
    { key: 'notion_url', label: 'Notion', icon: '📄', color: '#a78bfa' },
  ];

  const sections = [
    { key: 'intro', label: '자기소개', icon: '👤', placeholder: '자신을 소개해주세요.\n관심사, 성격, 가치관 등을 자유롭게 작성하세요.' },
    { key: 'projects', label: '프로젝트', icon: '🚀', placeholder: '[프로젝트명]\n- 기간:\n- 역할:\n- 사용 기술:\n- 성과:\n- GitHub/링크:' },
    { key: 'skills', label: '역량 / 기술', icon: '⚡', placeholder: '프로그래밍: Python, C++\nAI/ML: TensorFlow, PyTorch\n기타: Git, Linux' },
    { key: 'awards', label: '수상 / 활동', icon: '🏆', placeholder: '[대회명] - 수상내용 (날짜)\n[활동명] - 역할 (기간)' },
    { key: 'goals', label: '목표 / 진로', icon: '🎯', placeholder: '앞으로의 목표와 진로 계획을 작성해주세요.' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>

        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: '32px', marginBottom: 24, display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0 }}>
            <div onClick={() => editing && imgRef.current.click()}
              style={{ width: 100, height: 100, borderRadius: '50%', background: profilePreview ? 'none' : 'rgba(255,210,60,.12)', border: `2px solid ${profilePreview ? 'rgba(255,210,60,.4)' : 'rgba(255,255,255,.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: editing ? 'pointer' : 'default', overflow: 'hidden', position: 'relative' }}>
              {profilePreview
                ? <img src={profilePreview} alt="프로필" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 36 }}>👤</span>
              }
              {editing && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>
                  변경
                </div>
              )}
            </div>
            <input ref={imgRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleImageChange} style={{ display: 'none' }} />
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>{user?.username}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 18 }}>{user?.email}</div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.map(l => (
                  <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, width: 20 }}>{l.icon}</span>
                    <input value={form[l.key]} onChange={e => setForm(f => ({ ...f, [l.key]: e.target.value }))}
                      placeholder={`${l.label} URL`}
                      style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 7, color: '#ddd', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {links.map(l => portfolio[l.key] && (
                  <a key={l.key} href={portfolio[l.key]} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, fontSize: 12, color: l.color, textDecoration: 'none' }}>
                    {l.icon} {l.label}
                  </a>
                ))}
                {!portfolio.github_url && !portfolio.blog_url && !portfolio.notion_url && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>편집을 눌러 링크를 추가하세요</span>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} style={{ accentColor: '#ffd43b' }} />
              공개
            </label>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); loadPortfolio(); }} style={ghostBtn}>취소</button>
                <button onClick={save} disabled={saving} style={yellowBtn}>{saving ? '저장 중...' : '저장'}</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} style={yellowBtn}>편집</button>
            )}
          </div>
        </div>

        {msg && <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: '10px 14px', color: '#86efac', fontSize: 13, marginBottom: 16 }}>{msg}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sections.map(s => (
            <div key={s.key} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '24px 26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
              {editing ? (
                <textarea value={form[s.key]} onChange={e => setForm(f => ({ ...f, [s.key]: e.target.value }))}
                  rows={6} placeholder={s.placeholder}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#e0e0e0', fontSize: 14, padding: '12px 14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.7 }} />
              ) : (
                <div style={{ fontSize: 14, color: portfolio[s.key] ? '#c0c0c0' : 'rgba(255,255,255,.2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', minHeight: 32 }}>
                  {portfolio[s.key] || `${s.label} 내용을 추가해주세요.`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const yellowBtn = { padding: '8px 18px', background: 'rgba(255,210,60,.12)', border: '1px solid rgba(255,210,60,.4)', borderRadius: 8, color: '#ffd43b', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
const ghostBtn = { padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };