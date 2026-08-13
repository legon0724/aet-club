import { useEffect } from 'react';
import { preloadRoute } from '../routes/routeConfig';

const commonRoutes = ['/', '/notices', '/assignments', '/calendar', '/portfolio'];

export default function useIdleRoutePreload(enabled = false, includeAdmin = false) {
  useEffect(() => {
    if (!enabled) return undefined;

    const routes = includeAdmin ? [...commonRoutes, '/admin'] : commonRoutes;
    let cancelled = false;
    const warmRoutes = async () => {
      for (const route of routes) {
        if (cancelled) return;
        await preloadRoute(route);
      }
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warmRoutes, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(warmRoutes, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [enabled, includeAdmin]);
}
