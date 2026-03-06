/**
 * Volantis Logger
 * Comprehensive logging utility for the desktop app
 * Handles: requests, errors, navigation, state changes, and general logging
 */

// Re-export from apiLogger for convenience
export { LogLevel as ApiLogLevel } from './apiLogger';

// Log source types
export type LogSource = 'APP' | 'ROUTER' | 'STORE' | 'API' | 'WEBRTC' | 'SYSTEM';

// Log entry interface
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: LogSource;
  message: string;
  data?: unknown;
  stack?: string;
}

// Storage for logs (in-memory)
const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 1000;

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Format timestamp
const formatTimestamp = (): string => {
  return new Date().toISOString();
};

// Create log entry
const createLogEntry = (
  level: LogEntry['level'],
  source: LogSource,
  message: string,
  data?: unknown,
  stack?: string
): LogEntry => {
  return {
    id: generateId(),
    timestamp: formatTimestamp(),
    level,
    source,
    message,
    data,
    stack,
  };
};

// Add to history
const addToHistory = (entry: LogEntry): void => {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
};

// Console styling
const getStyles = (level: LogEntry['level'], source: LogSource): string[] => {
  const baseStyles = ['font-family: monospace', 'font-size: 12px'];
  
  const sourceStyles: Record<LogSource, string> = {
    APP: 'color: #61dafb',
    ROUTER: 'color: #b052f5',
    STORE: 'color: #4caf50',
    API: 'color: #ff9800',
    WEBRTC: 'color: #00bcd4',
    SYSTEM: 'color: #9e9e9e',
  };
  
  const levelStyles: Record<LogEntry['level'], string> = {
    debug: 'color: #9e9e9e',
    info: 'color: #2196f3',
    warn: 'color: #ff9800',
    error: 'color: #f44336; font-weight: bold',
  };
  
  return [...baseStyles, sourceStyles[source], levelStyles[level]];
};

// Format message for console
const formatMessage = (entry: LogEntry): string => {
  const emoji = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  }[entry.level];
  
  return `${emoji} [${entry.source}] ${entry.message}`;
};

class VolantisLogger {
  private isEnabled: boolean = true;
  private minLevel: LogEntry['level'] = 'debug';
  private prefix: string = '[VOLANTIS]';
  
  // Callbacks for log events
  private onLogCallbacks: Set<(entry: LogEntry) => void> = new Set();
  
  constructor() {
    // Enable logging in development mode, or always for debugging
    // Set to true to always see logs during development
    this.isEnabled = true; // import.meta.env.DEV;
    console.log('[VOLANTIS] Logger initialized, isEnabled:', this.isEnabled);
  }
  
  /**
   * Set the minimum log level
   */
  setLevel(level: LogEntry['level']): void {
    this.minLevel = level;
  }
  
  /**
   * Enable/disable logging
   */
  enable(): void {
    this.isEnabled = true;
  }
  
  disable(): void {
    this.isEnabled = false;
  }
  
  /**
   * Subscribe to log events
   */
  onLog(callback: (entry: LogEntry) => void): () => void {
    this.onLogCallbacks.add(callback);
    return () => this.onLogCallbacks.delete(callback);
  }
  
  /**
   * Get log history
   */
  getHistory(): LogEntry[] {
    return [...logHistory];
  }
  
  /**
   * Clear log history
   */
  clearHistory(): void {
    logHistory.length = 0;
  }
  
  /**
   * Filter logs by criteria
   */
  filterLogs(
    criteria: Partial<{
      level: LogEntry['level'];
      source: LogSource;
      since: Date;
    }>
  ): LogEntry[] {
    return logHistory.filter(entry => {
      if (criteria.level && entry.level !== criteria.level) return false;
      if (criteria.source && entry.source !== criteria.source) return false;
      if (criteria.since && new Date(entry.timestamp) < criteria.since) return false;
      return true;
    });
  }
  
  /**
   * Check if should log
   */
  private shouldLog(level: LogEntry['level']): boolean {
    if (!this.isEnabled) return false;
    
    const levels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    
    return currentIndex >= minIndex;
  }
  
