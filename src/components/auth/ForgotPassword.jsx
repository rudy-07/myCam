import React, { useState } from 'react';
import { Mail, ArrowRight, Shield, Lock, Sun, Moon } from 'lucide-react';
import { API_BASE } from '../../config';
import logoIcon from '../../assets/mycam_no_text.png';

const ForgotPassword = ({ onBack, onLoginClick }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mycam_theme', next); } catch (e) { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not send reset link.');
      }

      setSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || 'Error requesting reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" role="main">
      {/* Theme Toggle Button matching myCloud */}
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
              Account<br />
              <span className="grad">recovery.</span>
            </h2>
            <p>
              No need to worry. Resetting your password is quick and secure. You will be back in your surveillance console in no time.
            </p>
          </div>

          <div className="auth-feature-list" role="list">
            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--blue">
                <Mail size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Secure Email Link</strong>
                <span>Cryptographically signed token valid for 60 minutes</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--emerald">
                <Shield size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>One-Time Use</strong>
                <span>Link is permanently invalidated immediately after use</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--purple">
                <Lock size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Zero Footage Exposure</strong>
                <span>Your camera streams and storage drives remain untouched</span>
              </div>
            </div>
          </div>

          <div className="auth-float-cards">
            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--green"></div>
              <div>
                <div className="auth-float-card__label">Token Validity</div>
                <div className="auth-float-card__sub">60 Minutes Expiry</div>
              </div>
            </div>

            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--blue"></div>
              <div>
                <div className="auth-float-card__label">Encrypted Dispatch</div>
                <div className="auth-float-card__sub">Signed via SHA-256</div>
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
              <h3>Check your inbox</h3>
              <p>
                If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>, we have sent a reset link. The link expires in 60 minutes.
              </p>
              <button
                type="button"
                onClick={onLoginClick}
                className="auth-btn-ghost"
                style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <div id="forgot-form-wrapper" style={{ width: '100%' }}>
              <div className="auth-card__header">
                <span className="auth-card__badge">
                  <span className="auth-card__badge-dot"></span>
                  mySphere Account
                </span>
                <div className="sent-illustration" style={{ margin: '0.5rem 0', display: 'inline-flex', padding: '12px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--accent-blue)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <Lock size={26} />
                </div>
                <h1 className="auth-card__title">Forgot your password?</h1>
                <p className="auth-card__subtitle">
                  Enter the email associated with your account and we will send you a secure reset link.
                </p>
              </div>

              {errorMessage && (
                <div className="auth-message auth-message--error" style={{ marginBottom: '1.25rem' }}>
                  <Shield size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">Email Address</label>
                  <div className="input-wrapper">
                    <Mail size={17} />
                    <input
                      type="email"
                      className="auth-input"
                      id="forgot-email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="auth-btn-primary"
                  id="forgot-submit-btn"
                  disabled={loading}
                  aria-label="Send password reset link"
                  style={{ marginTop: '0.75rem' }}
                >
                  <span className="btn-text">
                    {loading ? 'Sending Instructions...' : 'Send Reset Link'}
                    {!loading && <ArrowRight size={16} />}
                  </span>
                </button>
              </form>

              <p className="auth-switch" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#7c8ba8' }}>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="auth-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-blue)' }}
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ForgotPassword;
