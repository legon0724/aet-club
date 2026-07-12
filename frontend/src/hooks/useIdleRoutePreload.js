import { useEffect } from 'react';
import { preloadRoutes } from '../routes/routeConfig';

const commonRoutes = ['/', '/portfolio', '/team', '/ai'];

export default function useIdleRoutePreload(includeAdmin = false) {
  useEffect(() => {
    const routes = includeAdmin ? [...commonRoutes, '/admin'] : commonRoutes;
    const warmRoutes = () => preloadRoutes(routes);

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warmRoutes, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(warmRoutes, 450);
    return () => window.clearTimeout(id);
  }, [includeAdmin]);
}