  /**
   * Internal log method
   */
  private log(
    level: LogEntry['level'],
    source: LogSource,
    message: string,
    data?: unknown,
    stack?: string
  ): void {
    if (!this.shouldLog(level)) return;
    
    const entry = createLogEntry(level, source, message, data, stack);
    addToHistory(entry);
    
    // Call subscribers
    this.onLogCallbacks.forEach(cb => {
      try {
        cb(entry);
      } catch (e) {
        console.error('Log callback error:', e);
      }
    });
    
    // Console output
    const styles = getStyles(level, source);
    const formattedMessage = formatMessage(entry);
    
    switch (level) {
      case 'debug':
        console.debug(`%c${this.prefix} ${formattedMessage}`, ...styles, data || '');
        break;
      case 'info':
        console.info(`%c${this.prefix} ${formattedMessage}`, ...styles, data || '');
        break;
      case 'warn':
        console.warn(`%c${this.prefix} ${formattedMessage}`, ...styles, data || '');
        break;
      case 'error':
        console.error(`%c${this.prefix} ${formattedMessage}`, ...styles);
        if (data) console.error('Data:', data);
        if (stack) console.error('Stack:', stack);
        break;
    }
  }
  
  // Convenience methods
  debug(source: LogSource, message: string, data?: unknown): void {
    this.log('debug', source, message, data);
  }
  
  info(source: LogSource, message: string, data?: unknown): void {
    this.log('info', source, message, data);
  }
  
  warn(source: LogSource, message: string, data?: unknown): void {
    this.log('warn', source, message, data);
  }
  
  error(source: LogSource, message: string, data?: unknown, stack?: string): void {
    this.log('error', source, message, data, stack);
  }
  
  // App-level logging
  app(message: string, data?: unknown): void {
    this.info('APP', message, data);
  }
  
  appError(message: string, data?: unknown): void {
    this.error('APP', message, data);
  }
  
  // Router logging
  router(message: string, data?: unknown): void {
    this.info('ROUTER', message, data);
  }
  
  // Store logging
  store(message: string, data?: unknown): void {
    this.debug('STORE', message, data);
  }
  
  // API logging (delegate to apiLogger)
  api(message: string, data?: unknown): void {
    this.info('API', message, data);
  }
  
  // WebRTC logging
  webrtc(message: string, data?: unknown): void {
    this.info('WEBRTC', message, data);
  }
  
  // System logging
  system(message: string, data?: unknown): void {
    this.info('SYSTEM', message, data);
  }
}

// Export singleton
export const logger = new VolantisLogger();

// Also export default
export default logger;

/**
 * Initialize global error handlers
 * Should be called at app startup
 */
export function initGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  window.addEventListener('error', (event) => {
    logger.error('SYSTEM', '🚨 Uncaught Exception', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.message,
    }, event.error?.stack);
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('SYSTEM', '🚨 Unhandled Promise Rejection', {
      reason: event.reason,
    }, event.reason?.stack);
  });
  
  // Handle beforeunload (page unload)
  window.addEventListener('beforeunload', () => {
    logger.debug('SYSTEM', '📤 Page unloading', {
      logCount: logHistory.length,
    });
  });
  
  // Log navigation events (for single-page app)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    logger.router('📜 History pushState', { args });
    return originalPushState.apply(this, args);
  };
  
  history.replaceState = function(...args) {
    logger.router('📜 History replaceState', { args });
    return originalReplaceState.apply(this, args);
  };
  
  logger.system('✅ Global error handlers initialized');
}

/**
 * Setup React Router logging
 * Call this with your Router component's basename
 */
export function setupRouterLogging(): void {
  // We'll use a custom useEffect in the router setup instead
  logger.system('🔗 Router logging ready - use useRouteLogger hook');
}

/**
 * Create a Zustand middleware for logging state changes
 * Usage: Add this middleware to your zustand store
 * import { loggerMiddleware } from '../lib/logger';
 */
export const loggerMiddleware = (name: string) => (config: (set: (fn: (state: unknown) => void) => void, get: () => unknown, api: unknown) => unknown) => {
  return (set: (fn: (state: unknown) => void) => void, get: () => unknown, api: unknown) => {
    const wrappedSet = (fn: (state: unknown) => void) => {
      const prevState = get();
      fn(prevState); // Apply the state change
      
      // Log state changes
      logger.store(`📦 [${name}] State changed`);
      
      return set(fn);
    };
    
    return config(wrappedSet, get, api);
  };
};

/**
 * Hook for logging React component lifecycle
 * Usage: const logRef = useComponentLogger('ComponentName', props);
 */
export function useComponentLogger(
  _componentName: string,
  _props?: Record<string, unknown>
): void {
  // This would be used inside components with useEffect
  // For now, just a placeholder that can be used later
}

/**
 * Export logs for debugging
 */
export function exportLogs(): string {
  return JSON.stringify(logHistory, null, 2);
}

/**
 * Download logs as file
 */
export function downloadLogs(): void {
  const logs = exportLogs();
  const blob = new Blob([logs], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `volantis-logs-${formatTimestamp()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  logger.system('📥 Logs downloaded');
}
