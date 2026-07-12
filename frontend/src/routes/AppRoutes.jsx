import { createElement, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PrivateRoute from '../components/PrivateRoute';
import useIdleRoutePreload from '../hooks/useIdleRoutePreload';
import { getCurrentLocalUser } from '../utils/localAuth';
import { protectedRoutes, publicRoutes, routePages } from './routeConfig';

const LoginPage = routePages.LoginPage;

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
  useIdleRoutePreload(Boolean(getCurrentLocalUser()?.is_admin));

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {publicRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={createElement(route.Component)}
          />
        ))}
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
