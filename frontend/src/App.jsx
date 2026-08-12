import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { clearLegacyLocalWorkspace, getCurrentLocalUser } from './utils/localAuth';
import SiteDialog from './components/SiteDialog';
import api from './api/client';
import { applyUserBackground } from './utils/background';

export default function App() {
  clearLegacyLocalWorkspace();

  useEffect(() => {
    const user = getCurrentLocalUser();
    if (!user) {
      applyUserBackground(null);
      return;
    }
    api.get('/api/auth/me/background')
      .then((response) => applyUserBackground(response.data.background_image, user.id))
      .catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
      <SiteDialog />
    </BrowserRouter>
  );
}
