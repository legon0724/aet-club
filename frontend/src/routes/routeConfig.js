import { lazy } from 'react';

const pageLoaders = {
  login: () => import('../pages/LoginPage'),
  home: () => import('../pages/HomePage'),
  notices: () => import('../pages/NoticesPage'),
  portfolio: () => import('../pages/PortfolioPage'),
  sharedPortfolio: () => import('../pages/SharedPortfolioPage'),
  assignments: () => import('../pages/AssignmentsPage'),
  calendar: () => import('../pages/CalendarPage'),
  team: () => import('../pages/TeamPage'),
  ai: () => import('../pages/AIPage'),
  search: () => import('../pages/SearchPage'),
  admin: () => import('../pages/AdminPage'),
  passwordChange: () => import('../pages/TemporaryPasswordPage'),
};

const pagePromises = new Map();

function loadPage(key) {
  if (!pagePromises.has(key)) {
    pagePromises.set(key, pageLoaders[key]());
  }

  return pagePromises.get(key);
}

function lazyPage(key) {
  return lazy(() => loadPage(key));
}

const routePageKeys = {
  '/': 'home',
  '/notices': 'notices',
  '/portfolio': 'portfolio',
  '/portfolio/share': 'sharedPortfolio',
  '/team': 'team',
  '/assignments': 'assignments',
  '/calendar': 'calendar',
  '/ai': 'ai',
  '/search': 'search',
  '/admin': 'admin',
  '/password-change': 'passwordChange',
  '/login': 'login',
};

export const routePages = {
  LoginPage: lazyPage('login'),
  HomePage: lazyPage('home'),
  NoticesPage: lazyPage('notices'),
  PortfolioPage: lazyPage('portfolio'),
  SharedPortfolioPage: lazyPage('sharedPortfolio'),
  AssignmentsPage: lazyPage('assignments'),
  CalendarPage: lazyPage('calendar'),
  TeamPage: lazyPage('team'),
  AIPage: lazyPage('ai'),
  SearchPage: lazyPage('search'),
  AdminPage: lazyPage('admin'),
  TemporaryPasswordPage: lazyPage('passwordChange'),
};

export const protectedRoutes = [
  { path: '/', Component: routePages.HomePage },
  { path: '/notices', Component: routePages.NoticesPage },
  { path: '/portfolio', Component: routePages.PortfolioPage },
  { path: '/team', Component: routePages.TeamPage },
  { path: '/assignments', Component: routePages.AssignmentsPage },
  { path: '/calendar', Component: routePages.CalendarPage },
  { path: '/ai', Component: routePages.AIPage },
  { path: '/search', Component: routePages.SearchPage },
  { path: '/admin', Component: routePages.AdminPage },
  { path: '/password-change', Component: routePages.TemporaryPasswordPage },
];

export const publicRoutes = [
  { path: '/portfolio/share/:userId', Component: routePages.SharedPortfolioPage },
];

function normalizePath(to) {
  if (typeof to !== 'string') return '';
  const path = to.split(/[?#]/u)[0].replace(/\/+$/u, '');
  return path || '/';
}

export function preloadRoute(to) {
  const pageKey = routePageKeys[normalizePath(to)];
  if (!pageKey) return null;

  const request = loadPage(pageKey);
  request.catch(() => pagePromises.delete(pageKey));
  return request;
}

export function preloadRoutes(routes) {
  routes.forEach((route) => preloadRoute(route));
}
