import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user, error: authError, clearError, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      await login({ email, password });
      if (user?.company_id) {
        navigate('/stream');
      } else {
        navigate('/dashboard');
      }
    } catch {
      // Error handled by auth store
    }
  };

  const displayError = localError || (authError ? authError : '');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0d1117 0%, #111827 50%, #0d1117 100%)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"DM Sans", "SF Pro Display", system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Titlebar drag region */}
      <div
        data-tauri-drag-region
        style={{
          height: 32,
          background: 'linear-gradient(180deg, #1a2030 0%, #151c2c 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'default',
        }}
      >
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', fontWeight: 500 }}>
          VOLANTISLIVE
        </span>
      </div>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Logo mark */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                width: 48,
                height: 48,
                margin: '0 auto 12px',
                background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 1px rgba(56,189,248,0.3), 0 8px 24px rgba(14,165,233,0.25)',
              }}
            >
              <span style={{ color: 'white', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>V</span>
            </div>
            <h1
              style={{
                color: 'rgba(255,255,255,0.92)',
                fontSize: 20,
                fontWeight: 700,
                margin: '0 0 4px',
                letterSpacing: '-0.02em',
              }}
            >
              Sign in
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
              Continue to your workspace
            </p>
          </div>

          {/* Card */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '24px 24px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4), 0 16px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            {/* Error */}
            {displayError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8,
                  marginBottom: 18,
                }}
              >
                <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>{displayError}</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email field */}
              <div>
                <label
                  htmlFor="email"
                  style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.03em' }}
                >
                  EMAIL
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    style={{
                      position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                      width: 15, height: 15, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    style={{
                      width: '100%',
                      paddingLeft: 34,
                      paddingRight: 12,
                      paddingTop: 9,
                      paddingBottom: 9,
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: 'rgba(255,255,255,0.88)',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(56,189,248,0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label
                    htmlFor="password"
                    style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.03em' }}
                  >
                    PASSWORD
                  </label>
                  <a
                    href="#"
                    style={{ fontSize: 11.5, color: 'rgba(56,189,248,0.7)', textDecoration: 'none' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(56,189,248,0.7)')}
                  >
                    Forgot password?
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    style={{
                      position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                      width: 15, height: 15, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      paddingLeft: 34,
                      paddingRight: 36,
                      paddingTop: 9,
                      paddingBottom: 9,
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: 'rgba(255,255,255,0.88)',
                      fontSize: 13.5,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(56,189,248,0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                  >
                    {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: -2 }}
              >
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1px solid ${rememberMe ? '#38bdf8' : 'rgba(255,255,255,0.2)'}`,
                    background: rememberMe ? 'rgba(56,189,248,0.2)' : 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                  }}
                >
                  {rememberMe && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>Remember me</span>
              </label>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit as any}
              disabled={isLoading}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '10px 16px',
                background: isLoading
                  ? 'rgba(14,165,233,0.4)'
                  : 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 50%, #0284c7 100%)',
                border: '1px solid rgba(56,189,248,0.4)',
                borderRadius: 8,
                color: 'white',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow: isLoading ? 'none' : '0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(14,165,233,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.15s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 1px 2px rgba(0,0,0,0.4), 0 6px 20px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.2)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(14,165,233,0.2), inset 0 1px 0 rgba(255,255,255,0.15)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              {isLoading ? (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid rgba(255,255,255,0.25)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              ) : (
                <>
                  <LogIn style={{ width: 15, height: 15 }} />
                  Sign in
                </>
              )}
            </button>
          </div>

          {/* Footer link */}
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: 'rgba(255,255,255,0.25)' }}>
            Don't have an account?{' '}
            <a
              href="https://volantislive.com/signup"
              style={{ color: 'rgba(56,189,248,0.7)', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(56,189,248,0.7)')}
            >
              Request access
            </a>
          </p>
        </div>
      </main>

      {/* Bottom status bar */}
      <div
        style={{
          height: 24,
          background: 'linear-gradient(180deg, #151c2c 0%, #111827 100%)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>CONNECTED</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.05em' }}>
          v1.0.0
        </span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.18); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}