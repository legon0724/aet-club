import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Navbar from '../components/Navbar';
import { getCurrentLocalUser, readLocalUsers, rememberCurrentUser, writeLocalUsers } from '../utils/localAuth';
import {
  addLocalAssignment,
  addLocalTeam,
  deleteLocalAssignment,
  deleteLocalTeam,
  fileToDataUrl,
  getAllLocalPortfolios,
  getFallbackNotices,
  getLocalNoticeReadSummary,
  getLocalAdminUsers,
  getLocalAssignments,
  getLocalTeams,
} from '../utils/localWorkspace';

const BACKEND = 'https://web-production-00104.up.railway.app';

const emptyAssignment = { title: '', content: '', due_at: '', resource_url: '', copy_mode: 'site', points: '' };

export default function AdminPage() {
  const [user, setUser] = useState(() => getCurrentLocalUser());
  const [tab, setTab] = useState('users');
  const navigate = useNavigate();

  useEffect(() => {
    const localUser = getCurrentLocalUser();
    if (localUser && !localUser.is_admin) {
      navigate('/');
      return;
    }

    api.get('/api/auth/me').then((r) => {
      const resolvedUser = rememberCurrentUser(r.data);
      if (!resolvedUser.is_admin) navigate('/');
      setUser(resolvedUser);
    }).catch(() => {
      if (!localUser) navigate('/login');
    });
  }, [navigate]);

  const tabs = [
    ['users', '회원 관리', '권한과 팀 배정'],
    ['teams', '팀 관리', '팀 생성과 정리'],
    ['assignments', '과제 관리', '학생별 작업본과 제출 흐름'],
    ['notices', '공지 관리', '전체와 팀별 안내'],
    ['banners', '배너 관리', '홈 배너 운영'],
    ['portfolios', '포트폴리오', '회원 작업물 확인'],
    ['ai', 'AI 사용량', '분석 사용 현황'],
  ];
  const activeTab = tabs.find(([key]) => key === tab);

  return (
    <div className="app-shell workspace-shell admin-shell">
      <Navbar user={user} />
      <main className="workspace-page admin-page">
        <section className="admin-hero">
          <div>
            <span>Admin Console</span>
            <h1>관리자 화면</h1>
            <p>회원, 팀, 과제, 공지, 포트폴리오를 한 화면에서 빠르게 관리합니다.</p>
          </div>
          <div className="admin-profile-chip">
            <strong>{user?.username || '관리자'}</strong>
            <span>{user?.email || 'admin access'}</span>
          </div>
        </section>

        <section className="admin-overview" aria-label="관리 메뉴">
          {tabs.map(([key, label, helper]) => (
            <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <span>{label}</span>
              <small>{helper}</small>
            </button>
          ))}
        </section>

        <section className="admin-content">
          <div className="admin-content-head">
            <div>
              <span>{activeTab?.[2]}</span>
              <h2>{activeTab?.[1]}</h2>
            </div>
          </div>

          {tab === 'users' && <UsersTab />}
          {tab === 'teams' && <TeamsTab />}
          {tab === 'assignments' && <AssignmentsTab user={user} />}
          {tab === 'notices' && <NoticesTab />}
          {tab === 'banners' && <BannersTab />}
          {tab === 'portfolios' && <PortfoliosTab />}
          {tab === 'ai' && <AITab />}
        </section>
      </main>
    </div>
  );
}

