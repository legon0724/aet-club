import { lazy } from 'react';

const pageLoaders = {
  login: () => import('../pages/LoginPage'),
  home: () => import('../pages/HomePage'),
  portfolio: () => import('../pages/PortfolioPage'),
  sharedPortfolio: () => import('../pages/SharedPortfolioPage'),
  team: () => import('../pages/TeamPage'),
  ai: () => import('../pages/AIPage'),
  search: () => import('../pages/SearchPage'),
  admin: () => import('../pages/AdminPage'),
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
  '/portfolio': 'portfolio',
  '/portfolio/share': 'sharedPortfolio',
  '/team': 'team',
  '/ai': 'ai',
  '/search': 'search',
  '/admin': 'admin',
  '/login': 'login',
};

export const routePages = {
  LoginPage: lazyPage('login'),
  HomePage: lazyPage('home'),
  PortfolioPage: lazyPage('portfolio'),
  SharedPortfolioPage: lazyPage('sharedPortfolio'),
  TeamPage: lazyPage('team'),
  AIPage: lazyPage('ai'),
  SearchPage: lazyPage('search'),
  AdminPage: lazyPage('admin'),
};

export const protectedRoutes = [
  { path: '/', Component: routePages.HomePage },
  { path: '/portfolio', Component: routePages.PortfolioPage },
  { path: '/team', Component: routePages.TeamPage },
  { path: '/ai', Component: routePages.AIPage },
  { path: '/search', Component: routePages.SearchPage },
  { path: '/admin', Component: routePages.AdminPage },
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
