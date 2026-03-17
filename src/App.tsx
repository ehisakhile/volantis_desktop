import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { StreamPage } from './pages/StreamPage';
import { RecordingsPage } from './pages/RecordingsPage';
import { RouterLogger } from './components/RouterLogger';
import { useEffect, useState } from 'react';

const API_URL = 'https://api-dev.volantislive.com';

// Silent auth check component - runs /auth/me in background
function AuthChecker({ children }: { children: React.ReactNode }) {
  const { accessToken, setUser, logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!accessToken) {
        setIsChecking(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else if (response.status === 401) {
          // Token invalid - logout
          logout();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Don't logout on network errors - keep existing session
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [accessToken, setUser, logout]);

  if (isChecking && accessToken) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0e14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: '2px solid rgba(56, 189, 248, 0.2)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
}

// Base route - StreamPage is the entry point
function BaseRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  
  // If no access token, show login
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Public route wrapper (redirect if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <RouterLogger>
      <AuthChecker>
        <Routes>
          {/* Base route - StreamPage as entry point */}
          <Route
            path="/"
            element={
              <BaseRoute>
                <StreamPage />
              </BaseRoute>
            }
          />
          
          {/* Recordings page */}
          <Route
            path="/recordings"
            element={
              <BaseRoute>
                <RecordingsPage />
              </BaseRoute>
            }
          />
          
          {/* Login page */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          
          {/* Forgot Password page */}
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />
          
          {/* Reset Password page */}
          <Route
            path="/forgot-password/reset"
            element={
              <PublicRoute>
                <ResetPasswordPage />
              </PublicRoute>
            }
          />
          
          {/* Legacy route - redirect to base */}
          <Route path="/stream" element={<Navigate to="/" replace />} />
          
          {/* Catch all - redirect to base */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthChecker>
    </RouterLogger>
  );
}

export default App;
