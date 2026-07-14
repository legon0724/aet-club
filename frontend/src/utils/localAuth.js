export const SCHOOL_EMAIL_DOMAIN = '@cam.hs.kr';
export const LOCAL_USERS_KEY = 'nc-local-users-v2';
export const LOCAL_RESET_KEY = 'nc-local-reset-v2';
export const LOCAL_CURRENT_USER_KEY = 'nc-current-user-v2';
export const LOCAL_RESET_VERSION_KEY = 'nc-local-auth-reset-version';
export const LOCAL_RESET_VERSION = '2026-07-10-clean-start';
export const LOCAL_DATA_RESET_VERSION_KEY = 'nc-local-data-reset-version';
export const LOCAL_DATA_RESET_VERSION = '2026-07-14-server-only';
export const ADMIN_EMAILS = ['2620325@cam.hs.kr', 'bliss00@cam.hs.kr'];
const LEGACY_WORKSPACE_KEYS = [
  LOCAL_USERS_KEY,
  LOCAL_RESET_KEY,
  'nc-local-portfolio-v2',
  'nc-local-messages-v2',
  'nc-local-submissions-v2',
  'nc-local-assignment-work-v1',
  'nc-local-assignments-v2',
  'nc-local-teams-v2',
  'nc-local-notices-v2',
  'nc-local-notice-reads-v1',
  'nc-local-gallery-v1',
  'nc-local-calendar-v1',
];

export const isSchoolEmail = (value = '') => value.trim().toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN);
export const isAdminEmail = (value = '') => ADMIN_EMAILS.includes(value.trim().toLowerCase());

export const encodePassword = (value) => window.btoa(unescape(encodeURIComponent(value)));

export const readLocalUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
  } catch {
    return [];
  }
};

export const writeLocalUsers = (users) => {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
};

export const isApiUnavailable = (err) => !err.response || err.response.status === 404 || err.response.status >= 500;

export const createLocalToken = (email) => `local:${email}:${Date.now()}`;

export const normalizeUser = (user = {}) => {
  const normalizedEmail = (user.email || '').trim().toLowerCase();
  return {
    id: user.id || normalizedEmail,
    username: user.username || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    is_admin: Boolean(user.is_admin || isAdminEmail(normalizedEmail)),
    team_id: user.team_id || 'creative',
  };
};

export const rememberCurrentUser = (user) => {
  const normalizedUser = normalizeUser(user);
  if (normalizedUser.email) {
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(normalizedUser));
  }
  return normalizedUser;
};

export const setLocalSession = (user) => {
  const normalizedUser = normalizeUser(user);
  if (!normalizedUser.email) return normalizedUser;
  localStorage.setItem('token', createLocalToken(normalizedUser.email));
  localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(normalizedUser));
  return normalizedUser;
};

export const getCurrentLocalUser = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  if (token.startsWith('local:')) {
    clearLocalSession();
    return null;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_CURRENT_USER_KEY) || 'null');
    if (saved?.email) {
      return { ...saved, is_admin: Boolean(saved.is_admin || isAdminEmail(saved.email)) };
    }
  } catch {
    // Ignore malformed local user data.
  }

  return null;
};

export const clearLocalSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
};

export const clearLegacyLocalWorkspace = () => {
  if (localStorage.getItem(LOCAL_DATA_RESET_VERSION_KEY) === LOCAL_DATA_RESET_VERSION) return;

  LEGACY_WORKSPACE_KEYS.forEach((key) => localStorage.removeItem(key));
  if (localStorage.getItem('token')?.startsWith('local:')) {
    clearLocalSession();
  }
  localStorage.setItem(LOCAL_DATA_RESET_VERSION_KEY, LOCAL_DATA_RESET_VERSION);
};