function resolveFileUrl(url) {
  if (!url) return '';
  return url.startsWith('/api') ? `${BACKEND}${url}` : url;
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    api.get('/api/admin/users').then((r) => setUsers(r.data)).catch(() => setUsers(getLocalAdminUsers()));
    api.get('/api/teams/').then((r) => setTeams(r.data)).catch(() => setTeams(getLocalTeams()));
  }, []);

  const toggleAdmin = async (id, isAdmin) => {
    try {
      await api.patch(`/api/admin/users/${id}/admin`);
    } catch {
      const nextUsers = readLocalUsers().map((localUser) => (
        localUser.email === id ? { ...localUser, is_admin: !isAdmin } : localUser
      ));
      writeLocalUsers(nextUsers);
    }
    setUsers((current) => current.map((item) => (item.id === id ? { ...item, is_admin: !isAdmin } : item)));
  };

  const assignTeam = async (id, teamId) => {
    try {
      await api.patch(`/api/admin/users/${id}`, { team_id: teamId || null });
    } catch {
      const nextUsers = readLocalUsers().map((localUser) => (
        localUser.email === id ? { ...localUser, team_id: teamId || null } : localUser
      ));
      writeLocalUsers(nextUsers);
    }
    setUsers((current) => current.map((item) => (item.id === id ? { ...item, team_id: teamId || null } : item)));
  };

  const deleteUser = async (id) => {
    if (!window.confirm('회원을 삭제할까요?')) return;
    try {
      await api.delete(`/api/admin/users/${id}`);
    } catch {
      writeLocalUsers(readLocalUsers().filter((localUser) => localUser.email !== id));
    }
    setUsers((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="admin-list">
      {users.map((item) => (
        <article key={item.id} className="admin-list-item">
          <div>
            <strong>{item.username}</strong>
            <span>{item.email}</span>
          </div>
          <select value={item.team_id || ''} onChange={(e) => assignTeam(item.id, e.target.value)}>
            <option value="">팀 없음</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <button className={item.is_admin ? 'status-button active' : 'status-button'} type="button" onClick={() => toggleAdmin(item.id, item.is_admin)}>
            {item.is_admin ? '관리자' : '일반'}
          </button>
          <button className="danger-button" type="button" onClick={() => deleteUser(item.id)}>삭제</button>
        </article>
      ))}
      {users.length === 0 && <p className="empty-state">회원 목록이 없습니다.</p>}
    </div>
  );
}

function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', color: '#2dd4bf' });
  const [show, setShow] = useState(false);

  useEffect(() => {
    api.get('/api/teams/').then((r) => setTeams(r.data)).catch(() => setTeams(getLocalTeams()));
  }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post('/api/teams/', form);
      const r = await api.get('/api/teams/');
      setTeams(r.data);
    } catch {
      setTeams(addLocalTeam(form));
    }
    setForm({ name: '', description: '', color: '#2dd4bf' });
    setShow(false);
  };

  const del = async (id) => {
    if (!window.confirm('팀을 삭제할까요?')) return;
    try {
      await api.delete(`/api/teams/${id}`);
    } catch {
      setTeams(deleteLocalTeam(id));
      return;
    }
    setTeams((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="admin-toolbar">
        <button className="modern-btn primary" type="button" onClick={() => setShow((current) => !current)}>팀 추가</button>
      </div>
      {show && (
        <div className="admin-form-grid">
          <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="팀 이름" />
          <input value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="팀 설명" />
          <input value={form.color} onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))} placeholder="#2dd4bf" />
          <button className="modern-btn primary" type="button" onClick={create}>생성</button>
        </div>
      )}
      <div className="admin-list">
        {teams.map((team) => (
          <article key={team.id} className="admin-list-item">
            <div className="team-dot" style={{ '--team-color': team.color }} />
            <div>
              <strong>{team.name}</strong>
              {team.description && <span>{team.description}</span>}
            </div>
            <button className="danger-button" type="button" onClick={() => del(team.id)}>삭제</button>
          </article>
        ))}
      </div>
    </div>
  );
}

