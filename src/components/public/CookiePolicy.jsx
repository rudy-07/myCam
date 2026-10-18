import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Settings } from 'lucide-react';
import { motion } from 'motion/react';

const SECTIONS = [
  { id: 'overview', label: 'Storage Philosophy' },
  { id: 'necessary', label: 'Strictly Necessary Keys' },
  { id: 'preferences', label: 'Functional Preferences' },
  { id: 'inventory', label: 'Storage Key Inventory' },
  { id: 'third-parties', label: 'Third-Party Non-Involvement' },
  { id: 'manage', label: 'Managing Preferences' },
];

const CookiePolicy = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const sectionIds = SECTIONS.map((s) => s.id);
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const offset = 140;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (scrollY >= top - offset) {
            setActiveSection(sectionIds[i]);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const openCookiePrefs = () => {
    window.dispatchEvent(new CustomEvent('open-cookie-preferences'));
  };

  return (
    <div className="public-page public-page--cookies">
      {/* Public Hero - Vertically Centered */}
      <section className="public-hero" aria-labelledby="cookies-title">
        <div className="container public-hero__inner">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.96 }}
            className="btn btn-ghost btn-sm"
            style={{
              marginBottom: '1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
            Back to Home
          </motion.button>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span className="badge public-hero__badge">
              <span className="badge-dot" aria-hidden="true"></span>
              Cookies &amp; Local Storage
            </span>
          </div>
          <h1 id="cookies-title">
            Transparent, <span className="text-gradient">minimal storage.</span>
          </h1>
          <p className="public-hero__lead">
            myCam avoids third-party advertising cookies entirely. This policy provides a comprehensive audit of all cookies and browser storage keys used to run your surveillance console.
          </p>
          <p className="public-hero__meta">Last updated October 15, 2026</p>
        </div>
      </section>

      {/* Content Section */}
      <section className="public-section">
        <div className="container legal-shell">
          {/* Table of Contents with Live ScrollSpy */}
          <aside className="legal-toc">
            <div className="legal-toc__title" style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} />
              On this page
            </div>
            <nav className="legal-toc__links" style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.825rem' }}>
              {SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={(e) => scrollToSection(e, sec.id)}
                    className={isActive ? 'is-active' : ''}
                    style={{ textDecoration: 'none' }}
                  >
                    {sec.label}
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Legal Prose Content with Proper Light Mode Colors */}
          <article className="legal-prose" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
            <div className="legal-intro">
              <strong style={{ color: 'var(--accent-blue)', display: 'block', marginBottom: '4px' }}>Plain-language summary:</strong>
              We do not track your internet browsing, and we do not serve behavioral ads. Storage in your browser is strictly used to keep you signed in, remember your camera view layout, and retain your dark/light theme choice.
            </div>

            <section id="overview" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Storage Philosophy</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Modern web applications utilize both HTTP cookies and HTML5 Web Storage (localStorage and sessionStorage). myCam adheres to a zero-surveillance design standard: storage keys are reserved strictly for critical operational state.
              </p>
            </section>

            <section id="necessary" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Strictly Necessary Storage</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Strictly necessary storage items are essential for security and platform operation. Without these items, the platform cannot maintain an authenticated session or connect to camera streams:
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: 'var(--text-primary)' }}>Session Token:</strong> Stores the signed bearer token validating API requests.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>User Profile Context:</strong> Caches operator username, role, and avatar reference for responsive UI rendering.</li>
              </ul>
            </section>

            <section id="preferences" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Functional Preferences</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Functional preferences remember your custom interface settings so you do not have to reconfigure them every time you open the dashboard:
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: 'var(--text-primary)' }}>Theme Mode:</strong> Retains dark mode or light mode appearance.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Sidebar Rail State:</strong> Remembers whether you collapsed or expanded the navigation bar.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Cookie Consent State:</strong> Records your choices made in the consent banner.</li>
              </ul>
            </section>

            <section id="inventory" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Storage Key Inventory</h2>
              <div style={{ overflowX: 'auto', marginTop: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>Key Name</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>Mechanism</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>Purpose</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>mycam_user</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>localStorage</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Operator profile &amp; active session</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge badge-accent">Necessary</span></td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>mycam_token</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>localStorage</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>API Bearer authorization token</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge badge-accent">Necessary</span></td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>mycam_cookie_consent</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>localStorage</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Banner acceptance status</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge badge-neutral">Preferences</span></td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>mycam_theme</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>localStorage</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Dark/Light theme choice</td>
                      <td style={{ padding: '12px 16px' }}><span className="badge badge-neutral">Preferences</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="third-parties" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Third-Party Non-Involvement</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                myCam does not allow third-party ad networks, social media widgets, or marketing trackers to drop cookies on your device. When connecting peer-to-peer over WebRTC, only direct socket signaling and media channels are used.
              </p>
            </section>

            <section id="manage" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Managing Preferences</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                You can review or adjust your preferences at any time by clicking the button below or by clearing your browser's site data in Developer Tools:
              </p>
              <motion.button
                type="button"
                onClick={openCookiePrefs}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="cookie-settings-launch-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s ease, filter 0.2s ease',
                }}
              >
                <Settings size={15} />
                <span>Open Cookie Settings</span>
              </motion.button>
            </section>
          </article>
        </div>
      </section>
    </div>
  );
};

export default CookiePolicy;
