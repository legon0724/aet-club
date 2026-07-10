import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';
import {
  DEFAULT_TEAMS,
  addLocalMessage,
  addLocalSubmission,
  deleteLocalSubmission,
  getLocalAssignments,
  getLocalMessages,
  getLocalSubmissions,
} from '../utils/localWorkspace';

const BACKEND = 'https://web-production-00104.up.railway.app';
const socketUrl = `${BACKEND.replace('https://', 'wss://')}/api/chat/ws`;

const blankSubmission = { title: '', content: '', link_url: '' };

export default function TeamPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [selectedTeam, setSelectedTeam] = useState(DEFAULT_TEAMS[0]);
  const [tab, setTab] = useState('assignments');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [newSub, setNewSub] = useState(blankSubmission);
  const [subFile, setSubFile] = useState(null);
  const [showSubForm, setShowSubForm] = useState(false);
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
    loadAssignments(selectedTeam.id);
    loadSubmissions(selectedTeam.id);
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedTeam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function resolveFileUrl(url) {
    if (!url) return '';
    return url.startsWith('/api') ? `${BACKEND}${url}` : url;
  }

  function assignmentFileUrl(assignment) {
    return assignment?.file_data || resolveFileUrl(assignment?.file_url);
  }

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

  function loadAssignments(teamId) {
    api.get(`/api/assignments/?team_id=${teamId}`).then((r) => {
      const next = r.data || [];
      setAssignments(next);
      setSelectedAssignment((current) => next.find((item) => item.id === current?.id) || next[0] || null);
    }).catch(() => {
      const next = getLocalAssignments(teamId);
      setAssignments(next);
      setSelectedAssignment((current) => next.find((item) => item.id === current?.id) || next[0] || null);
    });
  }

  function loadSubmissions(teamId) {
    api.get(`/api/submissions/?team_id=${teamId}`).then((r) => setSubmissions(r.data)).catch(() => {
      setSubmissions(getLocalSubmissions(teamId));
    });
  }

  const openTurnIn = (assignment = selectedAssignment) => {
    if (assignment) {
      setSelectedAssignment(assignment);
      setNewSub((current) => ({ ...current, title: assignment.title }));
    }
    setTab('assignments');
    setShowSubForm(true);
  };

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
    if (!selectedTeam) return;

    const title = (newSub.title || selectedAssignment?.title || '').trim();
    if (!title) return;

    const payload = {
      ...newSub,
      title,
      assignment_id: selectedAssignment?.id || null,
      assignment_title: selectedAssignment?.title || '',
    };

    try {
      const formData = new FormData();
      formData.append('title', payload.title);
      if (payload.content) formData.append('content', payload.content);
      if (payload.link_url) formData.append('link_url', payload.link_url);
      if (payload.assignment_id) formData.append('assignment_id', String(payload.assignment_id));
      if (payload.assignment_title) formData.append('assignment_title', payload.assignment_title);
      formData.append('team_id', selectedTeam.id);
      if (subFile) formData.append('file', subFile);

      await api.post('/api/submissions/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadSubmissions(selectedTeam.id);
    } catch {
      setSubmissions(addLocalSubmission(selectedTeam.id, user, payload, subFile?.name || ''));
    } finally {
      setNewSub(blankSubmission);
      setSubFile(null);
      setShowSubForm(false);
    }
  };

  const deleteSub = async (id) => {
    if (!window.confirm('제출물을 삭제할까요?')) return;
    try {
      if (!String(id).startsWith('local-sub-')) {
        await api.delete(`/api/submissions/${id}`);
      }
    } catch {
      // 서버가 잠시 꺼져 있어도 현재 화면에서는 삭제 반응을 유지합니다.
    }
    deleteLocalSubmission(id);
    setSubmissions((current) => current.filter((item) => item.id !== id));
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="workspace-page team-page">
        <section className="page-hero compact assignment-hero">
          <div>
            <span>Team Assignments</span>
            <h1>올라온 과제를 확인하고 바로 제출합니다.</h1>
            <p>관리자가 올린 파일을 내려받고, 완성한 링크나 파일을 같은 화면에서 제출하세요.</p>
          </div>
          <button className="modern-btn primary" type="button" onClick={() => openTurnIn()}>
            과제 제출
          </button>
        </section>

        <div className="assignment-switcher" aria-label="팀 선택">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              className={selectedTeam?.id === team.id ? 'active' : ''}
              onClick={() => setSelectedTeam(team)}
              style={{ '--team-color': team.color }}
            >
              <small>TEAM</small>
              <strong>{team.name}</strong>
              <span>{team.description}</span>
            </button>
          ))}
        </div>

        <section className="workspace-card team-board">
          <div className="workspace-tabs">
            {[
              ['assignments', '팀 과제'],
              ['chat', '팀 채팅'],
            ].map(([key, label]) => (
              <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'assignments' && (
            <div className="assignment-layout">
              <section className="assignment-stream" aria-label="과제 목록">
                <div className="stream-header">
                  <div>
                    <span>Assigned work</span>
                    <h3>{selectedTeam?.name} 과제</h3>
                  </div>
                  <button className="modern-btn ghost" type="button" onClick={() => openTurnIn()}>제출하기</button>
                </div>

                {assignments.length === 0 ? (
                  <article className="assignment-card empty">
                    <div className="assignment-icon">NC</div>
                    <div>
                      <span>대기 중</span>
                      <h2>등록된 과제가 없습니다.</h2>
                      <p>관리자가 과제를 올리면 파일 다운로드와 제출 버튼이 이곳에 표시됩니다.</p>
                    </div>
                  </article>
                ) : (
                  <div className="assignment-list-grid">
                    {assignments.map((assignment) => {
                      const fileUrl = assignmentFileUrl(assignment);
                      const active = selectedAssignment?.id === assignment.id;
                      return (
                        <article key={assignment.id} className={`assignment-card ${active ? 'active' : ''}`}>
                          <div className="assignment-icon">NC</div>
                          <div>
                            <span>{assignment.created_by || '관리자'}</span>
                            <h2>{assignment.title}</h2>
                            {assignment.content && <p>{assignment.content}</p>}
                            <div className="assignment-meta">
                              <strong>마감</strong>
                              <span>{formatDate(assignment.due_at) || '별도 안내'}</span>
                              <strong>첨부</strong>
                              <span>{assignment.file_name || '없음'}</span>
                            </div>
                            <div className="assignment-card-actions">
                              {fileUrl && (
                                <a className="assignment-download" href={fileUrl} download={assignment.file_name || undefined} target="_blank" rel="noreferrer">
                                  파일 다운로드
                                </a>
                              )}
                              <button type="button" onClick={() => openTurnIn(assignment)}>이 과제 제출</button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                <div className="stream-header compact">
                  <div>
                    <span>Submitted work</span>
                    <h3>제출물</h3>
                  </div>
                  <small>{submissions.length}개 제출됨</small>
                </div>

                <div className="submission-list assignment-list">
                  {submissions.length === 0 && <p className="empty-state">아직 제출된 과제가 없습니다. 오른쪽 패널에서 첫 제출을 올려보세요.</p>}
                  {submissions.map((item) => {
                    const submittedFileUrl = resolveFileUrl(item.file_url);
                    return (
                      <article key={item.id} className="submission-item assignment-submission">
                        <div className="submission-avatar">{(item.username || 'N')[0].toUpperCase()}</div>
                        <div>
                          <span>{item.assignment_title || item.username}</span>
                          <h3>{item.title}</h3>
                          {item.content && <p>{item.content}</p>}
                          {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer">{item.link_url}</a>}
                          {item.file_name && (
                            submittedFileUrl
                              ? <a href={submittedFileUrl} target="_blank" rel="noreferrer">{item.file_name}</a>
                              : <small>{item.file_name}</small>
                          )}
                        </div>
                        <div className="submission-actions">
                          <time>{new Date(item.created_at).toLocaleDateString()}</time>
                          <button type="button" onClick={() => deleteSub(item.id)}>삭제</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="turn-in-panel" aria-label="과제 제출">
                <div className="turn-in-head">
                  <span>Turn in</span>
                  <strong>{showSubForm ? '작성 중' : '준비됨'}</strong>
                </div>

                {selectedAssignment && (
                  <div className="selected-assignment">
                    <span>선택된 과제</span>
                    <strong>{selectedAssignment.title}</strong>
                    {selectedAssignment.content && <p>{selectedAssignment.content}</p>}
                    {assignmentFileUrl(selectedAssignment) && (
                      <a href={assignmentFileUrl(selectedAssignment)} download={selectedAssignment.file_name || undefined} target="_blank" rel="noreferrer">
                        첨부 파일 다운로드
                      </a>
                    )}
                  </div>
                )}

                {showSubForm ? (
                  <div className="submission-form assignment-form">
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
                  <button className="turn-in-button" type="button" onClick={() => openTurnIn()}>
                    {selectedAssignment ? '선택한 과제 제출 시작' : '과제 선택 후 제출'}
                  </button>
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
