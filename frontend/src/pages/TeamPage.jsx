import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

const BACKEND = 'https://web-production-00104.up.railway.app';
const socketUrl = `${BACKEND.replace('https://', 'wss://')}/api/chat/ws`;

const blankSubmission = { title: '', content: '', link_url: '', work_content: '' };
const emptyDraft = (assignment) => ({
  title: assignment?.title || '',
  content: '',
  link_url: '',
  work_content: '',
});

export default function TeamPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [tab, setTab] = useState('assignments');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [newSub, setNewSub] = useState(blankSubmission);
  const [subFile, setSubFile] = useState(null);
  const [showSubForm, setShowSubForm] = useState(false);
  const [draftStatus, setDraftStatus] = useState('ready');
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [loadError, setLoadError] = useState('');
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    api.get('/api/auth/me').then((r) => setUser(rememberCurrentUser(r.data))).catch(() => {});
    api.get('/api/teams/').then((r) => {
      const nextTeams = r.data;
      setTeams(nextTeams);
      setSelectedTeam((current) => nextTeams.find((team) => team.id === current?.id) || nextTeams[0] || null);
    }).catch(() => {
      setTeams([]);
      setSelectedTeam(null);
      setLoadError('팀 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    });
  }, []);

  useEffect(() => {
    if (!selectedTeam) return undefined;
    connectWs(selectedTeam.id);
    loadAssignments(selectedTeam.id);
    loadSubmissions(selectedTeam.id, user);
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedTeam, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  function resolveFileUrl(url) {
    if (!url) return '';
    return url.startsWith('/api') ? `${BACKEND}${url}` : url;
  }

  function assignmentFileUrl(assignment) {
    return assignment?.file_data || resolveFileUrl(assignment?.file_url);
  }

  function assignmentResourceUrl(assignment) {
    return assignment?.resource_url || '';
  }

  function toStudentCopyUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.includes('docs.google.com')) {
        parsed.search = '';
        parsed.hash = '';
        parsed.pathname = parsed.pathname
          .replace(/\/edit.*$/u, '/copy')
          .replace(/\/view.*$/u, '/copy')
          .replace(/\/preview.*$/u, '/copy');
        if (!parsed.pathname.endsWith('/copy')) parsed.pathname = `${parsed.pathname.replace(/\/$/u, '')}/copy`;
        return parsed.toString();
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  function assignmentModeLabel(assignment) {
    if (assignment?.copy_mode === 'student_copy') return '학생별 사본';
    if (assignment?.copy_mode === 'material') return '자료 제공';
    return '사이트 작업문서';
  }

  function isStudentCopyAssignment(assignment) {
    return assignment?.copy_mode === 'student_copy';
  }

  function connectWs(teamId) {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    setMessages([]);

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
      setAssignments([]);
      setSelectedAssignment(null);
      setLoadError('과제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    });
  }

  function loadSubmissions(teamId) {
    api.get(`/api/submissions/?team_id=${teamId}`).then((r) => setSubmissions(r.data)).catch(() => {
      setSubmissions([]);
      setLoadError('제출 현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    });
  }

  async function loadAssignmentWork(assignment) {
    if (!assignment) return;
    setDraftStatus('loading');
    try {
      const r = await api.get(`/api/submissions/work/${assignment.id}`);
      const work = r.data || {};
      setNewSub({
        title: work.title || assignment.title,
        content: work.content || '',
        link_url: work.link_url || '',
        work_content: work.work_content || '',
      });
      setDraftSavedAt(work.updated_at || null);
      setDraftStatus(work.status === 'submitted' ? 'submitted' : 'saved');
    } catch {
      setNewSub(emptyDraft(assignment));
      setDraftSavedAt(null);
      setDraftStatus('error');
    }
  }

  const saveDraft = async (nextData) => {
    if (!selectedAssignment || !selectedTeam) return;
    try {
      const r = await api.put(`/api/submissions/work/${selectedAssignment.id}`, nextData);
      setDraftSavedAt(r.data?.updated_at || new Date().toISOString());
      setDraftStatus(r.data?.status === 'submitted' ? 'submitted' : 'saved');
      loadSubmissions(selectedTeam.id, user);
    } catch {
      setDraftStatus('error');
    }
  };

  const queueDraftSave = (nextData) => {
    if (!selectedAssignment) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDraftStatus('saving');
    saveTimerRef.current = setTimeout(() => saveDraft(nextData), 650);
  };

  const updateDraftField = (key, value, shouldAutosave = true) => {
    const next = { ...newSub, [key]: value };
    setNewSub(next);
    if (shouldAutosave) queueDraftSave(next);
  };

  const openTurnIn = (assignment = selectedAssignment) => {
    if (assignment) {
      setSelectedAssignment(assignment);
      loadAssignmentWork(assignment);
    }
    setTab('assignments');
    setShowSubForm(true);
  };

  const sendMsg = () => {
    const content = input.trim();
    if (!content || !selectedTeam) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content }));
      setInput('');
    } else {
      window.alert('채팅 서버에 연결되지 않았습니다. 새로고침 후 다시 시도해주세요.');
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  const submitSub = async () => {
    if (!selectedTeam) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const title = (newSub.title || selectedAssignment?.title || '').trim();
    if (!title) return;
    if (isStudentCopyAssignment(selectedAssignment) && !newSub.link_url.trim()) {
      window.alert('개인 사본 링크를 붙여넣어야 제출할 수 있습니다.');
      return;
    }

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
      if (payload.work_content) formData.append('work_content', payload.work_content);
      if (payload.assignment_id) formData.append('assignment_id', String(payload.assignment_id));
      if (payload.assignment_title) formData.append('assignment_title', payload.assignment_title);
      formData.append('team_id', selectedTeam.id);
      if (subFile) formData.append('file', subFile);

      await api.post('/api/submissions/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDraftStatus('submitted');
      loadSubmissions(selectedTeam.id, user);
    } catch {
      setDraftStatus('error');
      window.alert('제출물을 서버에 저장하지 못했습니다. 다시 시도해주세요.');
      return;
    }
    setNewSub(blankSubmission);
    setSubFile(null);
    setShowSubForm(false);
  };

  const deleteSub = async (id) => {
    if (!window.confirm('제출물을 삭제할까요?')) return;
    try {
      await api.delete(`/api/submissions/${id}`);
    } catch {
      window.alert('제출물을 서버에서 삭제하지 못했습니다. 다시 시도해주세요.');
      return;
    }
    setSubmissions((current) => current.filter((item) => item.id !== id));
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const draftStatusText = () => {
    if (draftStatus === 'loading') return '불러오는 중';
    if (draftStatus === 'saving') return '자동저장 중';
    if (draftStatus === 'submitted') return '제출됨';
    if (draftStatus === 'error') return '저장 실패';
    if (draftSavedAt) return `자동저장 ${formatTime(draftSavedAt)}`;
    return '자동저장 준비';
  };

  return (
    <div className="app-shell workspace-shell">
      <Navbar user={user} />
      <main className="workspace-page team-page">
        <section className="page-hero compact assignment-hero">
          <div>
            <span>Team Assignments</span>
            <h1>원본 자료와 개인 작업본을 분리합니다.</h1>
            <p>관리자가 올린 템플릿은 원본으로만 두고, 학생은 자기 사본이나 사이트 작업문서로 제출합니다.</p>
          </div>
          <button className="modern-btn primary" type="button" onClick={() => openTurnIn()}>
            내 작업 열기
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
          {loadError && <div className="inline-alert error">{loadError}</div>}
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
                  <button className="modern-btn ghost" type="button" onClick={() => openTurnIn()}>내 작업 열기</button>
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
                      const resourceUrl = assignmentResourceUrl(assignment);
                      const copyUrl = toStudentCopyUrl(resourceUrl);
                      const active = selectedAssignment?.id === assignment.id;
                      const assignmentSubmission = submissions.find((item) => item.assignment_id === assignment.id);
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
                              <strong>방식</strong>
                              <span>{assignmentModeLabel(assignment)}</span>
                              <strong>자료</strong>
                              <span>{(assignment.file_name || resourceUrl) ? '있음' : '없음'}</span>
                              {assignment.points ? (
                                <>
                                  <strong>배점</strong>
                                  <span>{assignment.points}점</span>
                                </>
                              ) : null}
                              <strong>내 상태</strong>
                              <span>{assignmentSubmission?.status === 'submitted' ? '제출됨' : assignmentSubmission ? '작성 중' : '시작 전'}</span>
                            </div>
                            <div className="assignment-card-actions">
                              {isStudentCopyAssignment(assignment) && copyUrl && (
                                <a className="assignment-download copy" href={copyUrl} target="_blank" rel="noreferrer">
                                  개인 사본 만들기
                                </a>
                              )}
                              {fileUrl && (
                                <a className="assignment-download" href={fileUrl} download={assignment.file_name || undefined} target="_blank" rel="noreferrer">
                                  파일 다운로드
                                </a>
                              )}
                              <button type="button" onClick={() => openTurnIn(assignment)}>내 작업 열기</button>
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
                    <h3>{user?.is_admin ? '제출물' : '내 작업물'}</h3>
                  </div>
                  <small>{user?.is_admin ? `${submissions.length}개 제출됨` : `${submissions.length}개 작업`}</small>
                </div>

                <div className="submission-list assignment-list">
                  {submissions.length === 0 && <p className="empty-state">아직 작업 중인 과제가 없습니다. 오른쪽 패널에서 내 작업 문서를 열어보세요.</p>}
                  {submissions.map((item) => {
                    const submittedFileUrl = resolveFileUrl(item.file_url);
                    return (
                      <article key={item.id} className="submission-item assignment-submission">
                        <div className="submission-avatar">{(item.username || 'N')[0].toUpperCase()}</div>
                        <div>
                          <span>{item.assignment_title || item.username}</span>
                          <h3>{item.title}</h3>
                          <small className={item.status === 'submitted' ? 'submission-status submitted' : 'submission-status'}>
                            {item.status === 'submitted' ? '제출됨' : '자동저장됨'}
                          </small>
                          {item.work_content && <p className="submitted-work">{item.work_content}</p>}
                          {item.content && <p>{item.content}</p>}
                          {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer">{item.assignment_id ? '제출 링크 열기' : item.link_url}</a>}
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
                    <div className="assignment-source-row">
                      <b>{assignmentModeLabel(selectedAssignment)}</b>
                      {selectedAssignment.points ? <small>{selectedAssignment.points}점</small> : null}
                    </div>
                    {isStudentCopyAssignment(selectedAssignment) && assignmentResourceUrl(selectedAssignment) && (
                      <div className="copy-warning">
                        <strong>원본은 수정하지 마세요.</strong>
                        <p>아래 버튼으로 개인 사본을 만든 뒤, 내 사본 링크를 제출 칸에 저장하세요.</p>
                        <a href={toStudentCopyUrl(assignmentResourceUrl(selectedAssignment))} target="_blank" rel="noreferrer">
                          개인 사본 만들기
                        </a>
                      </div>
                    )}
                    {!isStudentCopyAssignment(selectedAssignment) && assignmentResourceUrl(selectedAssignment) && (
                      <a href={assignmentResourceUrl(selectedAssignment)} target="_blank" rel="noreferrer">
                        참고 링크 열기
                      </a>
                    )}
                    {assignmentFileUrl(selectedAssignment) && (
                      <a href={assignmentFileUrl(selectedAssignment)} download={selectedAssignment.file_name || undefined} target="_blank" rel="noreferrer">
                        첨부 파일 다운로드
                      </a>
                    )}
                  </div>
                )}

                {showSubForm ? (
                  <div className="submission-form assignment-form">
                    <div className="work-doc-head">
                      <div>
                        <span>{isStudentCopyAssignment(selectedAssignment) ? '내 개인 사본' : '내 작업 문서'}</span>
                        <strong>{newSub.title || selectedAssignment?.title || '과제 작업'}</strong>
                      </div>
                      <small className={draftStatus === 'submitted' ? 'autosave-state submitted' : 'autosave-state'}>{draftStatusText()}</small>
                    </div>
                    {isStudentCopyAssignment(selectedAssignment) ? (
                      <>
                        <div className="copy-flow">
                          <div>
                            <span>1</span>
                            <strong>원본 확인</strong>
                            <p>관리자 템플릿은 수정하지 않습니다.</p>
                          </div>
                          <div>
                            <span>2</span>
                            <strong>개인 사본 생성</strong>
                            <p>내 Google 계정에 사본을 만듭니다.</p>
                          </div>
                          <div>
                            <span>3</span>
                            <strong>링크 제출</strong>
                            <p>내 사본 링크만 저장하고 제출합니다.</p>
                          </div>
                        </div>
                        <input
                          className="copy-url-input"
                          value={newSub.link_url}
                          onChange={(e) => updateDraftField('link_url', e.target.value)}
                          placeholder="내 개인 사본 Google Docs 링크"
                        />
                        <textarea
                          className="work-doc-editor compact"
                          value={newSub.work_content}
                          onChange={(e) => updateDraftField('work_content', e.target.value)}
                          placeholder="필요하면 제출 요약이나 선생님이 볼 메모를 남기세요."
                          rows={7}
                        />
                      </>
                    ) : (
                      <textarea
                        className="work-doc-editor"
                        value={newSub.work_content}
                        onChange={(e) => updateDraftField('work_content', e.target.value)}
                        placeholder="여기에 답안을 작성하세요. 쓰는 동안 자동저장됩니다."
                        rows={12}
                      />
                    )}
                    <textarea
                      value={newSub.content}
                      onChange={(e) => updateDraftField('content', e.target.value)}
                      placeholder="제출 메모"
                      rows={3}
                    />
                    {!isStudentCopyAssignment(selectedAssignment) && (
                      <input value={newSub.link_url} onChange={(e) => updateDraftField('link_url', e.target.value)} placeholder="추가 링크 URL" />
                    )}
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
                    {selectedAssignment ? '선택한 과제 작업 시작' : '과제 선택 후 작업 시작'}
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
