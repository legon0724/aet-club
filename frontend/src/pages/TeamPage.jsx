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
        <section className="page-hero compact classroom-hero">
          <div>
            <span>NC Classroom</span>
            <h1>팀별 과제를 클래스룸처럼 확인하고 제출합니다.</h1>
            <p>공지처럼 올라온 과제를 확인하고, 오른쪽 제출 패널에서 링크와 파일을 바로 첨부하세요.</p>
          </div>
          <button className="modern-btn primary" type="button" onClick={() => { setTab('submissions'); setShowSubForm(true); }}>
            새 제출
          </button>
        </section>

        <div className="classroom-switcher" aria-label="수업 선택">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              className={selectedTeam?.id === team.id ? 'active' : ''}
              onClick={() => setSelectedTeam(team)}
              style={{ '--team-color': team.color }}
            >
              <small>CLASS</small>
              <strong>{team.name}</strong>
              <span>{team.description}</span>
            </button>
          ))}
        </div>

        <section className="workspace-card team-board">
          <div className="workspace-tabs">
            {[
              ['submissions', '수업 과제'],
              ['chat', '팀 채팅'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'submissions' && (
            <div className="classroom-layout">
              <section className="classroom-stream" aria-label="과제 스트림">
                <article className="classwork-card current">
                  <div className="classwork-icon">NC</div>
                  <div>
                    <span>{selectedTeam?.name}</span>
                    <h2>이번 주 팀 과제</h2>
                    <p>완성본 링크, 파일, 간단한 설명을 함께 제출하세요. 제출 후 목록에서 바로 확인할 수 있습니다.</p>
                    <div className="classwork-meta">
                      <strong>제출 방식</strong>
                      <span>링크 + 파일 첨부</span>
                      <strong>상태</strong>
                      <span>{submissions.length > 0 ? `${submissions.length}개 제출됨` : '대기 중'}</span>
                    </div>
                  </div>
                </article>

                <div className="stream-header">
                  <div>
                    <span>Submitted work</span>
                    <h3>제출물</h3>
                  </div>
                  <button className="modern-btn ghost" type="button" onClick={() => setShowSubForm(true)}>새 제출</button>
                </div>

                <div className="submission-list classroom-list">
                  {submissions.length === 0 && <p className="empty-state">아직 제출된 과제가 없습니다. 오른쪽 패널에서 첫 제출을 올려보세요.</p>}
                  {submissions.map((item) => (
                    <article key={item.id} className="submission-item classroom-submission">
                      <div className="submission-avatar">{(item.username || 'N')[0].toUpperCase()}</div>
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
              </section>

              <aside className="turn-in-panel" aria-label="내 제출">
                <div className="turn-in-head">
                  <span>내 제출</span>
                  <strong>{showSubForm ? '작성 중' : '준비됨'}</strong>
                </div>
                {showSubForm ? (
                  <div className="submission-form classroom-form">
                    <input value={newSub.title} onChange={(e) => setNewSub((current) => ({ ...current, title: e.target.value }))} placeholder="과제 제목" />
                    <textarea value={newSub.content} onChange={(e) => setNewSub((current) => ({ ...current, content: e.target.value }))} placeholder="설명이나 제출 메모" rows={4} />
                    <input value={newSub.link_url} onChange={(e) => setNewSub((current) => ({ ...current, link_url: e.target.value }))} placeholder="링크 URL" />
                    <div className="file-picker" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
                      <span>{subFile ? subFile.name : '파일 첨부'}</span>
                      <small>PDF, 이미지, 문서 파일</small>
                    </div>
                    <input ref={fileRef} type="file" onChange={(e) => setSubFile(e.target.files[0])} hidden />
                    <button className="modern-btn primary" type="button" onClick={submitSub}>제출하기</button>
                    <button className="modern-btn ghost" type="button" onClick={() => setShowSubForm(false)}>닫기</button>
                  </div>
                ) : (
                  <button className="turn-in-button" type="button" onClick={() => setShowSubForm(true)}>과제 제출 시작</button>
                )}
              </aside>
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
