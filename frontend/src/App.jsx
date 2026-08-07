import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { clearLegacyLocalWorkspace } from './utils/localAuth';
import SiteDialog from './components/SiteDialog';

export default function App() {
  clearLegacyLocalWorkspace();

  return (
    <BrowserRouter>
      <AppRoutes />
      <SiteDialog />
    </BrowserRouter>
  );
}
