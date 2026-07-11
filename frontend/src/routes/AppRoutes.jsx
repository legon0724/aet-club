import { createElement, lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const HomePage = lazy(() => import('../pages/HomePage'));
const PortfolioPage = lazy(() => import('../pages/PortfolioPage'));
const TeamPage = lazy(() => import('../pages/TeamPage'));
const AIPage = lazy(() => import('../pages/AIPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));

const protectedRoutes = [
  { path: '/', Component: HomePage },
  { path: '/portfolio', Component: PortfolioPage },
  { path: '/team', Component: TeamPage },
  { path: '/ai', Component: AIPage },
  { path: '/admin', Component: AdminPage },
];

function PageLoader() {
  return <div className="route-loader" aria-label="페이지 불러오는 중" />;
}

function ProtectedPage({ children }) {
  return <PrivateRoute>{children}</PrivateRoute>;
}

function getProtectedElement(Component) {
  return (
    <ProtectedPage>
      {createElement(Component)}
    </ProtectedPage>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {protectedRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={getProtectedElement(route.Component)}
          />
        ))}
      </Routes>
    </Suspense>
  );
}
