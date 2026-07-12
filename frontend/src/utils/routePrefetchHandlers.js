import { preloadRoute } from '../routes/routeConfig';

function callHandler(handler, event) {
  if (handler) handler(event);
}

export function getRoutePrefetchHandlers(to, handlers = {}) {
  const warmRoute = () => preloadRoute(to);

  return {
    onFocus: (event) => {
      warmRoute();
      callHandler(handlers.onFocus, event);
    },
    onPointerDown: (event) => {
      warmRoute();
      callHandler(handlers.onPointerDown, event);
    },
    onPointerEnter: (event) => {
      warmRoute();
      callHandler(handlers.onPointerEnter, event);
    },
    onTouchStart: (event) => {
      warmRoute();
      callHandler(handlers.onTouchStart, event);
    },
  };
}
