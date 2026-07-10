import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';
import {
  DEFAULT_TEAMS,
  addLocalMessage,
  addLocalSubmission,
  deleteLocalSubmission,
  getLocalMessages,
  getLocalSubmissions,
} from '../utils/localWorkspace';

const socketUrl = 'wss://web-production-00104.up.railway.app/api/chat/ws';

export default function TeamPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [selectedTeam, setSelectedTeam] = useState(DEFAULT_TEAMS[0]);
  const [tab, setTab] = useState('submissions');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [newSub, setNewSub] = useState({ title: '', content: '', link_url: '' });
  const [subFile, setSubFile] = useState(null);
  const [showSubForm, setShowSubForm] = useState(true);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/api/auth/me').then((r) => setUser(rememberCurrentUser(r.data))).catch(() => {});
    api.get('/api/teams/').then((r) => {
      const nextTeams = r.data.length ? r.data : DEFAULT_TEAMS;
      setTeams(nextTeams);
      setSelectedTeam(nextTeams[0]);
    }).catch(() => {
      setTeams(DEFAULT_TEAMS);
      setSelectedTeam(DEFAULT_TEAMS[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedTeam) return undefined;
    connectWs(selectedTeam.id);
    loadSubmissions(selectedTeam.id);
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedTeam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function connectWs(teamId) {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    setMessages(getLocalMessages(teamId));

    const token = localStorage.getItem('token');
    if (!token || token.startsWith('local:')) return;

    try {
      const ws = new WebSocket(`${socketUrl}/${teamId}?token=${token}`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        setMessages((current) => [...current, msg]);
      };
      ws.onerror = () => {
        wsRef.current = null;
        setMessages(getLocalMessages(teamId));
      };
      wsRef.current = ws;
    } catch {
      wsRef.current = null;
    }
  }

  function loadSubmissions(teamId) {
    api.get(`/api/submissions/?team_id=${teamId}`).then((r) => setSubmissions(r.data)).catch(() => {
      setSubmissions(getLocalSubmissions(teamId));
    });
  }

  const sendMsg = () => {
    const content = input.trim();
    if (!content || !selectedTeam) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content }));
    } else {
      setMessages(addLocalMessage(selectedTeam.id, user, content));
    }
    setInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  const submitSub = async () => {
    if (!newSub.title.trim() || !selectedTeam) return;
    try {
      const formData = new FormData();
      formData.append('title', newSub.title.trim());
      if (newSub.content) formData.append('content', newSub.content);
      if (newSub.link_url) formData.append('link_url', newSub.link_url);
      formData.append('team_id', selectedTeam.id);
      if (subFile) formData.append('file', subFile);

      await api.post('/api/submissions/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadSubmissions(selectedTeam.id);
    } catch {
      setSubmissions(addLocalSubmission(selectedTeam.id, user, newSub, subFile?.name || ''));
    } finally {
      setNewSub({ title: '', content: '', link_url: '' });
      setSubFile(null);
      setShowSubForm(false);
    }
  };

  const deleteSub = async (id) => {
    if (!window.confirm('삭제할까요?')) return;
    try {
      if (!String(id).startsWith('local-sub-')) {
        await api.delete(`/api/submissions/${id}`);
      }
    } catch {
      // Keep the local view responsive even when the remote API is unavailable.
    }
    deleteLocalSubmission(id);
    setSubmissions((current) => current.filter((item) => item.id !== id));
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="workspace-page team-page">
        <section className="page-hero compact">
          <div>
            <span>Team Space</span>
            <h1>팀 대화와 과제 제출을 같은 흐름으로 묶었습니다.</h1>
            <p>과제 제출 칸을 기본으로 열어 두어 제출 위치가 바로 보입니다.</p>
          </div>
          <button className="modern-btn primary" type="button" onClick={() => { setTab('submissions'); setShowSubForm(true); }}>
            과제 제출
          </button>
        </section>

        <div className="team-switcher" aria-label="팀 선택">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              className={selectedTeam?.id === team.id ? 'active' : ''}
              onClick={() => setSelectedTeam(team)}
              style={{ '--team-color': team.color }}
            >
              <strong>{team.name}</strong>
              <span>{team.description}</span>
            </button>
          ))}
        </div>

        <section className="workspace-card team-board">
          <div className="workspace-tabs">
            {[
              ['submissions', '과제 제출'],
              ['chat', '팀 채팅'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'submissions' && (
            <div className="submission-layout">
              <div className="submission-head">
                <div>
                  <span>{selectedTeam?.name}</span>
                  <h2>과제 제출</h2>
                </div>
                <button className="modern-btn ghost" type="button" onClick={() => setShowSubForm((current) => !current)}>
                  {showSubForm ? '접기' : '새 제출'}
                </button>
              </div>

              {showSubForm && (
                <div className="submission-form">
                  <input value={newSub.title} onChange={(e) => setNewSub((current) => ({ ...current, title: e.target.value }))} placeholder="과제 제목" />
                  <textarea value={newSub.content} onChange={(e) => setNewSub((current) => ({ ...current, content: e.target.value }))} placeholder="설명이나 제출 메모" rows={4} />
                  <input value={newSub.link_url} onChange={(e) => setNewSub((current) => ({ ...current, link_url: e.target.value }))} placeholder="링크 URL" />
                  <div className="file-picker" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
                    <span>{subFile ? subFile.name : '파일 첨부'}</span>
                    <small>PDF, 이미지, 문서 파일</small>
                  </div>
                  <input ref={fileRef} type="file" onChange={(e) => setSubFile(e.target.files[0])} hidden />
                  <button className="modern-btn primary" type="button" onClick={submitSub}>제출하기</button>
                </div>
              )}

              <div className="submission-list">
                {submissions.length === 0 && <p className="empty-state">아직 제출된 과제가 없습니다.</p>}
                {submissions.map((item) => (
                  <article key={item.id} className="submission-item">
                    <div>
                      <span>{item.username}</span>
                      <h3>{item.title}</h3>
                      {item.content && <p>{item.content}</p>}
                      {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer">{item.link_url}</a>}
                      {item.file_name && <small>{item.file_name}</small>}
                    </div>
                    <div className="submission-actions">
                      <time>{new Date(item.created_at).toLocaleDateString()}</time>
                      <button type="button" onClick={() => deleteSub(item.id)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab === 'chat' && (
            <div className="chat-layout">
              <div className="chat-messages">
                {messages.length === 0 && <p className="empty-state">첫 메시지를 남겨보세요.</p>}
                {messages.map((msg, i) => {
                  const isMe = msg.username === user?.username;
                  return (
                    <div key={msg.id || i} className={`chat-message ${isMe ? 'mine' : ''}`}>
                      <div>
                        {!isMe && <strong>{msg.username}</strong>}
                        <p>{msg.content}</p>
                        <time>{formatTime(msg.created_at)}</time>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="chat-input">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder="메시지 입력" rows={2} />
                <button className="modern-btn primary" type="button" onClick={sendMsg}>전송</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
