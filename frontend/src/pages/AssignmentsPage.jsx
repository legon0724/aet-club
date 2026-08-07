import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

const BACKEND = 'https://web-production-00104.up.railway.app';
const emptyWork = { title: '', content: '', link_url: '', work_content: '' };
const emptyAssignment = { title: '', content: '', due_at: '', resource_url: '', workspace_type: 'none', points: '' };

function resolveFileUrl(url) {
  if (!url) return '';
  return url.startsWith('/api') ? `${BACKEND}${url}` : url;
}

function dueLabel(value) {
  if (!value) return '마감일 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
}

function modeLabel(mode) {
  if (mode === 'student_copy') return '학생별 사본';
  if (mode === 'material') return '자료';
  return '온라인 제출';
}

function workspaceLabel(type) {
  if (type === 'docs') return 'Google Docs';
  if (type === 'sheets') return 'Google Sheets';
  if (type === 'slides') return 'Google Slides';
  return '';
}

function studentCopyUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value.trim());
    if (!url.hostname.includes('docs.google.com')) return value;
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/(edit|view|preview).*$/u, '/copy');
    if (!url.pathname.endsWith('/copy')) url.pathname = `${url.pathname.replace(/\/$/u, '')}/copy`;
    return url.toString();
  } catch {
    return value;
  }
}

function AssignmentMark() {
  return (
    <span className="classroom-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v6h6M10 13h6M10 17h6" /></svg>
    </span>
  );
}

