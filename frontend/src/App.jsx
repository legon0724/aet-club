import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const AIPage = lazy(() => import('./pages/AIPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function PageLoader() {
  return <div className="route-loader" aria-label="페이지 불러오는 중" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
          <Route path="/portfolio" element={<PrivateRoute><PortfolioPage /></PrivateRoute>} />
          <Route path="/team" element={<PrivateRoute><TeamPage /></PrivateRoute>} />
          <Route path="/ai" element={<PrivateRoute><AIPage /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
