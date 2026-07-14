import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { clearLegacyLocalWorkspace } from './utils/localAuth';

export default function App() {
  clearLegacyLocalWorkspace();

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
