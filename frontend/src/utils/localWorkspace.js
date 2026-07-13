import { readLocalUsers } from './localAuth';

export const DEFAULT_TEAMS = [
  {
    id: 'creative',
    name: 'NC Creative',
    description: '과제 제출, 피드백, 팀 대화를 한곳에서 진행합니다.',
    color: '#2dd4bf',
  },
  {
    id: 'portfolio',
    name: 'Portfolio Lab',
    description: '포트폴리오와 활동 기록을 서로 점검합니다.',
    color: '#8b5cf6',
  },
  {
    id: 'research',
    name: 'AI Research',
    description: '분석 자료와 아이디어를 정리하는 팀입니다.',
    color: '#fb7185',
  },
];

const LOCAL_PORTFOLIO_KEY = 'nc-local-portfolio-v2';
const LOCAL_MESSAGES_KEY = 'nc-local-messages-v2';
const LOCAL_SUBMISSIONS_KEY = 'nc-local-submissions-v2';
const LOCAL_ASSIGNMENT_WORK_KEY = 'nc-local-assignment-work-v1';
const LOCAL_ASSIGNMENTS_KEY = 'nc-local-assignments-v2';
const LOCAL_TEAMS_KEY = 'nc-local-teams-v2';
const LOCAL_AI_USAGE_KEY = 'nc-local-ai-usage-v2';
const LOCAL_NOTICES_KEY = 'nc-local-notices-v2';
const LOCAL_NOTICE_READS_KEY = 'nc-local-notice-reads-v1';
const LOCAL_GALLERY_KEY = 'nc-local-gallery-v1';
const LOCAL_CALENDAR_KEY = 'nc-local-calendar-v1';

export const readJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const userKey = (user) => (user?.email || 'guest').trim().toLowerCase();
const assignmentWorkKey = (assignmentId, user) => `${assignmentId}:${userKey(user)}`;
const noticeKey = (notice) => String(notice?.id || notice || '');

export const getLocalTeams = () => readJson(LOCAL_TEAMS_KEY, DEFAULT_TEAMS);

export const setLocalTeams = (teams) => {
  writeJson(LOCAL_TEAMS_KEY, teams);
  return teams;
};

export const addLocalTeam = (data) => {
  const teams = getLocalTeams();
  const team = {
    id: `local-team-${Date.now()}`,
    name: data.name,
    description: data.description || '',
    color: data.color || '#2dd4bf',
    created_at: new Date().toISOString(),
  };
  return setLocalTeams([...teams, team]);
};

export const deleteLocalTeam = (teamId) => {
  const teams = getLocalTeams().filter((team) => team.id !== teamId);
  writeJson(LOCAL_TEAMS_KEY, teams);
  writeJson(LOCAL_ASSIGNMENTS_KEY, readJson(LOCAL_ASSIGNMENTS_KEY, []).filter((item) => item.team_id !== teamId));
  writeJson(LOCAL_SUBMISSIONS_KEY, readJson(LOCAL_SUBMISSIONS_KEY, []).filter((item) => item.team_id !== teamId));
  const messages = readJson(LOCAL_MESSAGES_KEY, {});
  delete messages[teamId];
  writeJson(LOCAL_MESSAGES_KEY, messages);
  return teams;
};

export const getFallbackNotices = () => {
  const saved = readJson(LOCAL_NOTICES_KEY, []);
  if (saved.length) return saved;
  return [
    {
      id: 'welcome',
      title: 'NC 활동 공간이 열렸습니다',
      content: '포트폴리오 작성, 팀 과제 제출, 활동 분석을 이 화면에서 바로 진행할 수 있습니다.',
      is_pinned: true,
      created_at: new Date().toISOString(),
    },
  ];
};

export const markLocalNoticesRead = (notices, user) => {
  const activeUser = {
    user_id: userKey(user),
    username: user?.username || 'NC member',
    email: user?.email || '',
    read_at: new Date().toISOString(),
  };
  const reads = readJson(LOCAL_NOTICE_READS_KEY, {});

  notices.forEach((notice) => {
    const key = noticeKey(notice);
    if (!key) return;
    reads[key] = {
      ...(reads[key] || {}),
      [activeUser.user_id]: activeUser,
    };
  });

  writeJson(LOCAL_NOTICE_READS_KEY, reads);
  return reads;
};

