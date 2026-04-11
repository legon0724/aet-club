import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';

export default function TeamPage() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [tab, setTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [newSub, setNewSub] = useState({ title: '', content: '', link_url: '' });
  const [subFile, setSubFile] = useState(null);
  const [showSubForm, setShowSubForm] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/auth/me').then(r => setUser(r.data)).catch(() => navigate('/login'));
    api.get('/api/teams/').then(r => {
      setTeams(r.data);
      if (r.data.length > 0) setSelectedTeam(r.data[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    connectWs(selectedTeam.id);
    loadSubmissions(selectedTeam.id);
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [selectedTeam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connectWs = (teamId) => {
    if (wsRef.current) wsRef.current.close();
    setMessages([]);
    const token = localStorage.getItem('token');
    const ws = new WebSocket(`ws://127.0.0.1:8000/api/chat/ws/${teamId}?token=${token}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setMessages(prev => [...prev, msg]);
    };
    ws.onerror = () => console.log('ws error');
    wsRef.current = ws;
  };

  const loadSubmissions = (teamId) => {
    api.get(`/api/submissions/?team_id=${teamId}`).then(r => setSubmissions(r.data)).catch(() => {});
  };

  const sendMsg = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ content: input.trim() }));
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const submitSub = async () => {
    if (!newSub.title) return;
    try {
      const formData = new FormData();
      formData.append('title', newSub.title);
      if (newSub.content) formData.append('content', newSub.content);
      if (newSub.link_url) formData.append('link_url', newSub.link_url);
      if (selectedTeam) formData.append('team_id', selectedTeam.id);
      if (subFile) formData.append('file', subFile);

      await api.post('/api/submissions/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setNewSub({ title: '', content: '', link_url: '' });
      setSubFile(null);
      setShowSubForm(false);
      loadSubmissions(selectedTeam.id);
    } catch (e) { alert(e.response?.data?.detail || '실패'); }
  };

  const deleteSub = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    await api.delete(`/api/submissions/${id}`);
    setSubmissions(s => s.filter(x => x.id !== id));
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <Navbar user={user} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0', marginBottom: 20 }}>팀 공간</h2>

        {/* 팀 선택 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {teams.length === 0 && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>팀이 없습니다. 관리자에게 문의하세요.</div>}
          {teams.map(t => (
            <button key={t.id} onClick={() => setSelectedTeam(t)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'all .2s', background: selectedTeam?.id === t.id ? 'rgba(255,210,60,.12)' : 'transparent', borderColor: selectedTeam?.id === t.id ? 'rgba(255,210,60,.4)' : 'rgba(255,255,255,.1)', color: selectedTeam?.id === t.id ? '#ffd43b' : 'rgba(255,255,255,.5)' }}>
              {t.name}
            </button>
          ))}
        </div>

        {selectedTeam && (
          <>
            {/* 탭 */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 20 }}>
              {[['chat', '💬 채팅'], ['submissions', '📎 과제 제출']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{ padding: '10px 20px', border: 'none', borderBottom: tab === k ? '2px solid #ffd43b' : '2px solid transparent', background: 'transparent', color: tab === k ? '#ffd43b' : 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* 채팅 */}
            {tab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 520 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 13, marginTop: 40 }}>첫 메시지를 보내보세요 👋</div>
                  )}
                  {messages.map((msg, i) => {
                    const isMe = msg.username === user?.username;
                    return (
                      <div key={msg.id || i} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                        {!isMe && (
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,210,60,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#ffd43b', fontWeight: 600, flexShrink: 0 }}>
                            {msg.username[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ maxWidth: '65%' }}>
                          {!isMe && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>{msg.username}</div>}
                          <div style={{ background: isMe ? 'rgba(255,210,60,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${isMe ? 'rgba(255,210,60,.25)' : 'rgba(255,255,255,.08)'}`, borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '10px 14px', fontSize: 14, color: '#e0e0e0', lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {msg.content}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{formatTime(msg.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                    placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
                    rows={2}
                    style={{ flex: 1, padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, color: '#e0e0e0', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  <button onClick={sendMsg}
                    style={{ padding: '0 20px', background: 'rgba(255,210,60,.12)', border: '1px solid rgba(255,210,60,.3)', borderRadius: 10, color: '#ffd43b', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    전송
                  </button>
                </div>
              </div>
            )}

            {/* 과제 제출 */}
            {tab === 'submissions' && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setShowSubForm(f => !f)}
                    style={{ padding: '8px 16px', background: 'rgba(255,210,60,.12)', border: '1px solid rgba(255,210,60,.3)', borderRadius: 8, color: '#ffd43b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + 과제 제출
                  </button>
                  {showSubForm && (
                    <div style={{ marginTop: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px' }}>
                      <input value={newSub.title} onChange={e => setNewSub(s => ({ ...s, title: e.target.value }))} placeholder="제목 *" style={iStyle} />
                      <textarea value={newSub.content} onChange={e => setNewSub(s => ({ ...s, content: e.target.value }))} placeholder="내용 (선택)" rows={3} style={{ ...iStyle, resize: 'vertical' }} />
                      <input value={newSub.link_url} onChange={e => setNewSub(s => ({ ...s, link_url: e.target.value }))} placeholder="링크 URL (선택) - GitHub, Drive 등" style={iStyle} />

                      <div onClick={() => fileRef.current.click()}
                        style={{ border: '1px dashed rgba(255,255,255,.12)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,210,60,.3)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'}>
                        <span>📎</span>
                        <div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{subFile ? subFile.name : '파일 첨부 (선택)'}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>PDF, HWP, DOCX, PPTX, XLSX, 이미지, ZIP (20MB 이하)</div>
                        </div>
                      </div>
                      <input ref={fileRef} type="file" accept=".pdf,.hwp,.hwpx,.docx,.doc,.txt,.pptx,.xlsx,.png,.jpg,.jpeg,.zip" onChange={e => setSubFile(e.target.files[0])} style={{ display: 'none' }} />

                      <button onClick={submitSub} style={{ padding: '8px 16px', background: 'rgba(255,210,60,.12)', border: '1px solid rgba(255,210,60,.3)', borderRadius: 8, color: '#ffd43b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>제출</button>
                    </div>
                  )}
                </div>

                {submissions.length === 0
                  ? <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 13 }}>제출물이 없습니다.</div>
                  : submissions.map(s => (
                    <div key={s.id} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#d0d0d0' }}>{s.title}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{s.username}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                        {(user?.is_admin || s.username === user?.username) && (
                          <button onClick={() => deleteSub(s.id)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'rgba(239,68,68,.5)', cursor: 'pointer' }}>삭제</button>
                        )}
                      </div>
                      {s.content && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 6, lineHeight: 1.6 }}>{s.content}</div>}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                        {s.file_name && (
                          <a href={`http://127.0.0.1:8000${s.file_url}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: '#a78bfa', textDecoration: 'none' }}>
                            📄 {s.file_name}
                          </a>
                        )}
                        {s.link_url && (
                          <a href={s.link_url} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none' }}>
                            🔗 링크 열기
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const iStyle = {
  width: '100%', padding: '10px 12px',
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 8, color: '#e0e0e0',
  fontSize: 13, outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
  boxSizing: 'border-box', marginBottom: 10,
};