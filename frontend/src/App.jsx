import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PortfolioPage from './pages/PortfolioPage';
import TeamPage from './pages/TeamPage';
import AIPage from './pages/AIPage';
import AdminPage from './pages/AdminPage';
import PrivateRoute from './components/PrivateRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="/portfolio" element={<PrivateRoute><PortfolioPage /></PrivateRoute>} />
        <Route path="/team" element={<PrivateRoute><TeamPage /></PrivateRoute>} />
        <Route path="/ai" element={<PrivateRoute><AIPage /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}