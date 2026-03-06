/**
 * Router Logger Hook
 * Logs React Router navigation events
 */

import { useEffect } from 'react';
import { useLocation, useNavigationType, NavigationType } from 'react-router-dom';
import { logger } from './logger';

/**
 * Hook to log route changes
 * Usage: Add useRouteLogger() inside your Router component
 */
export function useRouteLogger(): void {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Log the navigation
    const getNavTypeLabel = (type: NavigationType): string => {
      switch (type) {
        case NavigationType.Pop:
          return '↔️ Browser navigation (back/forward)';
        case NavigationType.Push:
          return '➡️ Programmatic navigation (push)';
        case NavigationType.Replace:
          return '🔄 Programmatic navigation (replace)';
        default:
          return 'Unknown navigation';
      }
    };

    logger.router(`🧭 Route changed: ${location.pathname}`, {
      path: location.pathname,
      search: location.search,
      hash: location.hash,
      navigationType: getNavTypeLabel(navigationType),
      state: location.state,
    });
  }, [location, navigationType]);
}

export default useRouteLogger;
