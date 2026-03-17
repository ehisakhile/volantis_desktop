import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { requestPasswordReset, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email) {
      setLocalError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    try {
      await requestPasswordReset(email);
      setSuccess(true);
      
      // Store email in sessionStorage for the reset page
      sessionStorage.setItem('reset_email', email);
      
      // Redirect to reset page after a brief delay
      setTimeout(() => {
        navigate('/forgot-password/reset');
      }, 2000);
    } catch {
      // Error handled by store
    }
  };

  const displayError = localError || (error ? error : '');

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

          {/* Back link */}
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              fontSize: 13,
              marginBottom: 20,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to login
          </Link>

          {/* Logo mark */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 48,
                height: 48,
                margin: '0 auto 12px',
                background: 'white',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 1px rgba(56,189,248,0.3), 0 8px 24px rgba(14,165,233,0.25)',
              }}
            >
              <img src="/logo.png" alt="Volantis" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
              {success ? 'Check your email' : 'Forgot password?'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
              {success 
                ? 'We sent a password reset code to your email'
                : 'Enter your email and we will send you a code to reset your password'
              }
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

            {/* Success */}
            {success && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 8,
                  marginBottom: 18,
                }}
              >
                <CheckCircle style={{ width: 15, height: 15, color: '#4ade80', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12.5, color: '#86efac', margin: 0, lineHeight: 1.5 }}>
                  Password reset code sent! Redirecting you to enter the code...
                </p>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit}>
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
                        disabled={isLoading}
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
                          opacity: isLoading ? 0.6 : 1,
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
                </div>

                {/* Submit */}
                <button
                  type="submit"
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
                    'Send Reset Code'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer link */}
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12.5, color: 'rgba(255,255,255,0.25)' }}>
            Remember your password?{' '}
            <Link
              to="/login"
              style={{ color: 'rgba(56,189,248,0.7)', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(56,189,248,0.7)')}
            >
              Sign in
            </Link>
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
