import api from '../api/client';

const routeEndpoints = {
  '/': ['/api/auth/me', '/api/notices/', '/api/assignments/'],
  '/notices': ['/api/auth/me', '/api/notices/'],
  '/assignments': ['/api/auth/me', '/api/teams/', '/api/assignments/', '/api/submissions/'],
  '/calendar': ['/api/auth/me', '/api/calendar/'],
  '/portfolio': ['/api/auth/me', '/api/portfolio/me', '/api/portfolio/public'],
  '/team': ['/api/auth/me', '/api/teams/'],
  '/ai': ['/api/auth/me', '/api/ai/usage'],
  '/admin': ['/api/auth/me', '/api/teams/'],
};

function normalizePath(to) {
  if (typeof to !== 'string') return '';
  const path = to.split(/[?#]/u)[0].replace(/\/+$/u, '');
  return path || '/';
}

export function prefetchRouteData(to) {
  const endpoints = routeEndpoints[normalizePath(to)];
  if (!endpoints) return;
  endpoints.forEach((endpoint) => {
    api.get(endpoint).catch(() => {});
  });
}
