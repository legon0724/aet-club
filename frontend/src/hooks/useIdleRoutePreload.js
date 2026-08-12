import { useEffect } from 'react';
import { preloadRoutes } from '../routes/routeConfig';
import { prefetchRouteData } from '../utils/dataPrefetch';

const commonRoutes = ['/', '/notices', '/assignments', '/calendar', '/portfolio', '/team', '/ai'];

export default function useIdleRoutePreload(enabled = false, includeAdmin = false) {
  useEffect(() => {
    if (!enabled) return undefined;

    const routes = includeAdmin ? [...commonRoutes, '/admin'] : commonRoutes;
    const warmRoutes = () => {
      preloadRoutes(routes);
      routes.forEach((route) => prefetchRouteData(route));
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warmRoutes, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(warmRoutes, 450);
    return () => window.clearTimeout(id);
  }, [enabled, includeAdmin]);
}
