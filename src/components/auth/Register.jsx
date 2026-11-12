import React, { useState } from 'react';
import { Shield, Lock, User, Mail, Radio, ArrowRight, Eye, EyeOff, CheckCircle2, Sun, Moon } from 'lucide-react';
import { API_BASE } from '../../config';
import { generateStrongPassword as createSecurePassword, postAuthJson, validateRegistration } from '../../lib/authRequest';
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

const calculateStrength = (pass) => {
  if (!pass) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#f59e0b' };
  if (score === 3) return { score: 3, label: 'Good', color: '#3b82f6' };
  return { score: 4, label: 'Strong', color: '#10b981' };
};

const Register = ({
  onRegisterSuccess,
  onBack,
  onLoginClick,
  onTermsClick,
  onPrivacyClick,
}) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  const strength = calculateStrength(password);
  const reqs = calculateRequirements(password, confirmPassword);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('mycam_theme', next); } catch { /* ignore */ }
  };

  const generateStrongPassword = () => {
    const pw = createSecurePassword(16);
    setPassword(pw);
    setConfirmPassword(pw);
    setShowPassword(true);
    setShowConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setErrorMessage('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    const validationError = validateRegistration({ name: name.trim(), username: username.trim(), email: email.trim(), password });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await postAuthJson(`${API_BASE}/api/register`, {
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });

      onRegisterSuccess();
    } catch (err) {
      setErrorMessage(err.message || 'Could not complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" role="main">
      {/* Theme Toggle matching myCloud */}
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
              Zero lag.<br />
              <span className="grad">Total ownership.</span>
            </h2>
            <p>
              Set up your self-hosted surveillance network. Stream HD feeds, calibrate smart trigger boundaries, and retain your recordings with cryptographic security.
            </p>
          </div>

          <div className="auth-feature-list" role="list">
            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--blue">
                <Lock size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>End-to-End Encrypted</strong>
                <span>Direct WebRTC DTLS-SRTP media encryption</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--purple">
                <Radio size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>Any Camera Device</strong>
                <span>RTSP, USB webcam, or any smartphone</span>
              </div>
            </div>

            <div className="auth-feature-item" role="listitem">
              <div className="auth-feature-icon auth-feature-icon--emerald">
                <Shield size={18} />
              </div>
              <div className="auth-feature-text">
                <strong>No Cloud Subscription Lock-In</strong>
                <span>Store everything on your own hardware</span>
              </div>
            </div>
          </div>

          {/* Floating Status Cards matching myCloud */}
          <div className="auth-float-cards">
            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--green"></div>
              <div>
                <div className="auth-float-card__label">Peer-to-Peer Streams</div>
                <div className="auth-float-card__sub">Sub-millisecond local latency</div>
              </div>
            </div>

            <div className="auth-float-card">
              <div className="auth-float-card__dot auth-float-card__dot--purple"></div>
              <div>
                <div className="auth-float-card__label">Direct Ownership</div>
                <div className="auth-float-card__sub">Zero third-party relay</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
           RIGHT - Registration Form
           ═══════════════════════════════════════════ */}
      <section className="auth-right">
        <div className="auth-card" id="auth-card">
          {/* Mobile Logo */}
          <div className="auth-card__mobile-logo" aria-hidden="true">
            <img src={logoIcon} alt="myCam" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <span className="auth-card__mobile-logo-text">my<span>Cam</span></span>
          </div>

          <div className="auth-card__header">
            <span className="auth-card__badge">
              <span className="auth-card__badge-dot"></span>
              mySphere Account
            </span>
            <h1 className="auth-card__title">Create your account</h1>
            <p className="auth-card__subtitle">Join myCam and own your surveillance data.</p>
          </div>

          {errorMessage && (
            <div className="auth-message auth-message--error" style={{ marginBottom: '1rem' }}>
              <Shield size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Name Row: Full Name & Username */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <div className="input-wrapper">
                  <User size={17} />
                  <input
                    type="text"
                    className="auth-input"
                    id="reg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">Username</label>
                <div className="input-wrapper">
                  <User size={17} />
                  <input
                    type="text"
                    className="auth-input"
                    id="reg-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johncam"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email Address</label>
              <div className="input-wrapper">
                <Mail size={17} />
                <input
                  type="email"
                  className="auth-input"
                  id="reg-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <div className="input-wrapper">
                <Lock size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  id="reg-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
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

              {/* Strength Meter */}
              {password && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                    <span style={{ color: '#7c8ba8' }}>Password Strength</span>
                    <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        style={{
                          flex: 1,
                          height: '100%',
                          borderRadius: '2px',
                          backgroundColor: level <= strength.score ? strength.color : 'rgba(255, 255, 255, 0.08)',
                          transition: 'background-color 0.2s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Password Requirements Checklist */}
              <ul className={`password-checklist ${password ? 'visible' : ''}`} role="list" aria-label="Password requirements">
                <li className={reqs.length ? 'valid' : ''}>At least 8 characters</li>
                <li className={reqs.upper ? 'valid' : ''}>One uppercase letter</li>
                <li className={reqs.lower ? 'valid' : ''}>One lowercase letter</li>
                <li className={reqs.number ? 'valid' : ''}>One number</li>
                <li className={reqs.special ? 'valid' : ''}>One special character</li>
              </ul>
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={17} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="auth-input"
                  id="reg-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
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
              {confirmPassword && (
                <div style={{ fontSize: '0.75rem', marginTop: '4px', color: reqs.match ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {reqs.match ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}
            </div>

            {/* Terms and Privacy Agreement */}
            <label className="auth-terms" style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="checkbox"
                id="reg-terms-checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                required
              />
              <span>
                I agree to the{' '}
                <button
                  type="button"
                  onClick={onTermsClick}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={onPrivacyClick}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  Privacy Policy
                </button>
                .
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
              aria-label="Create myCam account"
            >
              <span className="btn-text">
                {loading ? 'Creating Account...' : 'Create My Account'}
                {!loading && <ArrowRight size={16} />}
              </span>
            </button>
          </form>

          <div className="auth-switch" style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#7c8ba8' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onLoginClick}
              className="auth-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-blue)' }}
            >
              Sign in
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Register;