export const getLocalNoticeReadSummary = (notices = getFallbackNotices()) => {
  const reads = readJson(LOCAL_NOTICE_READS_KEY, {});
  const users = readLocalUsers().map((user) => ({
    user_id: userKey(user),
    username: user.username,
    email: user.email,
    read_at: null,
  }));

  return notices.map((notice) => {
    const noticeReads = Object.values(reads[noticeKey(notice)] || {});
    const readIds = new Set(noticeReads.map((read) => read.user_id));
    const unreadUsers = users.filter((user) => !readIds.has(user.user_id));

    return {
      notice_id: noticeKey(notice),
      title: notice.title,
      created_at: notice.created_at,
      read_count: noticeReads.length,
      unread_count: unreadUsers.length,
      total_users: users.length,
      readers: noticeReads,
      unread_users: unreadUsers,
    };
  });
};

export const getLocalPortfolio = (user) => {
  const all = readJson(LOCAL_PORTFOLIO_KEY, {});
  return {
    username: user?.username || '',
    email: user?.email || '',
    intro: '',
    projects: '',
    skills: '',
    awards: '',
    goals: '',
    is_public: false,
    github_url: '',
    blog_url: '',
    notion_url: '',
    profile_image: '',
    ...(all[userKey(user)] || {}),
  };
};

export const saveLocalPortfolio = (user, data) => {
  const all = readJson(LOCAL_PORTFOLIO_KEY, {});
  const saved = {
    ...getLocalPortfolio(user),
    ...data,
    username: user?.username || data.username || '',
    email: user?.email || data.email || '',
    updated_at: new Date().toISOString(),
  };
  all[userKey(user)] = saved;
  writeJson(LOCAL_PORTFOLIO_KEY, all);
  return saved;
};

export const getAllLocalPortfolios = () => readJson(LOCAL_PORTFOLIO_KEY, {});

export const getLocalPortfolioById = (userId) => {
  const target = decodeURIComponent(userId || '').toLowerCase();
  const entry = Object.entries(readJson(LOCAL_PORTFOLIO_KEY, {})).find(([email, portfolio]) => {
    const keys = [email, portfolio.email, portfolio.user_id].filter(Boolean).map((value) => String(value).toLowerCase());
    return keys.includes(target);
  });

  if (!entry) return null;
  const [email, portfolio] = entry;
  return { ...portfolio, user_id: portfolio.user_id || email, email: portfolio.email || email };
};

export const getPublicLocalPortfolios = (viewer) => (
  Object.entries(readJson(LOCAL_PORTFOLIO_KEY, {}))
    .map(([email, portfolio]) => ({ ...portfolio, user_id: email, email: portfolio.email || email }))
    .filter((portfolio) => {
      const sameEmail = portfolio.email?.toLowerCase() === viewer?.email?.toLowerCase();
      return portfolio.is_public && !sameEmail;
    })
);

export const fileToDataUrl = (file) => (
  new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })
);

export const getLocalMessages = (teamId) => {
  const all = readJson(LOCAL_MESSAGES_KEY, {});
  return all[teamId] || [];
};

export const addLocalMessage = (teamId, user, content) => {
  const all = readJson(LOCAL_MESSAGES_KEY, {});
  const message = {
    id: `local-msg-${Date.now()}`,
    team_id: teamId,
    username: user?.username || 'NC member',
    content,
    created_at: new Date().toISOString(),
  };
  const next = [...(all[teamId] || []), message];
  all[teamId] = next;
  writeJson(LOCAL_MESSAGES_KEY, all);
  return next;
};

export const getLocalSubmissions = (teamId, user) => {
  const all = readJson(LOCAL_SUBMISSIONS_KEY, []);
  return all.filter((item) => {
    const sameTeam = item.team_id === teamId;
    const isMine = item.email === user?.email || item.user_id === userKey(user) || item.username === user?.username;
    const canSee = user?.is_admin ? item.status !== 'draft' : isMine;
    return sameTeam && canSee;
  });
};

export const getLocalAssignments = (teamId) => {
  const all = readJson(LOCAL_ASSIGNMENTS_KEY, []);
  return all.filter((item) => !teamId || item.team_id === teamId);
};

export const getLocalGallery = () => readJson(LOCAL_GALLERY_KEY, []);

export const addLocalGalleryItem = (data, fileName = '', fileData = '') => {
  const item = {
    id: `local-gallery-${Date.now()}`,
    title: data.title,
    description: data.description || '',
    image_url: fileData && fileData.startsWith('data:image') ? fileData : '',
    file_url: fileData && !fileData.startsWith('data:image') ? fileData : '',
    file_name: fileName,
    link_url: data.link_url || '',
    created_at: new Date().toISOString(),
  };
  const next = [item, ...getLocalGallery()];
  writeJson(LOCAL_GALLERY_KEY, next);
  return next;
};

