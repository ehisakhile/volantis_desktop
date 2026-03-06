/**
 * API Logger Utility
 * Provides comprehensive request/response logging for debugging
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class ApiLogger {
  private level: LogLevel = LogLevel.DEBUG;
  private isEnabled: boolean = true;
  private prefix: string = '[API]';

  constructor() {
    // Enable logging in development mode
    this.isEnabled = import.meta.env.DEV;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.isEnabled && level >= this.level;
  }

  private formatTime(): string {
    return new Date().toISOString();
  }

  private formatHeaders(headers: HeadersInit | undefined): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        // Mask sensitive headers
        if (key.toLowerCase() === 'authorization') {
          result[key] = this.maskToken(value);
        } else {
          result[key] = value;
        }
      });
      return result;
    }
    // For plain objects, mask authorization
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'authorization' && typeof value === 'string') {
        result[key] = this.maskToken(value);
      } else if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  }

  private maskToken(token: string): string {
    // Show first 20 chars and last 5 chars if token is long enough
    if (token.length > 30) {
      return `${token.substring(0, 20)}...${token.substring(token.length - 5)}`;
    }
    return '[TOKEN]';
  }

  private formatBody(body: unknown, contentType: string | null): unknown {
    if (!body) return undefined;
    
    // Don't log binary data
    if (body instanceof FormData) {
      return '[FormData]';
    }
    
    // Try to parse and mask sensitive data
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return this.maskSensitiveData(parsed);
      } catch {
        return body;
      }
    }
    
    return this.maskSensitiveData(body);
  }

  private maskSensitiveData(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    
    if (typeof data !== 'object') return data;
    
    const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'access_token', 'refresh_token'];
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }
    
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        if (typeof value === 'string') {
          result[key] = value.length > 20 ? `${value.substring(0, 10)}...` : '[MASKED]';
        } else {
          result[key] = '[MASKED]';
        }
      } else if (typeof value === 'object') {
        result[key] = this.maskSensitiveData(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private getContentType(headers: HeadersInit | undefined): string | null {
    if (!headers) return null;
    if (headers instanceof Headers) {
      return headers.get('content-type');
    }
    const headerObj = headers as Record<string, string>;
    return headerObj['Content-Type'] || headerObj['content-type'] || null;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`${this.prefix} ${this.formatTime()} 🔍 ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`${this.prefix} ${this.formatTime()} ℹ️ ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`${this.prefix} ${this.formatTime()} ⚠️ ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`${this.prefix} ${this.formatTime()} ❌ ${message}`, ...args);
    }
  }

  /**
   * Log an outgoing API request
   */
  logRequest(url: string, options: RequestInit): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const contentType = this.getContentType(options.headers);
    const headers = this.formatHeaders(options.headers);
    const body = this.formatBody(options.body, contentType);

    console.group(`${this.prefix} 📤 REQUEST: ${options.method || 'GET'} ${url}`);
    console.log('Headers:', headers);
    if (body) {
      console.log('Body:', body);
    }
    console.groupEnd();
  }

  /**
   * Log an API response
   */
  logResponse(url: string, response: Response, duration: number): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const statusColor = response.ok ? '✅' : '❌';
    const statusGroup = response.ok ? 'group' : 'groupCollapsed';

    console[statusGroup](`${this.prefix} 📥 RESPONSE: ${statusColor} ${response.status} ${response.statusText} (${duration}ms) - ${response.url}`);

    // Clone response to read body without consuming it
    response.clone().text().then(text => {
      try {
        const data = text ? JSON.parse(text) : null;
        console.log('Response data:', this.maskSensitiveData(data));
      } catch {
        console.log('Response text:', text.substring(0, 500));
      }
    }).catch(() => {
      console.log('Response: [Could not read body]');
    });

    console.groupEnd();
  }

  /**
   * Log an API error
   */
  logError(url: string, error: Error | unknown, duration: number): void {
    this.error(`❌ REQUEST FAILED (${duration}ms): ${url}`, error);
  }

  /**
   * Log authentication-specific events
   */
  logAuth(event: 'login' | 'logout' | 'token_refresh' | 'token_expired', details: unknown): void {
    const emojis = {
      login: '🔐',
      logout: '🚪',
      token_refresh: '🔄',
      token_expired: '⏰'
    };
    
    this.info(`${emojis[event]} AUTH ${event.toUpperCase()}:`, details);
  }

  /**
   * Create a fetch wrapper that automatically logs requests/responses
   */
  createLoggedFetch() {
    const logger = this;
    
    return async function loggedFetch<T>(
      url: string,
      options: RequestInit = {}
    ): Promise<T> {
      const startTime = performance.now();
      
      // Log request
      logger.logRequest(url, options);
      
      try {
        const response = await fetch(url, options);
        const duration = Math.round(performance.now() - startTime);
        
        // Log response
        logger.logResponse(url, response, duration);
        
        // Handle error responses
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { detail: errorText || 'Request failed' };
          }
          
          throw Object.assign(new Error(errorData.detail || 'Request failed'), {
            status: response.status,
            data: errorData
          });
        }
        
        // Parse response
        const text = await response.text();
        return text ? JSON.parse(text) : (null as T);
        
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);
        logger.logError(url, error, duration);
        throw error;
      }
    };
  }
}

// Export singleton instance
export const apiLogger = new ApiLogger();

// Also export a default instance for convenience
export default apiLogger;