export default function AssignmentsPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState('all');
  const [work, setWork] = useState(emptyWork);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draftState, setDraftState] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newAssignment, setNewAssignment] = useState(emptyAssignment);
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);
  const assignmentFileRef = useRef(null);

  const selected = assignments.find((item) => item.id === selectedId) || null;
  const currentSubmission = submissions.find((item) => item.assignment_id === selectedId) || null;
  const selectedSubmissions = submissions.filter((item) => item.assignment_id === selectedId && item.status === 'submitted');

  const reload = useCallback(async (nextTeamId = '') => {
    const query = nextTeamId ? `?team_id=${nextTeamId}` : '';
    try {
      const [assignmentResult, submissionResult] = await Promise.all([
        api.get(`/api/assignments/${query}`),
        api.get(`/api/submissions/${query}`),
      ]);
      const nextAssignments = assignmentResult.data || [];
      setAssignments(nextAssignments);
      setSubmissions(submissionResult.data || []);
      setSelectedId((current) => nextAssignments.some((item) => item.id === current) ? current : (nextAssignments[0]?.id || ''));
      setError('');
    } catch {
      setAssignments([]);
      setSubmissions([]);
      setSelectedId('');
      setError('과제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    api.get('/api/auth/me').then((response) => setUser(rememberCurrentUser(response.data))).catch(() => {});
    api.get('/api/teams/').then((response) => setTeams(response.data || [])).catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => reload(teamId), 0);
    return () => window.clearTimeout(timer);
  }, [reload, teamId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setFile(null);
      setDraftState('');
      if (!selected || user?.is_admin) {
        setWork(emptyWork);
        return;
      }
      setDraftState('불러오는 중');
      api.get(`/api/submissions/work/${selected.id}`).then((response) => {
        if (cancelled) return;
        const saved = response.data || {};
        setWork({
          title: saved.title || selected.title,
          content: saved.content || '',
          link_url: saved.link_url || '',
          work_content: saved.work_content || '',
        });
        setDraftState(saved.status === 'submitted' ? '제출됨' : '임시저장됨');
      }).catch((requestError) => {
        if (cancelled) return;
        setWork({ ...emptyWork, title: selected.title });
        setDraftState('');
        if (selected.workspace_type !== 'none') {
          setError(requestError?.response?.data?.detail || '내 Google 작업 문서를 만들지 못했습니다.');
        }
      });
    });
    return () => { cancelled = true; };
  }, [selected, user?.is_admin]);

  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    const submitted = submissions.some((item) => item.assignment_id === assignment.id && item.status === 'submitted');
    if (view === 'todo') return !submitted;
    if (view === 'done') return submitted;
    return true;
  }), [assignments, submissions, view]);

  const saveDraft = async () => {
    if (!selected || user?.is_admin || currentSubmission?.status === 'submitted') return;
    setDraftState('저장 중');
    try {
      const response = await api.put(`/api/submissions/work/${selected.id}`, work);
      setDraftState('임시저장됨');
      setSubmissions((current) => {
        const saved = response.data;
        return [saved, ...current.filter((item) => item.assignment_id !== selected.id)];
      });
    } catch {
      setDraftState('저장 실패');
    }
  };

  const turnIn = async () => {
    if (!selected || busy) return;
    if (selected.copy_mode === 'student_copy' && selected.workspace_type === 'none' && !work.link_url.trim()) {
      window.alert('개인 사본 링크를 추가한 뒤 제출해주세요.');
      return;
    }
    setBusy(true);
    const data = new FormData();
    data.append('title', work.title || selected.title);
    data.append('assignment_id', String(selected.id));
    data.append('assignment_title', selected.title);
    if (selected.team_id || teamId) data.append('team_id', selected.team_id || teamId);
    if (work.content) data.append('content', work.content);
    if (work.work_content) data.append('work_content', work.work_content);
    if (work.link_url) data.append('link_url', work.link_url);
    if (file) data.append('file', file);
    try {
      await api.post('/api/submissions/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      await reload(teamId);
      setDraftState('제출됨');
      setFile(null);
    } catch (requestError) {
      window.alert(requestError?.response?.data?.detail || '과제를 제출하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const unsubmit = async () => {
    if (!currentSubmission || !window.confirm('제출을 취소하고 다시 수정할까요?')) return;
    setBusy(true);
    try {
      await api.delete(`/api/submissions/${currentSubmission.id}`);
      await reload(teamId);
      setDraftState('제출 취소됨');
    } catch {
      window.alert('제출을 취소하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    const title = newAssignment.title.trim();
    if (!title || creating) {
      if (!title) setError('과제 제목을 입력해주세요.');
      return;
    }

    setCreating(true);
    setError('');
    const data = new FormData();
    data.append('title', title);
    if (teamId) data.append('team_id', teamId);
    if (newAssignment.content.trim()) data.append('content', newAssignment.content.trim());
    if (newAssignment.due_at) data.append('due_at', newAssignment.due_at);
    if (newAssignment.resource_url.trim()) data.append('resource_url', newAssignment.resource_url.trim());
    data.append('workspace_type', newAssignment.workspace_type);
    data.append('copy_mode', newAssignment.workspace_type === 'none' ? 'site' : 'student_copy');
    if (newAssignment.points !== '') data.append('points', String(newAssignment.points));
    if (assignmentFile) data.append('file', assignmentFile);

    try {
      const response = await api.post('/api/assignments/', data);
      await reload(teamId);
      setSelectedId(response.data.id);
      setNewAssignment(emptyAssignment);
      setAssignmentFile(null);
      setShowCreate(false);
      if (assignmentFileRef.current) assignmentFileRef.current.value = '';
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || '과제를 등록하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-shell workspace-shell classroom-shell">
      <Navbar user={user} />
      <main className="classroom-page">
        <header className="classroom-header">
          <div>
            <span>NC CLASSWORK</span>
            <h1>과제</h1>
            <p>해야 할 일을 확인하고 내 작업을 제출하세요.</p>
          </div>
          <div className="classroom-summary">
            <strong>{assignments.length}</strong>
            <span>전체 과제</span>
          </div>
          {user?.is_admin && (
            <button className="classroom-create-button" type="button" onClick={() => setShowCreate((current) => !current)}>
              <span>＋</span>{showCreate ? '닫기' : '과제 만들기'}
            </button>
          )}
        </header>

        {error && <div className="inline-alert error">{error}</div>}

        {user?.is_admin && showCreate && (
          <form className="classroom-create-panel" onSubmit={createAssignment}>
            <header>
              <div>
                <span>새 과제</span>
                <h2>{teamId ? `${teams.find((team) => team.id === teamId)?.name || '선택한 팀'}에 과제 등록` : '모든 학생에게 과제 등록'}</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="과제 만들기 닫기">×</button>
            </header>
            <div className="classroom-create-grid">
              <label className="wide">과제 제목<input value={newAssignment.title} onChange={(event) => setNewAssignment((current) => ({ ...current, title: event.target.value }))} placeholder="과제 제목을 입력하세요" autoFocus /></label>
              <label>마감일<input type="date" value={newAssignment.due_at} onChange={(event) => setNewAssignment((current) => ({ ...current, due_at: event.target.value }))} /></label>
              <label>배점<input type="number" min="0" value={newAssignment.points} onChange={(event) => setNewAssignment((current) => ({ ...current, points: event.target.value }))} placeholder="선택사항" /></label>
              <label>학생 작업<select value={newAssignment.workspace_type} onChange={(event) => setNewAssignment((current) => ({ ...current, workspace_type: event.target.value }))}><option value="none">NC에서 바로 제출</option><option value="docs">Google Docs 개인 문서</option><option value="sheets">Google Sheets 개인 시트</option><option value="slides">Google Slides 개인 발표자료</option></select></label>
              <label className="wide">과제 설명<textarea value={newAssignment.content} onChange={(event) => setNewAssignment((current) => ({ ...current, content: event.target.value }))} placeholder="학생에게 보여줄 안내를 입력하세요" rows={4} /></label>
              <label className="wide">참고 링크<input type="url" value={newAssignment.resource_url} onChange={(event) => setNewAssignment((current) => ({ ...current, resource_url: event.target.value }))} placeholder="수업 자료 링크 (선택사항)" /></label>
              {newAssignment.workspace_type !== 'none' && <p className="classroom-google-note wide">학생이 과제를 처음 열면 {workspaceLabel(newAssignment.workspace_type)} 사본이 자동으로 만들어지고 학교 이메일에 편집 권한이 부여됩니다. 학생은 링크 공유나 권한 요청을 할 필요가 없습니다.</p>}
              <div className="classroom-create-file wide">
                <button type="button" onClick={() => assignmentFileRef.current?.click()}><span>↑</span>{assignmentFile ? assignmentFile.name : '첨부파일 추가'}</button>
                {assignmentFile && <button className="remove" type="button" onClick={() => { setAssignmentFile(null); if (assignmentFileRef.current) assignmentFileRef.current.value = ''; }}>삭제</button>}
                <input ref={assignmentFileRef} type="file" hidden onChange={(event) => setAssignmentFile(event.target.files?.[0] || null)} />
              </div>
            </div>
            <footer>
              <small>{teamId ? '선택한 팀 학생에게만 표시됩니다.' : '모든 학생에게 표시되는 전체 과제입니다.'}</small>
              <button type="submit" disabled={creating}>{creating ? '등록 중…' : '과제 등록'}</button>
            </footer>
          </form>
        )}

        <div className="classroom-body">
          <aside className="classroom-courses" aria-label="과제 그룹">
            <span className="classroom-side-label">수업</span>
            <button type="button" className={!teamId ? 'active' : ''} onClick={() => setTeamId('')}>
              <i>NC</i><span><strong>전체 과제</strong><small>모든 팀</small></span>
            </button>
            {teams.map((team) => (
              <button key={team.id} type="button" className={teamId === team.id ? 'active' : ''} onClick={() => setTeamId(team.id)}>
                <i style={{ background: team.color || '#5f6368' }}>{team.name.slice(0, 1)}</i>
                <span><strong>{team.name}</strong><small>{team.description || 'NC 팀'}</small></span>
              </button>
            ))}
          </aside>

          <section className="classroom-stream">
            <nav className="classroom-filters" aria-label="과제 상태">
              {[['all', '전체'], ['todo', '할 일'], ['done', '완료']].map(([key, label]) => (
                <button key={key} type="button" className={view === key ? 'active' : ''} onClick={() => setView(key)}>{label}</button>
              ))}
            </nav>

            <div className="classroom-list">
              {filteredAssignments.length === 0 ? (
                <div className="classroom-empty">
                  <AssignmentMark />
                  <strong>{view === 'done' ? '완료한 과제가 없습니다.' : '등록된 과제가 없습니다.'}</strong>
                  <p>새 과제가 등록되면 이곳에 표시됩니다.</p>
                </div>
              ) : filteredAssignments.map((assignment) => {
                const submitted = submissions.some((item) => item.assignment_id === assignment.id && item.status === 'submitted');
                return (
                  <button key={assignment.id} type="button" className={`classroom-row ${selectedId === assignment.id ? 'active' : ''}`} onClick={() => setSelectedId(assignment.id)}>
                    <AssignmentMark />
                    <span className="classroom-row-copy">
                      <strong>{assignment.title}</strong>
                      <small>{assignment.created_by || '관리자'} · {dueLabel(assignment.due_at)}</small>
                    </span>
                    <em className={submitted ? 'done' : ''}>{submitted ? '제출 완료' : '할 일'}</em>
                  </button>
                );
              })}
            </div>

            {selected && (
              <article className="classroom-detail">
                <header>
                  <AssignmentMark />
                  <div>
                    <h2>{selected.title}</h2>
                    <p>{selected.created_by || '관리자'} · {selected.created_at ? new Date(selected.created_at).toLocaleDateString('ko-KR') : '방금 전'}</p>
                  </div>
                  <div className="classroom-score">
                    <strong>{selected.points ? `${selected.points}점` : '배점 없음'}</strong>
                    <span>{dueLabel(selected.due_at)}</span>
                  </div>
                </header>
                <div className="classroom-detail-line" />
                <p className="classroom-description">{selected.content || '과제 안내가 없습니다.'}</p>
                <div className="classroom-materials">
                  {selected.resource_url && selected.workspace_type === 'none' && (
                    <a href={selected.copy_mode === 'student_copy' ? studentCopyUrl(selected.resource_url) : selected.resource_url} target="_blank" rel="noreferrer">
                      <span>↗</span><div><strong>{selected.copy_mode === 'student_copy' ? '개인 사본 만들기' : '참고 링크 열기'}</strong><small>{modeLabel(selected.copy_mode)}</small></div>
                    </a>
                  )}
                  {selected.file_url && (
                    <a href={resolveFileUrl(selected.file_url)} target="_blank" rel="noreferrer" download={selected.file_name || undefined}>
                      <span>↓</span><div><strong>{selected.file_name || '첨부 파일'}</strong><small>과제 자료</small></div>
                    </a>
                  )}
                </div>
              </article>
            )}
          </section>

          <aside className="classroom-work-card" aria-label={user?.is_admin ? '제출 현황' : '내 과제'}>
            {!selected ? (
              <div className="classroom-work-empty"><strong>과제를 선택하세요.</strong><p>과제 내용과 제출 상태가 여기에 표시됩니다.</p></div>
            ) : user?.is_admin ? (
              <>
                <header><h2>학생 과제</h2><span>{selectedSubmissions.length}명 제출</span></header>
                <div className="classroom-admin-submissions">
                  {selectedSubmissions.length === 0 && <p>아직 제출한 학생이 없습니다.</p>}
                  {selectedSubmissions.map((submission) => (
                    <article key={submission.id}>
                      <i>{(submission.username || 'N')[0].toUpperCase()}</i>
                      <div><strong>{submission.username || '학생'}</strong><small>{submission.file_name || submission.link_url || '온라인 답안'}</small></div>
                      {submission.file_url && <a href={resolveFileUrl(submission.file_url)} target="_blank" rel="noreferrer">열기</a>}
                      {!submission.file_url && submission.link_url && <a href={submission.link_url} target="_blank" rel="noreferrer">열기</a>}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <>
                <header><h2>내 과제</h2><span className={currentSubmission?.status === 'submitted' ? 'submitted' : ''}>{currentSubmission?.status === 'submitted' ? '제출됨' : draftState || '할당됨'}</span></header>
                <div className="classroom-work-fields">
                  {selected.workspace_type !== 'none' && work.link_url && (
                    <a className={`classroom-google-work ${selected.workspace_type}`} href={work.link_url} target="_blank" rel="noreferrer">
                      <span>{selected.workspace_type === 'docs' ? '▤' : selected.workspace_type === 'sheets' ? '▦' : '▣'}</span>
                      <div><strong>내 {workspaceLabel(selected.workspace_type)} 열기</strong><small>편집 권한이 자동으로 연결되었습니다.</small></div>
                    </a>
                  )}
                  <button className="classroom-add-file" type="button" onClick={() => fileRef.current?.click()} disabled={currentSubmission?.status === 'submitted'}>
                    <span>＋</span>{file ? file.name : '파일 추가 또는 만들기'}
                  </button>
                  <input ref={fileRef} type="file" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  {selected.workspace_type === 'none' && <label>링크<input value={work.link_url} onChange={(event) => setWork((current) => ({ ...current, link_url: event.target.value }))} onBlur={saveDraft} placeholder="참고할 링크가 있으면 붙여넣기" disabled={currentSubmission?.status === 'submitted'} /></label>}
                  <label>답안<textarea value={work.work_content} onChange={(event) => setWork((current) => ({ ...current, work_content: event.target.value }))} onBlur={saveDraft} placeholder="답안 또는 작업 내용을 입력하세요." rows={7} disabled={currentSubmission?.status === 'submitted'} /></label>
                  <label>선생님께 남길 메모<textarea value={work.content} onChange={(event) => setWork((current) => ({ ...current, content: event.target.value }))} onBlur={saveDraft} placeholder="선택사항" rows={3} disabled={currentSubmission?.status === 'submitted'} /></label>
                </div>
                {currentSubmission?.status === 'submitted' ? (
                  <button className="classroom-unsubmit" type="button" onClick={unsubmit} disabled={busy}>제출 취소</button>
                ) : (
                  <button className="classroom-turn-in" type="button" onClick={turnIn} disabled={busy}>{busy ? '제출 중…' : '제출'}</button>
                )}
                <p className="classroom-private-note">🔒 내 작업은 관리자만 확인할 수 있습니다.</p>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

