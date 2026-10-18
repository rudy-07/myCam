import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Eye, EyeOff, Shield, Sun, Moon } from 'lucide-react';
import { API_BASE } from '../../config';
import logoIcon from '../../assets/mycam_no_text.png';

const calculateRequirements = (password, confirmPassword) => {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirmPassword,
  };
};

const calculateScore = (reqs) => {
  let count = 0;
  if (reqs.length) count++;
  if (reqs.upper) count++;
  if (reqs.lower) count++;
  if (reqs.number) count++;
  if (reqs.special) count++;
  return count;
};

const ResetPassword = ({ onBack, onLoginClick }) => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const reqs = calculateRequirements(password, confirmPassword);
  const score = calculateScore(reqs);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) setToken(urlToken);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mycam_theme', next); } catch (e) { /* ignore */ }
  };

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
    let pw = 'Aa1!';
    for (let i = 4; i < 16; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    pw = pw.split('').sort(() => Math.random() - 0.5).join('');
    setPassword(pw);
    setConfirmPassword(pw);
    setShowPassword(true);
    setShowConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setErrorMessage('Missing password reset security token.');
      return;
    }
    if (score < 5) {
      setErrorMessage('Please ensure your password meets all security requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed.');
      }

      setSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" role="main">
      {/* Theme Toggle Button */}
      <button
        type="button"
        className="auth-theme-btn"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title="Toggle dark/light theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* ═══════════════════════════════════════════
           LEFT - Illustration & Product Messaging
           ═══════════════════════════════════════════ */}
      <aside className="auth-left" aria-hidden="true">
        <div className="auth-bg">
          <div className="auth-bg__mesh"></div>
          <div className="auth-bg__grid"></div>
          <div className="auth-bg__orb auth-bg__orb--1"></div>
          <div className="auth-bg__orb auth-bg__orb--2"></div>
          <div className="auth-bg__orb auth-bg__orb--3"></div>
        </div>

        <div className="auth-left__content">
          <button
            type="button"
            onClick={onBack}
            className="auth-left__logo"
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '14px' }}
          >
            <div style={{ position: 'relative', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
              <img src={logoIcon} alt="myCam" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
            </div>
            <span className="auth-left__logo-text">
              my<span>Cam</span>
            </span>
          </button>

          <div className="auth-left__headline">
            <h2>
              New password.<br />
              <span className="grad">Fresh start.</span>
            </h2>
            <p>
              Create a strong, unique password to secure your personal surveillance network. We recommend at least 8 characters with letters, numbers, and symbols.
            </p>
          </div>

          <div className="auth-feature-list" role="list">
            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--blue">
                <Shield size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Use a unique password</strong>
                <span>Do not reuse passwords across external platforms</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--purple">
                <Lock size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Cryptographic Protection</strong>
                <span>Key derivation using salted scrypt with bounded memory</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--emerald">
                <Shield size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Meet all requirements</strong>
                <span>All security checklist items must turn green</span>
              </div>
            </div>
          </div>

          <div className="auth-float-cards">
            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--green"></div>
              <div>
                <div className="auth-float-card__label">Storage Safety</div>
                <div className="auth-float-card__sub">Footage Completely Intact</div>
              </div>
            </div>

            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--purple"></div>
              <div>
                <div className="auth-float-card__label">Session Invalidation</div>
                <div className="auth-float-card__sub">Stale Tokens Revoked</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
           RIGHT - Auth Form
           ═══════════════════════════════════════════ */}
      <section className="auth-right">
        <div className="auth-card" id="auth-card">
          {/* Mobile Logo */}
          <div className="auth-card__mobile-logo" aria-hidden="true">
            <img src={logoIcon} alt="myCam" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <span className="auth-card__mobile-logo-text">my<span>Cam</span></span>
          </div>

          {submitted ? (
            <div className="auth-success-screen visible" role="status" aria-live="polite">
              <div className="success-ring">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3>Password reset successfully</h3>
              <p>
                Your password has been updated. You can now sign in to your surveillance console with your new credentials.
              </p>
              <button
                type="button"
                onClick={onLoginClick}
                className="auth-btn-primary"
                style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
              >
                <span className="btn-text">
                  Sign In to myCam
                  <ArrowRight size={16} />
                </span>
              </button>
            </div>
          ) : (
            <div id="reset-form-wrapper" style={{ width: '100%' }}>
              <div className="auth-card__header">
                <span className="auth-card__badge">
                  <span className="auth-card__badge-dot"></span>
                  mySphere Account
                </span>
                <h1 className="auth-card__title">Set new password</h1>
                <p className="auth-card__subtitle">Choose a strong password you haven't used before.</p>
              </div>

              {errorMessage && (
                <div className="auth-message auth-message--error" style={{ marginBottom: '1.25rem' }}>
                  <Shield size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {/* Security Token (only if missing in URL) */}
                {!token && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-token">Security Token</label>
                    <div className="input-wrapper">
                      <Lock size={17} />
                      <input
                        type="text"
                        className="auth-input"
                        id="reset-token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste reset token from email"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* New Password */}
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-password">New Password</label>
                  <div className="input-wrapper">
                    <Lock size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input"
                      id="reset-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
                      autoComplete="new-password"
                    />
                    <div className="input-trailing">
                      <button
                        type="button"
                        className="input-btn"
                        id="suggest-password-btn"
                        onClick={generateStrongPassword}
                        aria-label="Generate strong password"
                        title="Generate strong password"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="input-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-confirm">Confirm Password</label>
                  <div className="input-wrapper">
                    <Lock size={17} />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="auth-input"
                      id="reset-confirm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      required
                      autoComplete="new-password"
                    />
                    <div className="input-trailing">
                      <button
                        type="button"
                        className="input-btn"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Requirements Checklist matching myCloud */}
                <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Password Requirements
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: reqs.length ? '#10b981' : 'var(--text-muted)' }}>
                      <span>{reqs.length ? '✓' : '○'}</span> 8+ characters
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: reqs.upper ? '#10b981' : 'var(--text-muted)' }}>
                      <span>{reqs.upper ? '✓' : '○'}</span> Uppercase letter
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: reqs.lower ? '#10b981' : 'var(--text-muted)' }}>
                      <span>{reqs.lower ? '✓' : '○'}</span> Lowercase letter
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: reqs.number ? '#10b981' : 'var(--text-muted)' }}>
                      <span>{reqs.number ? '✓' : '○'}</span> Number (0-9)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: reqs.special ? '#10b981' : 'var(--text-muted)' }}>
                      <span>{reqs.special ? '✓' : '○'}</span> Special character
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: reqs.match ? '#10b981' : 'var(--text-muted)' }}>
                      <span>{reqs.match ? '✓' : '○'}</span> Passwords match
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="auth-btn-primary"
                  disabled={loading || score < 5 || !reqs.match}
                  aria-label="Update password"
                >
                  <span className="btn-text">
                    {loading ? 'Updating Password...' : 'Update Password'}
                    {!loading && <ArrowRight size={16} />}
                  </span>
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ResetPassword;
