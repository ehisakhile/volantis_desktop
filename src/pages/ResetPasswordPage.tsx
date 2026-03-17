import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Keyboard, ArrowLeft } from 'lucide-react';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { verifyPasswordReset, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    // Get email from sessionStorage
    const storedEmail = sessionStorage.getItem('reset_email');
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // If no email stored, redirect back to forgot password
      navigate('/forgot-password');
    }
  }, [navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendCode = async () => {
    // For now, just show an alert - we would need to add requestPasswordReset to the store
    // or use a different approach
    alert('Please go back and request a new code');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!otp) {
      setLocalError('Please enter the verification code');
      return;
    }

    if (!newPassword) {
      setLocalError('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      await verifyPasswordReset(email, otp, newPassword);
      setSuccess(true);
      
      // Clear session storage
      sessionStorage.removeItem('reset_email');
      
      // Redirect after a brief delay
      setTimeout(() => {
        navigate('/stream');
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
            to="/forgot-password"
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
            Back
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
              {success ? 'Password reset!' : 'Enter verification code'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
              {success 
                ? 'Your password has been reset successfully'
                : `We sent a code to ${email}. Enter the code and create a new password.`
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
                  Password reset successful! Redirecting you to the dashboard...
                </p>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Email field (read-only) */}
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
                        readOnly
                        disabled
                        style={{
                          width: '100%',
                          paddingLeft: 34,
                          paddingRight: 12,
                          paddingTop: 9,
                          paddingBottom: 9,
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: 13.5,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* OTP field */}
                  <div>
                    <label
                      htmlFor="otp"
                      style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.03em' }}
                    >
                      VERIFICATION CODE
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Keyboard
                        style={{
                          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                          width: 15, height: 15, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        id="otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        required
                        maxLength={6}
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
                    <div style={{ marginTop: 6, textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={countdown > 0 || isLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: countdown > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(56,189,248,0.7)',
                          fontSize: 11.5,
                          cursor: countdown > 0 || isLoading ? 'default' : 'pointer',
                          textDecoration: countdown > 0 ? 'none' : 'underline',
                          padding: 0,
                        }}
                      >
                        {countdown > 0 
                          ? `Resend code in ${countdown}s` 
                          : 'Resend code'
                        }
                      </button>
                    </div>
                  </div>

                  {/* New Password field */}
                  <div>
                    <label
                      htmlFor="newPassword"
                      style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.03em' }}
                    >
                      NEW PASSWORD
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock
                        style={{
                          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                          width: 15, height: 15, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
                        }}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={6}
                        disabled={isLoading}
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
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: isLoading ? 'default' : 'pointer', padding: 2,
                          color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => !isLoading && (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                      >
                        {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password field */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.03em' }}
                    >
                      CONFIRM PASSWORD
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock
                        style={{
                          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                          width: 15, height: 15, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
                        }}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        minLength={6}
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
                    'Reset Password'
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
