import { Link } from 'react-router-dom';
import { getRoutePrefetchHandlers } from '../utils/routePrefetchHandlers';

export default function PrefetchLink({ to, children, ...props }) {
  const handlers = getRoutePrefetchHandlers(to, props);

  return (
    <Link to={to} {...props} {...handlers}>
      {children}
    </Link>
  );
}