export const deleteLocalGalleryItem = (id) => {
  const next = getLocalGallery().filter((item) => item.id !== id);
  writeJson(LOCAL_GALLERY_KEY, next);
  return next;
};

export const getLocalCalendarEvents = () => (
  readJson(LOCAL_CALENDAR_KEY, []).sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
);

export const addLocalCalendarEvent = (data) => {
  const item = {
    id: `local-event-${Date.now()}`,
    title: data.title,
    start_date: data.start_date,
    end_date: data.end_date || '',
    event_type: data.event_type || '일정',
    team_id: data.team_id || '',
  };
  const next = [...getLocalCalendarEvents(), item].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  writeJson(LOCAL_CALENDAR_KEY, next);
  return next;
};

export const deleteLocalCalendarEvent = (id) => {
  const next = getLocalCalendarEvents().filter((item) => item.id !== id);
  writeJson(LOCAL_CALENDAR_KEY, next);
  return next;
};

export const getLocalAssignmentStatus = (teamId) => {
  const assignments = getLocalAssignments(teamId);
  const allUsers = readLocalUsers();
  const teamUsers = allUsers.filter((user) => !teamId || !user.team_id || user.team_id === teamId);
  const users = teamUsers.length ? teamUsers : allUsers;
  const submissions = readJson(LOCAL_SUBMISSIONS_KEY, []);

  return assignments.map((assignment) => {
    const workByUser = {};
    submissions
      .filter((item) => item.assignment_id === assignment.id)
      .forEach((item) => {
        const key = item.user_id || item.email?.toLowerCase() || item.username;
        const existing = workByUser[key];
        const nextDate = new Date(item.updated_at || item.created_at || 0).getTime();
        const currentDate = new Date(existing?.updated_at || existing?.created_at || 0).getTime();
        if (!existing || item.status === 'submitted' || nextDate >= currentDate) {
          workByUser[key] = item;
        }
      });

    const counts = { submitted: 0, draft: 0, missing: 0 };
    const students = users.map((user) => {
      const work = workByUser[userKey(user)];
      const status = work ? (work.status === 'submitted' ? 'submitted' : 'draft') : 'missing';
      counts[status] += 1;

      return {
        user_id: userKey(user),
        username: user.username,
        email: user.email,
        status,
        updated_at: work?.updated_at || work?.created_at || null,
      };
    });

    return {
      assignment_id: assignment.id,
      title: assignment.title,
      due_at: assignment.due_at,
      submitted_count: counts.submitted,
      draft_count: counts.draft,
      missing_count: counts.missing,
      total_count: users.length,
      students,
    };
  });
};

export const addLocalAssignment = (teamId, user, data, fileName = '', fileData = '') => {
  const all = readJson(LOCAL_ASSIGNMENTS_KEY, []);
  const item = {
    id: `local-assignment-${Date.now()}`,
    team_id: teamId,
    title: data.title,
    content: data.content || '',
    due_at: data.due_at || '',
    resource_url: data.resource_url || '',
    copy_mode: data.copy_mode || 'site',
    points: data.points || '',
    file_name: fileName,
    file_data: fileData,
    created_by: user?.username || 'NC admin',
    created_at: new Date().toISOString(),
  };
  const next = [item, ...all];
  writeJson(LOCAL_ASSIGNMENTS_KEY, next);
  return next.filter((entry) => !teamId || entry.team_id === teamId);
};

export const deleteLocalAssignment = (id) => {
  const next = readJson(LOCAL_ASSIGNMENTS_KEY, []).filter((item) => item.id !== id);
  writeJson(LOCAL_ASSIGNMENTS_KEY, next);
  return next;
};

export const getLocalAssignmentWork = (assignmentId, user) => (
  readJson(LOCAL_ASSIGNMENT_WORK_KEY, {})[assignmentWorkKey(assignmentId, user)] || null
);

