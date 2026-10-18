import React, { useState } from 'react';
import { Shield, Lock, Radio, Activity, CheckCircle2, Eye, EyeOff, ArrowRight, ArrowLeft, Sun, Moon } from 'lucide-react';
import { API_BASE } from '../../config';
import logoIcon from '../../assets/mycam_no_text.png';

const Login = ({
  onLoginSuccess,
  onBack,
  onRegisterClick,
  onForgotClick,
  notice = '',
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mycam_theme', next); } catch (e) { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter your username and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials.');
      }

      // Store token if provided
      if (data.token) {
        localStorage.setItem('mycam_token', data.token);
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setErrorMessage(err.message || 'Sign in failed. Please check your credentials.');
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
          {/* Logo */}
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

          {/* Headline */}
          <div className="auth-left__headline">
            <h2>
              Your cameras.<br />
              <span className="grad">Your privacy.</span>
            </h2>
            <p>
              Access your real-time video surveillance console. Low-latency WebRTC streams, smart polygon zones, and self-hosted storage built for absolute data sovereignty.
            </p>
          </div>

          {/* Feature List */}
          <div className="auth-feature-list" role="list">
            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--blue">
                <Lock size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Encrypted In Transit</strong>
                <span>DTLS-SRTP and TLS protection</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--purple">
                <Radio size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Zero Cloud Relay Lag</strong>
                <span>Direct peer-to-peer browser streams</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--emerald">
                <Shield size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Self-Hosted Storage</strong>
                <span>100% footage retention on your own hardware</span>
              </div>
            </div>
          </div>

          {/* Floating Status Cards */}
          <div className="auth-float-cards">
            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--green"></div>
              <div>
                <div className="auth-float-card__label">Camera Grid Online</div>
                <div className="auth-float-card__sub">4 Feeds Streaming</div>
              </div>
            </div>

            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--blue"></div>
              <div>
                <div className="auth-float-card__label">Data Sovereignty</div>
                <div className="auth-float-card__sub">100% User Owned</div>
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

          {/* Header */}
          <div className="auth-card__header">
            <span className="auth-card__badge">
              <span className="auth-card__badge-dot"></span>
              mySphere Account
            </span>
            <h1 className="auth-card__title">Welcome back</h1>
            <p className="auth-card__subtitle">Sign in to continue to your surveillance console.</p>
          </div>

          {/* Notice Banner */}
          {notice && (
            <div className="auth-message auth-message--success" style={{ marginBottom: '1rem' }}>
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="auth-message auth-message--error" style={{ marginBottom: '1rem' }}>
              <Shield size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Username / Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-username">Username or Email</label>
              <div className="input-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  className="auth-input"
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your@email.com or username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-wrapper">
                <Lock size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <div className="input-trailing">
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

            {/* Remember Me and Forgot Password */}
            <div className="auth-form-footer">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Keep me signed in
              </label>
              <button
                type="button"
                onClick={onForgotClick}
                className="auth-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
              aria-label="Sign In to myCam"
            >
              <span className="btn-text">
                {loading ? 'Authenticating...' : 'Sign In'}
                {!loading && <ArrowRight size={16} />}
              </span>
            </button>
          </form>

          {/* Switch to Register */}
          <div className="auth-switch" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#7c8ba8' }}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onRegisterClick}
              className="auth-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-blue)' }}
            >
              Create one now
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
