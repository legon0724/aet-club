import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import Navbar from '../components/Navbar';
import '../styles/assignment-copy.css';
import { showSiteAlert, showSiteConfirm } from '../utils/siteDialog';
import { getCurrentLocalUser, rememberCurrentUser } from '../utils/localAuth';

const BACKEND = 'https://web-production-00104.up.railway.app';
const emptyWork = { title: '', content: '', link_url: '', work_content: '' };
const emptyAssignment = { title: '', content: '', start_at: '', due_at: '', resource_url: '', workspace_type: 'none', points: '' };

function resolveFileUrl(url) {
  if (!url) return '';
  return url.startsWith('/api') ? `${BACKEND}${url}` : url;
}

function dueLabel(value) {
  if (!value) return '마감일 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  }
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

function googleOriginalUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value.trim());
    if (!url.hostname.includes('docs.google.com')) return value;
    const resourceKey = url.searchParams.get('resourcekey');
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/(copy|view|preview).*$/u, '/edit');
    if (resourceKey) url.searchParams.set('resourcekey', resourceKey);
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
  const [authReady, setAuthReady] = useState(false);
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
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [workError, setWorkError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [newAssignment, setNewAssignment] = useState(emptyAssignment);
  const [formTeamId, setFormTeamId] = useState('');
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);
  const assignmentFileRef = useRef(null);
  const creatingRef = useRef(false);
  const requestKeyRef = useRef('');

  const selected = assignments.find((item) => item.id === selectedId) || null;
  const editingAssignment = assignments.find((item) => item.id === editingId) || null;
  const currentSubmission = submissions.find((item) => item.assignment_id === selectedId) || null;
  const selectedSubmissions = submissions.filter((item) => item.assignment_id === selectedId && item.status === 'submitted');

  const reload = useCallback(async (nextTeamId = '') => {
    const query = nextTeamId ? `?team_id=${nextTeamId}` : '';
    try {
      const assignmentResult = await api.get(`/api/assignments/${query}`);
      const nextAssignments = assignmentResult.data || [];
      setAssignments(nextAssignments);
      setSelectedId((current) => nextAssignments.some((item) => item.id === current) ? current : (nextAssignments[0]?.id || ''));
      setLoadError('');
      api.get(`/api/submissions/${query}`)
        .then((submissionResult) => setSubmissions(submissionResult.data || []))
        .catch(() => setSubmissions([]));
    } catch {
      setAssignments([]);
      setSelectedId('');
      setLoadError('과제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, []);

  const prefetchTeam = useCallback((nextTeamId = '') => {
    const query = nextTeamId ? `?team_id=${nextTeamId}` : '';
    api.get(`/api/assignments/${query}`).catch(() => {});
    api.get(`/api/submissions/${query}`).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/api/auth/me').then((response) => setUser(rememberCurrentUser(response.data))).catch(() => {}).finally(() => setAuthReady(true));
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
      if (!authReady || !selected || user?.is_admin) {
        setWork(emptyWork);
        setWorkError('');
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
        setWorkError('');
      }).catch((requestError) => {
        if (cancelled) return;
        setWork({ ...emptyWork, title: selected.title });
        setDraftState('');
        setWorkError(requestError?.response?.data?.detail || '내 작업을 불러오지 못했습니다.');
      });
    });
    return () => { cancelled = true; };
  }, [authReady, selected, user?.is_admin]);

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
    if (selected.copy_mode === 'student_copy' && !work.link_url.trim()) {
      void showSiteAlert('개인 사본 링크를 추가한 뒤 제출해주세요.');
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
      void showSiteAlert(requestError?.response?.data?.detail || '과제를 제출하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const unsubmit = async () => {
    if (!currentSubmission || !(await showSiteConfirm('제출을 취소하고 다시 수정할까요?', '제출 취소'))) return;
    setBusy(true);
    try {
      await api.delete(`/api/submissions/${currentSubmission.id}`);
      await reload(teamId);
      setDraftState('제출 취소됨');
    } catch {
      void showSiteAlert('제출을 취소하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    const title = newAssignment.title.trim();
    if (!title || creatingRef.current) {
      if (!title) setCreateError('과제 제목을 입력해주세요.');
      return;
    }

    const resourceUrl = newAssignment.resource_url.trim();
    if (newAssignment.start_at && newAssignment.due_at && newAssignment.due_at < newAssignment.start_at) {
      setCreateError('마감일은 시작일보다 빠를 수 없습니다.');
      return;
    }
    if (newAssignment.workspace_type !== 'none') {
      if (!resourceUrl) {
        setCreateError(`${workspaceLabel(newAssignment.workspace_type)} 원본 링크를 입력해주세요.`);
        return;
      }
      try {
        const parsedUrl = new URL(resourceUrl);
        if (parsedUrl.hostname !== 'docs.google.com') throw new Error('invalid google url');
      } catch {
        setCreateError('Google Docs, Sheets 또는 Slides의 원본 링크를 입력해주세요.');
        return;
      }
    }

    creatingRef.current = true;
    setCreating(true);
    setCreateError('');
    const data = new FormData();
    data.append('title', title);
    data.append('team_id', formTeamId);
    data.append('content', newAssignment.content.trim());
    data.append('start_at', newAssignment.start_at);
    data.append('due_at', newAssignment.due_at);
    data.append('resource_url', resourceUrl);
    data.append('workspace_type', newAssignment.workspace_type);
    data.append('copy_mode', newAssignment.workspace_type === 'none' ? 'site' : 'student_copy');
    if (editingId || newAssignment.points !== '') data.append('points', String(newAssignment.points));
    if (assignmentFile) data.append('file', assignmentFile);
    if (editingId) data.append('remove_file', String(removeExistingFile));

    if (editingId) {
      try {
        const response = await api.patch(`/api/assignments/${editingId}`, data);
        setAssignments((current) => current.map((item) => (item.id === editingId ? response.data : item)));
        setSelectedId(response.data.id);
        setTeamId(formTeamId);
        setNewAssignment(emptyAssignment);
        setAssignmentFile(null);
        setRemoveExistingFile(false);
        setEditingId('');
        setShowCreate(false);
        if (assignmentFileRef.current) assignmentFileRef.current.value = '';
      } catch (requestError) {
        setCreateError(requestError?.response?.data?.detail || '과제를 수정하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.');
      } finally {
        creatingRef.current = false;
        setCreating(false);
      }
      return;
    }

    if (!requestKeyRef.current) {
      requestKeyRef.current = globalThis.crypto?.randomUUID?.() || `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    data.append('request_key', requestKeyRef.current);

    const submittedAssignment = { ...newAssignment };
    const optimisticId = `pending-${requestKeyRef.current}`;
    const optimisticAssignment = {
      id: optimisticId,
      team_id: formTeamId || null,
      title,
      content: newAssignment.content.trim(),
      start_at: newAssignment.start_at || null,
      due_at: newAssignment.due_at || null,
      resource_url: resourceUrl || null,
      copy_mode: newAssignment.workspace_type === 'none' ? 'site' : 'student_copy',
      workspace_type: newAssignment.workspace_type,
      points: newAssignment.points === '' ? null : Number(newAssignment.points),
      created_by: user?.username || '관리자',
      created_at: new Date().toISOString(),
    };
    setAssignments((current) => [optimisticAssignment, ...current]);
    setSelectedId(optimisticId);
    setNewAssignment(emptyAssignment);
    setAssignmentFile(null);
    setShowCreate(false);
    if (assignmentFileRef.current) assignmentFileRef.current.value = '';

    try {
      const response = await api.post('/api/assignments/', data);
      setAssignments((current) => [response.data, ...current.filter((item) => item.id !== optimisticId && item.id !== response.data.id)]);
      setSelectedId(response.data.id);
      setTeamId(formTeamId);
      setCreateError('');
      requestKeyRef.current = '';
    } catch (requestError) {
      setAssignments((current) => current.filter((item) => item.id !== optimisticId));
      setSelectedId((current) => current === optimisticId ? '' : current);
      setNewAssignment(submittedAssignment);
      setAssignmentFile(assignmentFile);
      setShowCreate(true);
      setCreateError(requestError?.response?.data?.detail || '과제를 등록하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const openCreateAssignment = () => {
    if (showCreate && !editingId) {
      setShowCreate(false);
      return;
    }
    setEditingId('');
    setFormTeamId(teamId);
    setNewAssignment(emptyAssignment);
    setAssignmentFile(null);
    setRemoveExistingFile(false);
    setCreateError('');
    setShowCreate(true);
    if (assignmentFileRef.current) assignmentFileRef.current.value = '';
  };

  const openEditAssignment = () => {
    if (!selected) return;
    setEditingId(selected.id);
    setFormTeamId(selected.team_id || '');
    setNewAssignment({
      title: selected.title || '',
      content: selected.content || '',
      start_at: selected.start_at || '',
      due_at: selected.due_at || '',
      resource_url: selected.resource_url || '',
      workspace_type: selected.workspace_type || 'none',
      points: selected.points ?? '',
    });
    setAssignmentFile(null);
    setRemoveExistingFile(false);
    setCreateError('');
    setShowCreate(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeAssignmentForm = () => {
    setShowCreate(false);
    setEditingId('');
    setAssignmentFile(null);
    setRemoveExistingFile(false);
    setCreateError('');
    if (assignmentFileRef.current) assignmentFileRef.current.value = '';
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
            <button className="classroom-create-button" type="button" onClick={openCreateAssignment}>
              <span>＋</span>{showCreate && !editingId ? '닫기' : '과제 만들기'}
            </button>
          )}
        </header>

        {loadError && <div className="inline-alert error">{loadError}</div>}

        {user?.is_admin && showCreate && (
          <form className="classroom-create-panel" onSubmit={createAssignment}>
            <header>
              <div>
                <span>{editingId ? '과제 수정' : '새 과제'}</span>
                <h2>{editingId ? '등록된 과제 내용 수정' : formTeamId ? `${teams.find((team) => team.id === formTeamId)?.name || '선택한 팀'}에 과제 등록` : '모든 학생에게 과제 등록'}</h2>
              </div>
              <button type="button" onClick={closeAssignmentForm} aria-label="과제 입력 닫기">×</button>
            </header>
            {createError && <div className="inline-alert error">{createError}</div>}
            <div className="classroom-create-grid">
              <label className="wide">과제 제목<input value={newAssignment.title} onChange={(event) => setNewAssignment((current) => ({ ...current, title: event.target.value }))} placeholder="과제 제목을 입력하세요" autoFocus /></label>
              <label className="wide">공개 대상<select value={formTeamId} onChange={(event) => setFormTeamId(event.target.value)}><option value="">모든 학생</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} 팀만</option>)}</select></label>
              <label>시작일<input type="date" value={newAssignment.start_at} onChange={(event) => setNewAssignment((current) => ({ ...current, start_at: event.target.value }))} /></label>
              <label>마감일<input type="date" min={newAssignment.start_at || undefined} value={newAssignment.due_at} onChange={(event) => setNewAssignment((current) => ({ ...current, due_at: event.target.value }))} /></label>
              <label>배점<input type="number" min="0" value={newAssignment.points} onChange={(event) => setNewAssignment((current) => ({ ...current, points: event.target.value }))} placeholder="선택사항" /></label>
              <label>학생 작업<select value={newAssignment.workspace_type} onChange={(event) => setNewAssignment((current) => ({ ...current, workspace_type: event.target.value }))}><option value="none">NC에서 바로 제출</option><option value="docs">Google Docs 사본 제출</option><option value="sheets">Google Sheets 사본 제출</option><option value="slides">Google Slides 사본 제출</option></select></label>
              <label className="wide">과제 설명<textarea value={newAssignment.content} onChange={(event) => setNewAssignment((current) => ({ ...current, content: event.target.value }))} placeholder="학생에게 보여줄 안내를 입력하세요" rows={4} /></label>
              <label className="wide">{newAssignment.workspace_type === 'none' ? '참고 링크' : `${workspaceLabel(newAssignment.workspace_type)} 원본 링크`}<input type="url" required={newAssignment.workspace_type !== 'none'} value={newAssignment.resource_url} onChange={(event) => setNewAssignment((current) => ({ ...current, resource_url: event.target.value }))} placeholder={newAssignment.workspace_type === 'none' ? '수업 자료 링크 (선택사항)' : '학생이 사본으로 복사할 원본 링크'} /></label>
              {newAssignment.workspace_type !== 'none' && <p className="classroom-google-note wide">등록 전에 원본 문서를 링크가 있는 사용자가 열 수 있게 공유하고, 공유 설정에서 ‘뷰어 및 댓글 작성자가 다운로드, 인쇄, 복사 가능’을 켜 주세요. 이 권한이 꺼져 있으면 사본 만들기가 열리지 않습니다.</p>}
              <div className="classroom-create-file wide">
                <button type="button" onClick={() => assignmentFileRef.current?.click()}><span>↑</span>{assignmentFile ? assignmentFile.name : '첨부파일 추가'}</button>
                {assignmentFile && <button className="remove" type="button" onClick={() => { setAssignmentFile(null); if (assignmentFileRef.current) assignmentFileRef.current.value = ''; }}>삭제</button>}
                {editingAssignment?.file_url && !assignmentFile && (
                  <button className={removeExistingFile ? 'remove active' : 'remove'} type="button" onClick={() => setRemoveExistingFile((current) => !current)}>
                    {removeExistingFile ? '기존 파일 삭제 취소' : `기존 파일 삭제 (${editingAssignment.file_name || '첨부파일'})`}
                  </button>
                )}
                <input ref={assignmentFileRef} type="file" hidden onChange={(event) => setAssignmentFile(event.target.files?.[0] || null)} />
              </div>
            </div>
            <footer>
              <small>{formTeamId ? '선택한 팀 학생에게만 표시됩니다.' : '모든 학생에게 표시되는 전체 과제입니다.'}</small>
              <button type="submit" disabled={creating}>{creating ? '저장 중…' : editingId ? '수정 저장' : '과제 등록'}</button>
            </footer>
          </form>
        )}

        <div className="classroom-body">
          <aside className="classroom-courses" aria-label="과제 그룹">
            <span className="classroom-side-label">수업</span>
            <button type="button" className={!teamId ? 'active' : ''} onPointerEnter={() => prefetchTeam('')} onFocus={() => prefetchTeam('')} onClick={() => setTeamId('')}>
              <i>NC</i><span><strong>전체 과제</strong><small>모든 팀</small></span>
            </button>
            {teams.map((team) => (
              <button key={team.id} type="button" className={teamId === team.id ? 'active' : ''} onPointerEnter={() => prefetchTeam(team.id)} onFocus={() => prefetchTeam(team.id)} onClick={() => setTeamId(team.id)}>
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
                  {user?.is_admin && <button className="classroom-edit-button" type="button" onClick={openEditAssignment}>수정</button>}
                  <div className="classroom-score">
                    <strong>{selected.points ? `${selected.points}점` : '배점 없음'}</strong>
                    {selected.start_at && <span>시작 {dueLabel(selected.start_at)}</span>}
                    <span>{dueLabel(selected.due_at)}</span>
                  </div>
                </header>
                <div className="classroom-detail-line" />
                <p className="classroom-description">{selected.content || '과제 안내가 없습니다.'}</p>
                <div className="classroom-materials">
                  {selected.resource_url && (
                    <>
                      <a href={selected.copy_mode === 'student_copy' ? studentCopyUrl(selected.resource_url) : selected.resource_url} target="_blank" rel="noreferrer">
                        <span>↗</span><div><strong>{selected.copy_mode === 'student_copy' ? `${workspaceLabel(selected.workspace_type) || '개인'} 사본 만들기` : '참고 링크 열기'}</strong><small>{selected.copy_mode === 'student_copy' ? '사본을 만든 뒤 공유 링크를 제출하세요.' : modeLabel(selected.copy_mode)}</small></div>
                      </a>
                      {selected.copy_mode === 'student_copy' && <a className="classroom-copy-fallback" href={googleOriginalUrl(selected.resource_url)} target="_blank" rel="noreferrer"><span>↗</span><div><strong>원본 문서 열기</strong><small>사본 오류 시 파일 → 사본 만들기</small></div></a>}
                    </>
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
                {workError && <div className="inline-alert error">{workError}</div>}
                <div className="classroom-work-fields">
                  {selected.workspace_type !== 'none' && selected.resource_url && (
                    <div className="classroom-google-actions">
                      <a className={`classroom-google-work ${selected.workspace_type}`} href={studentCopyUrl(selected.resource_url)} target="_blank" rel="noreferrer">
                        <span>{selected.workspace_type === 'docs' ? '▤' : selected.workspace_type === 'sheets' ? '▦' : '▣'}</span>
                        <div><strong>{workspaceLabel(selected.workspace_type)} 사본 만들기</strong><small>사본을 만든 뒤 아래에 공유 링크를 붙여넣으세요.</small></div>
                      </a>
                      <a className="classroom-google-fallback" href={googleOriginalUrl(selected.resource_url)} target="_blank" rel="noreferrer">사본 화면이 안 열리면 원본 열기 → 파일 → 사본 만들기</a>
                    </div>
                  )}
                  <button className="classroom-add-file" type="button" onClick={() => fileRef.current?.click()} disabled={currentSubmission?.status === 'submitted'}>
                    <span>＋</span>{file ? file.name : '파일 추가 또는 만들기'}
                  </button>
                  <input ref={fileRef} type="file" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  <label>{selected.copy_mode === 'student_copy' ? '사본 공유 링크' : '링크'}<input type="url" value={work.link_url} onChange={(event) => setWork((current) => ({ ...current, link_url: event.target.value }))} onBlur={saveDraft} placeholder={selected.copy_mode === 'student_copy' ? '내가 만든 Google 사본의 공유 링크' : '참고할 링크가 있으면 붙여넣기'} disabled={currentSubmission?.status === 'submitted'} /></label>
                  {selected.copy_mode === 'student_copy' && work.link_url && <a className="classroom-submitted-link" href={work.link_url} target="_blank" rel="noreferrer">붙여넣은 사본 열기 ↗</a>}
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
