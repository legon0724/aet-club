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
const LOCAL_ASSIGNMENTS_KEY = 'nc-local-assignments-v2';
const LOCAL_AI_USAGE_KEY = 'nc-local-ai-usage-v2';
const LOCAL_NOTICES_KEY = 'nc-local-notices-v2';

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

export const getLocalSubmissions = (teamId) => {
  const all = readJson(LOCAL_SUBMISSIONS_KEY, []);
  return all.filter((item) => item.team_id === teamId);
};

export const getLocalAssignments = (teamId) => {
  const all = readJson(LOCAL_ASSIGNMENTS_KEY, []);
  return all.filter((item) => !teamId || item.team_id === teamId);
};

export const addLocalAssignment = (teamId, user, data, fileName = '', fileData = '') => {
  const all = readJson(LOCAL_ASSIGNMENTS_KEY, []);
  const item = {
    id: `local-assignment-${Date.now()}`,
    team_id: teamId,
    title: data.title,
    content: data.content || '',
    due_at: data.due_at || '',
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

export const addLocalSubmission = (teamId, user, data, fileName = '') => {
  const all = readJson(LOCAL_SUBMISSIONS_KEY, []);
  const item = {
    id: `local-sub-${Date.now()}`,
    team_id: teamId,
    assignment_id: data.assignment_id || null,
    assignment_title: data.assignment_title || '',
    username: user?.username || 'NC member',
    title: data.title,
    content: data.content || '',
    link_url: data.link_url || '',
    file_name: fileName,
    created_at: new Date().toISOString(),
  };
  const next = [item, ...all];
  writeJson(LOCAL_SUBMISSIONS_KEY, next);
  return next.filter((entry) => entry.team_id === teamId);
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