export const saveLocalAssignmentWork = (assignment, user, data = {}, status = 'draft') => {
  const all = readJson(LOCAL_ASSIGNMENT_WORK_KEY, {});
  const key = assignmentWorkKey(assignment.id, user);
  const existing = all[key] || {};
  const saved = {
    ...existing,
    id: existing.id || `local-work-${assignment.id}-${userKey(user)}`,
    user_id: userKey(user),
    email: user?.email || '',
    username: user?.username || 'NC member',
    team_id: assignment.team_id,
    assignment_id: assignment.id,
    assignment_title: assignment.title,
    title: data.title || assignment.title,
    content: data.content || '',
    link_url: data.link_url || '',
    work_content: data.work_content || '',
    status,
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  all[key] = saved;
  writeJson(LOCAL_ASSIGNMENT_WORK_KEY, all);
  const submissions = readJson(LOCAL_SUBMISSIONS_KEY, []);
  writeJson(LOCAL_SUBMISSIONS_KEY, [
    saved,
    ...submissions.filter((item) => !(item.assignment_id === assignment.id && item.user_id === userKey(user))),
  ]);
  return saved;
};

export const submitLocalAssignmentWork = (teamId, user, assignment, data, fileName = '') => {
  const submitted = {
    ...saveLocalAssignmentWork(assignment, user, data, 'submitted'),
    file_name: fileName,
  };
  const all = readJson(LOCAL_SUBMISSIONS_KEY, []);
  const next = [
    submitted,
    ...all.filter((item) => !(item.assignment_id === assignment.id && item.user_id === userKey(user))),
  ];
  writeJson(LOCAL_SUBMISSIONS_KEY, next);
  return getLocalSubmissions(teamId, user);
};

export const addLocalSubmission = (teamId, user, data, fileName = '') => {
  const all = readJson(LOCAL_SUBMISSIONS_KEY, []);
  const item = {
    id: `local-sub-${Date.now()}`,
    user_id: userKey(user),
    email: user?.email || '',
    team_id: teamId,
    assignment_id: data.assignment_id || null,
    assignment_title: data.assignment_title || '',
    username: user?.username || 'NC member',
    title: data.title,
    content: data.content || '',
    work_content: data.work_content || '',
    link_url: data.link_url || '',
    file_name: fileName,
    status: 'submitted',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const next = [item, ...all];
  writeJson(LOCAL_SUBMISSIONS_KEY, next);
  return getLocalSubmissions(teamId, user);
};

const buildActivityBadges = (metrics) => ([
  ['starter', '시작 배지', '첫 활동 기록을 남겼습니다.', metrics.score >= 10],
  ['submitter', '제출 루틴', '과제를 제출했습니다.', metrics.submitted_count >= 1],
  ['portfolio', '포트폴리오 공개', '공개 포트폴리오를 열었습니다.', metrics.portfolio_public],
  ['project', '프로젝트 기록', '프로젝트 내용을 정리했습니다.', metrics.project_ready],
  ['presenter', '발표 기록', '발표나 활동 자료를 공유했습니다.', metrics.gallery_count >= 1 || metrics.award_ready],
].map(([key, label, description, earned]) => ({ key, label, description, earned })));

export const getLocalActivitySummary = (user) => {
  const submissions = readJson(LOCAL_SUBMISSIONS_KEY, []).filter((item) => (
    item.email === user?.email || item.user_id === userKey(user) || item.username === user?.username
  ));
  const submittedCount = submissions.filter((item) => item.status === 'submitted').length;
  const draftCount = submissions.filter((item) => item.status === 'draft').length;
  const portfolio = getLocalPortfolio(user);
  const portfolioSections = ['intro', 'projects', 'skills', 'awards', 'goals']
    .filter((key) => String(portfolio[key] || '').trim()).length;
  const projectReady = Boolean(String(portfolio.projects || '').trim());
  const awardReady = Boolean(String(portfolio.awards || '').trim());
  const galleryCount = user?.is_admin ? getLocalGallery().length : 0;
  const score = (
    submittedCount * 15
    + draftCount * 5
    + portfolioSections * 4
    + (portfolio.is_public ? 10 : 0)
    + (projectReady ? 8 : 0)
    + (awardReady ? 8 : 0)
    + galleryCount * 12
  );
  const metrics = {
    score,
    submitted_count: submittedCount,
    draft_count: draftCount,
    portfolio_sections: portfolioSections,
    portfolio_public: Boolean(portfolio.is_public),
    project_ready: projectReady,
    award_ready: awardReady,
    gallery_count: galleryCount,
  };

  return {
    ...metrics,
    badges: buildActivityBadges(metrics),
  };
};

const includesQuery = (value, query) => String(value || '').toLowerCase().includes(query);
const firstText = (...values) => values.find((value) => String(value || '').trim()) || '';

export const searchLocalWorkspace = (queryText, user) => {
  const query = queryText.trim().toLowerCase();
  if (query.length < 2) return [];

  const noticeResults = getFallbackNotices()
    .filter((notice) => includesQuery(notice.title, query) || includesQuery(notice.content, query))
    .map((notice) => ({
      id: notice.id,
      type: '공지',
      title: notice.title,
      snippet: firstText(notice.content, notice.title).slice(0, 140),
      href: '/',
      date: notice.created_at,
    }));

  const assignmentResults = getLocalAssignments(user?.team_id)
    .filter((assignment) => includesQuery(assignment.title, query) || includesQuery(assignment.content, query))
    .map((assignment) => ({
      id: assignment.id,
      type: '과제',
      title: assignment.title,
      snippet: firstText(assignment.content, assignment.due_at).slice(0, 140),
      href: '/team',
      date: assignment.created_at,
    }));

  const portfolioResults = Object.entries(getAllLocalPortfolios())
    .map(([email, portfolio]) => ({ ...portfolio, user_id: email, email: portfolio.email || email }))
    .filter((portfolio) => (
      user?.is_admin || portfolio.is_public || portfolio.email?.toLowerCase() === user?.email?.toLowerCase()
    ))
    .filter((portfolio) => (
      includesQuery(portfolio.username, query)
      || ['intro', 'projects', 'skills', 'awards', 'goals'].some((key) => includesQuery(portfolio[key], query))
    ))
    .map((portfolio) => ({
      id: portfolio.user_id,
      type: '포트폴리오',
      title: portfolio.username || portfolio.email || 'NC member',
      snippet: firstText(portfolio.intro, portfolio.projects, portfolio.skills, portfolio.awards, portfolio.goals).slice(0, 140),
      href: portfolio.email?.toLowerCase() === user?.email?.toLowerCase() ? '/portfolio' : `/portfolio/share/${encodeURIComponent(portfolio.user_id)}`,
      date: portfolio.updated_at || new Date().toISOString(),
    }));

  return [...noticeResults, ...assignmentResults, ...portfolioResults]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);
};

export const deleteLocalSubmission = (id) => {
  const next = readJson(LOCAL_SUBMISSIONS_KEY, []).filter((item) => item.id !== id);
  writeJson(LOCAL_SUBMISSIONS_KEY, next);
  return next;
};

const usageKey = (user) => `${userKey(user)}:${new Date().toISOString().slice(0, 10)}`;

export const getLocalAIUsage = (user) => {
  const all = readJson(LOCAL_AI_USAGE_KEY, {});
  const used = all[usageKey(user)] || 0;
  const limit = 5;
  return { used, remaining: Math.max(limit - used, 0), limit };
};

export const increaseLocalAIUsage = (user) => {
  const all = readJson(LOCAL_AI_USAGE_KEY, {});
  const key = usageKey(user);
  all[key] = (all[key] || 0) + 1;
  writeJson(LOCAL_AI_USAGE_KEY, all);
  return getLocalAIUsage(user);
};

export const buildLocalAnalysis = (form) => {
  const textLength = form.record_text.trim().length;
  const admission = form.target_admission || '학생부종합전형';
  const university = form.target_university || '목표 대학';
  return [
    `목표: ${university} ${form.target_major} / ${admission}`,
    '',
    '강점',
    `- 활동 기록이 ${textLength}자 정도로 확보되어 있어 방향성 정리가 가능합니다.`,
    '- 프로젝트, 역할, 결과를 분리해서 쓰면 평가자가 기여도를 더 빠르게 이해할 수 있습니다.',
    '',
    '보완할 점',
    '- 단순 참여 표현보다 문제 정의, 시도한 방법, 배운 점을 한 문장 안에 넣는 편이 좋습니다.',
    '- 결과가 숫자로 드러나는 활동은 수치, 기간, 사용 기술을 같이 적어 주세요.',
    '',
    '추천 문장 방향',
    `- "${form.target_major}"와 연결되는 탐구 동기를 앞에 두고, 팀 활동에서 맡은 역할과 개선 결과를 뒤에 배치하세요.`,
    '- 마지막 문장은 다음 활동으로 이어지는 성장 가능성이 보이게 마무리하면 좋습니다.',
  ].join('\n');
};

export const getLocalAdminUsers = () => (
  readLocalUsers().map((user) => ({
    id: user.email,
    username: user.username,
    email: user.email,
    is_admin: user.is_admin,
    team_id: user.team_id || 'creative',
  }))
);
