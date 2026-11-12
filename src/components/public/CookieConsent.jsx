import React, { useState, useEffect } from 'react';
import { Shield, Settings, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'mycam_cookie_consent';

const CookieConsent = () => {
  const [consent, setConsent] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [prefs, setPrefs] = useState({
    necessary: true,
    preferences: true,
    analytics: false,
  });

  useEffect(() => {
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 600);
      return () => clearTimeout(timer);
    }
  }, [consent]);

  // Listen to open-cookie-preferences event from footer
  useEffect(() => {
    const handleOpen = () => setShowModal(true);
    window.addEventListener('open-cookie-preferences', handleOpen);
    return () => window.removeEventListener('open-cookie-preferences', handleOpen);
  }, []);

  const saveConsent = (preferences) => {
    const payload = {
      ...preferences,
      necessary: true,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage error
    }
    setConsent(payload);
    setShowBanner(false);
    setShowModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, preferences: true, analytics: true });
  };

  const handleNecessaryOnly = () => {
    saveConsent({ necessary: true, preferences: false, analytics: false });
  };

  const handleSaveCustom = () => {
    saveConsent(prefs);
  };

  return (
    <>
      {/* Floating Cookie Banner with Animated Entry & Exit */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            id="cookie-consent-banner"
            className="cookie-banner is-visible"
            role="region"
            aria-label="Cookie and storage settings"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="cookie-banner__inner">
              <div className="cookie-banner__header">
                <div className="cookie-banner__heading-group">
                  <Shield className="cookie-banner__heading-icon" size={16} />
                  <span className="cookie-banner__heading">Cookie &amp; Privacy Preferences</span>
                </div>
                <button
                  type="button"
                  onClick={handleNecessaryOnly}
                  className="cookie-banner__close"
                  aria-label="Dismiss cookie notice and keep necessary only"
                  title="Accept necessary only"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="cookie-banner__content">
                <p className="cookie-banner__text">
                  We use strictly necessary cookies to keep you securely signed in and protect against cross-site forgery. With your consent, we also use browser local storage to remember your display preferences (such as dark or light theme). We never use third-party advertising or cross-site tracking cookies.
                </p>
              </div>

              <div className="cookie-banner__footer">
                <div className="cookie-banner__links">
                  <a href="/cookies" className="cookie-banner__link">Cookie Policy</a>
                  <span className="cookie-banner__sep" aria-hidden="true">&bull;</span>
                  <a href="/privacy" className="cookie-banner__link">Privacy Policy</a>
                </div>

                <div className="cookie-banner__actions">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="cookie-btn cookie-btn--settings"
                  >
                    Preferences
                  </button>
                  <button
                    type="button"
                    onClick={handleNecessaryOnly}
                    className="cookie-btn cookie-btn--reject"
                  >
                    Reject optional
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="cookie-btn cookie-btn--accept"
                  >
                    Accept all
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preferences Modal Backdrop with Animated Fade */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            id="cookie-modal-backdrop"
            className="cookie-modal-backdrop is-visible"
            onClick={() => setShowModal(false)}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Preferences Modal Dialog with Animated Spring Pop */}
      <AnimatePresence>
        {showModal && (
          <div
            id="cookie-preferences-modal"
            className="cookie-modal is-visible"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-modal-title"
          >
            <motion.div
              className="cookie-modal__shell"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            >
          <div className="cookie-modal__header">
            <div className="cookie-modal__title-wrap">
              <div className="cookie-modal__kicker">
                <Shield size={13} className="cookie-modal__kicker-icon" />
                <span>Privacy &amp; Storage Controls</span>
              </div>
              <h2 id="cookie-modal-title" className="cookie-modal__title">
                Cookie &amp; Storage Preferences
              </h2>
              <p className="cookie-modal__subtitle">
                Choose which storage technologies you authorize myCam to use. Strictly necessary technologies cannot be disabled as they are required to operate surveillance feeds securely.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="cookie-modal__close-btn"
              aria-label="Close preferences dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="cookie-modal__body">
            {/* Category 1: Strictly Necessary */}
            <div className="cookie-cat-card">
              <div className="cookie-cat-card__header">
                <div className="cookie-cat-card__info">
                  <div className="cookie-cat-card__title-row">
                    <h3 className="cookie-cat-card__name">Strictly Necessary Technologies</h3>
                    <span className="cookie-badge cookie-badge--always">Always Active</span>
                  </div>
                  <p className="cookie-cat-card__desc">
                    Essential for session JWT verification, WebRTC peer connection handshakes, CSRF attack defense, and storing your consent choices.
                  </p>
                </div>
              </div>
              <div className="cookie-cat-card__tech">
                Technologies: <code>auth_token</code> (session), <code>mycam_cookie_consent</code> (consent record), <code>csrf_token</code>, WebRTC Signaling Socket.
              </div>
            </div>

            {/* Category 2: Preferences & Customization */}
            <div className="cookie-cat-card">
              <div className="cookie-cat-card__header">
                <div className="cookie-cat-card__info">
                  <div className="cookie-cat-card__title-row">
                    <h3 className="cookie-cat-card__name">Preferences &amp; Customization</h3>
                    <span className="cookie-badge cookie-badge--optional">Optional</span>
                  </div>
                  <p className="cookie-cat-card__desc">
                    Allows myCam to store your camera view arrangements (1 feed, 2 feeds, 3 feeds), dark/light theme, and mute settings in browser local storage.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="consent-pref-toggle"
                    checked={prefs.preferences}
                    onChange={(e) => setPrefs({ ...prefs, preferences: e.target.checked })}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent-blue)',
                    }}
                  />
                </div>
              </div>
              <div className="cookie-cat-card__tech">
                Technologies: <code>data-theme</code>, <code>mycam_grid_mode</code>, <code>audio_volume</code>.
              </div>
            </div>

            {/* Category 3: Analytics & Diagnostics */}
            <div className="cookie-cat-card">
              <div className="cookie-cat-card__header">
                <div className="cookie-cat-card__info">
                  <div className="cookie-cat-card__title-row">
                    <h3 className="cookie-cat-card__name">Analytics &amp; Performance</h3>
                    <span className="cookie-badge cookie-badge--optional">Optional</span>
                  </div>
                  <p className="cookie-cat-card__desc">
                    myCam does not profile devices or use third-party marketing trackers (no Meta Pixel or Google Analytics). Enabling this category allows anonymous WebRTC streaming telemetry diagnostics.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    id="consent-ana-toggle"
                    checked={prefs.analytics}
                    onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent-blue)',
                    }}
                  />
                </div>
              </div>
              <div className="cookie-cat-card__tech">
                Technologies: Internal peer connection bandwidth and frame drop diagnostics only.
              </div>
            </div>
          </div>

          <div
            className="cookie-modal__footer"
            style={{
              padding: '1.25rem 1.75rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div>
              <a href="/cookies" className="cookie-banner__link" style={{ fontSize: '0.8rem' }}>
                Read Full Cookie Policy &rarr;
              </a>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleNecessaryOnly}
                className="cookie-btn cookie-btn--reject"
              >
                Reject optional
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="cookie-btn cookie-btn--accept"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                className="cookie-btn cookie-btn--save"
              >
                Save preferences
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
</>
);
};

export default CookieConsent;
