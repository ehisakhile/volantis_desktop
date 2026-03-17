import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiLogger } from '../lib/apiLogger';
import { logger } from '../lib/logger';

interface User {
  id: string;
  email: string;
  name: string;
  company_id?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isEmailVerified: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setEmailVerified: (verified: boolean) => void;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  requestPasswordReset: (email: string) => Promise<{ message: string }>;
  verifyPasswordReset: (email: string, otp: string, newPassword: string) => Promise<{ access_token: string; refresh_token: string; user?: User }>;
}

// Mock API URL - in production this would be from environment
const API_URL = 'https://api-dev.volantislive.com';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isEmailVerified: false,

      setUser: (user) => {
        logger.store('📦 AuthStore: User updated', { userId: user?.id });
        set({ user, isAuthenticated: !!user });
      },
      
      setTokens: (accessToken, refreshToken) => {
        logger.store('📦 AuthStore: Tokens updated');
        set({ 
          accessToken, 
          refreshToken,
          isAuthenticated: true 
        });
      },
      
      setLoading: (isLoading) => {
        logger.store('📦 AuthStore: Loading state changed', { isLoading });
        set({ isLoading });
      },
      
      setError: (error) => {
        if (error) {
          logger.error('STORE', `❌ Auth error: ${error}`, { error });
        }
        set({ error });
      },
      
      setEmailVerified: (isEmailVerified) => set({ isEmailVerified }),
      
      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        
        const formData = new URLSearchParams();
        formData.append('email', email);
        formData.append('password', password);
        
        apiLogger.info('🔐 Attempting login...', { email });
        
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
          });

          apiLogger.logResponse(`${API_URL}/auth/login`, response, 0);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            apiLogger.error('❌ Login failed', {
              status: response.status,
              data: errorData
            });
            throw new Error(errorData.detail || 'Login failed');
          }

          const data = await response.json();
          
          apiLogger.logAuth('login', { userId: data.user?.id, email });
          
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            isEmailVerified: true,
            isLoading: false,
          });
        } catch (error) {
          apiLogger.error('❌ Login error', error);
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        apiLogger.logAuth('logout', { 
          userId: useAuthStore.getState().user?.id 
        });
        
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isEmailVerified: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),

      // Request password reset - sends OTP to user's email
      requestPasswordReset: async (email: string) => {
        set({ isLoading: true, error: null });
        
        apiLogger.info('📧 Requesting password reset...', { email });
        
        try {
          const response = await fetch(`${API_URL}/auth/password-reset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          });

          apiLogger.logResponse(`${API_URL}/auth/password-reset`, response, 0);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            apiLogger.error('❌ Password reset request failed', {
              status: response.status,
              data: errorData
            });
            throw new Error(errorData.detail || 'Failed to send reset code');
          }

          const data = await response.json();
          apiLogger.info('✅ Password reset code sent', { email });
          
          set({ isLoading: false });
          return data;
        } catch (error) {
          apiLogger.error('❌ Password reset request error', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to send reset code',
            isLoading: false,
          });
          throw error;
        }
      },

      // Verify OTP and set new password
      verifyPasswordReset: async (email: string, otp: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        
        apiLogger.info('🔐 Verifying password reset...', { email });
        
        try {
          const response = await fetch(`${API_URL}/auth/password-reset/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              otp,
              new_password: newPassword,
            }),
          });

          apiLogger.logResponse(`${API_URL}/auth/password-reset/verify`, response, 0);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            apiLogger.error('❌ Password reset verification failed', {
              status: response.status,
              data: errorData
            });
            throw new Error(errorData.detail || 'Invalid or expired code');
          }

          const data = await response.json();
          
          apiLogger.info('✅ Password reset complete', { email });
          
          set({
            user: data.user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            isEmailVerified: true,
            isLoading: false,
          });
          
          return data;
        } catch (error) {
          apiLogger.error('❌ Password reset verification error', error);
          set({
            error: error instanceof Error ? error.message : 'Invalid or expired code',
            isLoading: false,
          });
          throw error;
        }
      },
    }),
    {
      name: 'volantis-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isEmailVerified: state.isEmailVerified,
      }),
    }
  )
);

// Helper function to get auth headers
export const getAuthHeaders = (): HeadersInit => {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return useAuthStore.getState().isAuthenticated;
};