function AssignmentsTab({ user }) {
  const [teams, setTeams] = useState(() => getLocalTeams());
  const [teamId, setTeamId] = useState(() => getLocalTeams()[0]?.id || '');
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(emptyAssignment);
  const [file, setFile] = useState(null);
  const [show, setShow] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/api/teams/').then((r) => {
      const nextTeams = r.data;
      setTeams(nextTeams);
      setTeamId((current) => nextTeams.find((team) => team.id === current)?.id || nextTeams[0]?.id || '');
    }).catch(() => {
      const nextTeams = getLocalTeams();
      setTeams(nextTeams);
      setTeamId((current) => nextTeams.find((team) => team.id === current)?.id || nextTeams[0]?.id || '');
    });
  }, []);

  useEffect(() => {
    if (teamId) loadAssignments(teamId);
  }, [teamId]);

  async function loadAssignments(nextTeamId) {
    try {
      const r = await api.get(`/api/assignments/?team_id=${nextTeamId}`);
      setAssignments(r.data || []);
    } catch {
      setAssignments(getLocalAssignments(nextTeamId));
    }
  }

  const create = async () => {
    if (!form.title.trim() || !teamId) return;
    const payload = {
      ...form,
      title: form.title.trim(),
      points: form.points ? Number(form.points) : '',
    };

    try {
      const formData = new FormData();
      formData.append('team_id', teamId);
      formData.append('title', payload.title);
      if (payload.content) formData.append('content', payload.content);
      if (payload.due_at) formData.append('due_at', payload.due_at);
      if (payload.resource_url) formData.append('resource_url', payload.resource_url);
      if (payload.copy_mode) formData.append('copy_mode', payload.copy_mode);
      if (payload.points) formData.append('points', String(payload.points));
      if (file) formData.append('file', file);

      await api.post('/api/assignments/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadAssignments(teamId);
    } catch {
      const fileData = file ? await fileToDataUrl(file) : '';
      setAssignments(addLocalAssignment(teamId, user, payload, file?.name || '', fileData));
    } finally {
      setForm(emptyAssignment);
      setFile(null);
      setShow(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const del = async (id) => {
    if (!window.confirm('과제를 삭제할까요?')) return;
    try {
      if (!String(id).startsWith('local-assignment-')) {
        await api.delete(`/api/assignments/${id}`);
      }
    } catch {
      // 서버가 꺼져 있어도 로컬 과제는 바로 정리합니다.
    }
    deleteLocalAssignment(id);
    setAssignments((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="admin-toolbar split">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <button className="modern-btn primary" type="button" onClick={() => setShow((current) => !current)}>
          과제 등록
        </button>
      </div>

      {show && (
        <div className="admin-form-grid assignment-admin-form">
          <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="과제 제목" />
          <input type="date" value={form.due_at} onChange={(e) => setForm((current) => ({ ...current, due_at: e.target.value }))} />
          <select value={form.copy_mode} onChange={(e) => setForm((current) => ({ ...current, copy_mode: e.target.value }))}>
            <option value="site">사이트 작업 문서</option>
            <option value="student_copy">학생별 사본 링크</option>
            <option value="material">자료만 제공</option>
          </select>
          <input value={form.points} type="number" min="0" onChange={(e) => setForm((current) => ({ ...current, points: e.target.value }))} placeholder="점수 / 배점" />
          <textarea value={form.content} onChange={(e) => setForm((current) => ({ ...current, content: e.target.value }))} placeholder="과제 설명" rows={4} />
          <input
            className="assignment-resource-input"
            value={form.resource_url}
            onChange={(e) => setForm((current) => ({ ...current, resource_url: e.target.value }))}
            placeholder="Google Docs 원본 링크 또는 참고 링크"
          />
          {form.copy_mode === 'student_copy' && (
            <p className="assignment-admin-note">
              원본 문서는 보기 권한으로 공유하고, 학생은 개인 사본을 만들어 자기 링크로 제출합니다.
            </p>
          )}
          <div className="admin-file-pick" role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
            <strong>{file ? file.name : '첨부 파일 선택'}</strong>
            <span>안내문, PDF, docx 같은 자료를 함께 올릴 수 있습니다.</span>
          </div>
          <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files[0])} hidden />
          <button className="modern-btn primary" type="button" onClick={create}>등록 완료</button>
        </div>
      )}

      <div className="admin-list">
        {assignments.length === 0 && <p className="empty-state">아직 등록된 과제가 없습니다.</p>}
        {assignments.map((assignment) => {
          const fileUrl = assignment.file_data || resolveFileUrl(assignment.file_url);
          return (
            <article key={assignment.id} className="admin-list-item assignment-admin-item">
              <div>
                <strong>{assignment.title}</strong>
                {assignment.content && <span>{assignment.content}</span>}
                <span>{assignment.copy_mode === 'student_copy' ? '학생별 사본 과제' : assignment.copy_mode === 'material' ? '자료 제공' : '사이트 작업 문서'}</span>
                <small>{assignment.due_at ? `마감 ${assignment.due_at}` : '마감일 없음'}</small>
                {assignment.points ? <small>{assignment.points}점</small> : null}
              </div>
              {assignment.resource_url && (
                <a className="assignment-download" href={assignment.resource_url} target="_blank" rel="noreferrer">
                  원본 링크
                </a>
              )}
              {fileUrl && (
                <a className="assignment-download" href={fileUrl} download={assignment.file_name || undefined} target="_blank" rel="noreferrer">
                  다운로드
                </a>
              )}
              <button className="danger-button" type="button" onClick={() => del(assignment.id)}>삭제</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function NoticesTab() {
  const [notices, setNotices] = useState([]);
  const [readSummary, setReadSummary] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', is_pinned: false, team_id: '' });
  const [show, setShow] = useState(false);

  const loadReadSummary = useCallback((nextNotices) => {
    api.get('/api/notices/read-status').then((r) => {
      setReadSummary(r.data || []);
    }).catch(() => {
      setReadSummary(getLocalNoticeReadSummary(nextNotices));
    });
  }, []);

  const loadNotices = useCallback(() => {
    api.get('/api/notices/').then((r) => {
      setNotices(r.data);
      loadReadSummary(r.data);
    }).catch(() => {
      const fallback = getFallbackNotices();
      setNotices(fallback);
      setReadSummary(getLocalNoticeReadSummary(fallback));
    });
  }, [loadReadSummary]);

  useEffect(() => {
    loadNotices();
    api.get('/api/teams/').then((r) => setTeams(r.data)).catch(() => setTeams(getLocalTeams()));
  }, [loadNotices]);

  const create = async () => {
    if (!form.title.trim()) return;
    try {
      await api.post('/api/notices/', { ...form, team_id: form.team_id || null });
      loadNotices();
    } catch {
      const next = [{
        ...form,
        id: `local-notice-${Date.now()}`,
        team_id: form.team_id || null,
        created_at: new Date().toISOString(),
      }, ...notices];
      setNotices(next);
      setReadSummary(getLocalNoticeReadSummary(next));
    }
    setForm({ title: '', content: '', is_pinned: false, team_id: '' });
    setShow(false);
  };

  const del = async (id) => {
    if (!window.confirm('공지를 삭제할까요?')) return;
    try {
      await api.delete(`/api/notices/${id}`);
    } catch {
      // 로컬 미리보기에서는 화면에서만 제거합니다.
    }
    setNotices((current) => {
      const next = current.filter((item) => item.id !== id);
      setReadSummary(getLocalNoticeReadSummary(next));
      return next;
    });
  };

  const getReceipt = (noticeId) => (
    readSummary.find((item) => String(item.notice_id) === String(noticeId)) || {
      read_count: 0,
      unread_count: 0,
      total_users: 0,
      readers: [],
      unread_users: [],
    }
  );

  return (
    <div>
      <div className="admin-toolbar">
        <button className="modern-btn primary" type="button" onClick={() => setShow((current) => !current)}>공지 작성</button>
      </div>
      {show && (
        <div className="admin-form-grid">
          <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="제목" />
          <textarea value={form.content} onChange={(e) => setForm((current) => ({ ...current, content: e.target.value }))} placeholder="내용" rows={3} />
          <select value={form.team_id} onChange={(e) => setForm((current) => ({ ...current, team_id: e.target.value }))}>
            <option value="">전체 공지</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <label className="admin-checkbox">
            <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm((current) => ({ ...current, is_pinned: e.target.checked }))} />
            상단 고정
          </label>
          <button className="modern-btn primary" type="button" onClick={create}>등록</button>
        </div>
      )}
      <div className="admin-list">
        {notices.length === 0 && <p className="empty-state">공지사항이 없습니다.</p>}
        {notices.map((notice) => {
          const receipt = getReceipt(notice.id);
          return (
            <article key={notice.id} className="admin-list-item notice-admin-item">
              <div>
                <strong>{notice.is_pinned ? '고정 · ' : ''}{notice.title}</strong>
                {notice.content && <span>{notice.content}</span>}
                <div className="notice-read-summary">
                  <b>읽음 {receipt.read_count}/{receipt.total_users}</b>
                  <small>미확인 {receipt.unread_count}</small>
                </div>
                <div className="notice-reader-grid">
                  <div>
                    <span>읽은 사람</span>
                    {receipt.readers.length ? receipt.readers.slice(0, 4).map((reader) => (
                      <small key={`${notice.id}-${reader.user_id}`}>
                        {reader.username}
                      </small>
                    )) : <small>아직 없음</small>}
                  </div>
                  <div>
                    <span>미확인</span>
                    {receipt.unread_users.length ? receipt.unread_users.slice(0, 4).map((reader) => (
                      <small key={`${notice.id}-unread-${reader.user_id}`}>
                        {reader.username}
                      </small>
                    )) : <small>전원 확인</small>}
                  </div>
                </div>
              </div>
              <small>{new Date(notice.created_at).toLocaleDateString()}</small>
              <button className="danger-button" type="button" onClick={() => del(notice.id)}>삭제</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BannersTab() {
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState({ title: '', link_url: '', order_num: 0 });
  const [imageFile, setImageFile] = useState(null);
  const [show, setShow] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    api.get('/api/banners/').then((r) => setBanners(r.data)).catch(() => setBanners([]));
  }, []);

  const create = async () => {
    const formData = new FormData();
    if (form.title) formData.append('title', form.title);
    if (form.link_url) formData.append('link_url', form.link_url);
    formData.append('order_num', String(form.order_num));
    if (imageFile) formData.append('image_file', imageFile);

    try {
      await api.post('/api/banners/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const r = await api.get('/api/banners/');
      setBanners(r.data);
    } catch {
      setBanners((current) => [{
        ...form,
        id: `local-banner-${Date.now()}`,
        image_url: '',
        is_active: true,
      }, ...current]);
    }
    setForm({ title: '', link_url: '', order_num: 0 });
    setImageFile(null);
    setShow(false);
  };

  const del = async (id) => {
    if (!window.confirm('배너를 삭제할까요?')) return;
    try {
      await api.delete(`/api/banners/${id}`);
    } catch {
      // 로컬 미리보기에서는 화면에서만 제거합니다.
    }
    setBanners((current) => current.filter((item) => item.id !== id));
  };

  const toggle = async (id, isActive) => {
    try {
      await api.patch(`/api/banners/${id}`, { is_active: !isActive });
    } catch {
      // 로컬 미리보기에서는 상태만 전환합니다.
    }
    setBanners((current) => current.map((item) => (item.id === id ? { ...item, is_active: !isActive } : item)));
  };

  return (
    <div>
      <div className="admin-toolbar">
        <button className="modern-btn primary" type="button" onClick={() => setShow((current) => !current)}>배너 추가</button>
      </div>
      {show && (
        <div className="admin-form-grid">
          <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="배너 제목" />
          <input value={form.link_url} onChange={(e) => setForm((current) => ({ ...current, link_url: e.target.value }))} placeholder="연결 링크" />
          <input value={form.order_num} type="number" onChange={(e) => setForm((current) => ({ ...current, order_num: Number(e.target.value) }))} placeholder="순서" />
          <div className="admin-file-pick" role="button" tabIndex={0} onClick={() => imgRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && imgRef.current?.click()}>
            <strong>{imageFile ? imageFile.name : '이미지 선택'}</strong>
            <span>JPG, PNG, WebP, GIF</span>
          </div>
          <input ref={imgRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" onChange={(e) => setImageFile(e.target.files[0])} hidden />
          <button className="modern-btn primary" type="button" onClick={create}>추가</button>
        </div>
      )}
      <div className="admin-list">
        {banners.length === 0 && <p className="empty-state">배너가 없습니다.</p>}
        {banners.map((banner) => {
          const imgUrl = resolveFileUrl(banner.image_url);
          return (
            <article key={banner.id} className="admin-list-item">
              {imgUrl && <img className="admin-thumb" src={imgUrl} alt="" loading="lazy" decoding="async" />}
              <div>
                <strong>{banner.title || '제목 없음'}</strong>
                {banner.link_url && <span>{banner.link_url}</span>}
                <small>순서 {banner.order_num}</small>
              </div>
              <button className={banner.is_active ? 'status-button active' : 'status-button'} type="button" onClick={() => toggle(banner.id, banner.is_active)}>
                {banner.is_active ? '활성' : '비활성'}
              </button>
              <button className="danger-button" type="button" onClick={() => del(banner.id)}>삭제</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PortfoliosTab() {
  const [users, setUsers] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/api/admin/users').then((r) => setUsers(r.data)).catch(() => setUsers(getLocalAdminUsers()));
    api.get('/api/admin/portfolios').then((r) => setPortfolios(r.data)).catch(() => {
      const local = getAllLocalPortfolios();
      setPortfolios(Object.entries(local).map(([email, portfolio]) => ({ ...portfolio, user_id: email, email })));
    });
  }, []);

  const findPortfolio = (item) => portfolios.find((entry) => (
    entry.user_id === item?.id || entry.email === item?.email || entry.email === item?.id
  ));

  const selectedUser = users.find((item) => item.id === selected);
  const portfolio = findPortfolio(selectedUser || { id: selected, email: selected });

  return (
    <div className="admin-split-view">
      <div className="admin-side-list">
        {users.map((item) => {
          const itemPortfolio = findPortfolio(item);
          return (
            <button key={item.id} type="button" className={selected === item.id ? 'active' : ''} onClick={() => setSelected(item.id)}>
              <strong>{item.username}</strong>
              <span>{item.email}</span>
              <small className={itemPortfolio?.is_public ? 'visibility-pill public' : 'visibility-pill'}>
                {itemPortfolio ? (itemPortfolio.is_public ? '공개' : '비공개') : '미작성'}
              </small>
            </button>
          );
        })}
      </div>
      <div className="admin-preview">
        {!selected && <p className="empty-state">왼쪽에서 회원을 선택하세요.</p>}
        {selected && !portfolio && <p className="empty-state">작성된 포트폴리오가 없습니다.</p>}
        {portfolio && (
          <>
            <div className="admin-preview-head">
              {portfolio.profile_image && <img src={resolveFileUrl(portfolio.profile_image)} alt="" loading="lazy" decoding="async" />}
              <div>
                <strong>{portfolio.username || selectedUser?.username}</strong>
                <span>{portfolio.email || selectedUser?.email}</span>
              </div>
              <small className={portfolio.is_public ? 'visibility-pill public' : 'visibility-pill'}>
                {portfolio.is_public ? '공개' : '비공개 · 관리자 열람'}
              </small>
            </div>
            {[
              ['intro', '자기소개'],
              ['projects', '프로젝트'],
              ['skills', '역량과 기술'],
              ['awards', '수상과 활동'],
              ['goals', '목표'],
            ].map(([key, label]) => portfolio[key] && (
              <section key={key}>
                <span>{label}</span>
                <p>{portfolio[key]}</p>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AITab() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.get('/api/admin/ai-usage').then((r) => setData(r.data)).catch(() => setData([]));
  }, []);

  return (
    <div className="admin-list">
      {data.length === 0 && <p className="empty-state">사용 내역이 없습니다.</p>}
      {data.map((item, index) => (
        <article key={`${item.username}-${index}`} className="admin-list-item">
          <div>
            <strong>{item.username}</strong>
            <span>{item.date}</span>
          </div>
          <b>{item.count}회 사용</b>
        </article>
      ))}
    </div>
  );
}
