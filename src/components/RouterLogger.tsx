/**
 * RouterLogger Component
 * Wraps children to log route changes
 */

import { useRouteLogger } from '../lib/useRouteLogger';

interface RouterLoggerProps {
  children: React.ReactNode;
}

/**
 * Component that logs route changes when placed inside Router
 */
export function RouterLogger({ children }: RouterLoggerProps) {
  useRouteLogger();
  return <>{children}</>;
}

export default RouterLogger;
