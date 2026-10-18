import React, { useState, useEffect } from 'react';
import { ChevronDown, Sun, Moon } from 'lucide-react';
import logoIcon from '../../assets/mycam_no_text.png';

const PublicNavbar = ({
  activePage = 'landing',
  onNavigate,
  onLoginClick,
  onRegisterClick,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const handleNavClick = (target, isHash = false) => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    if (isHash) {
      if (activePage !== 'landing') {
        onNavigate('landing');
        setTimeout(() => {
          const el = document.querySelector(target);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        const el = document.querySelector(target);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      onNavigate(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <header
        id="main-nav"
        className={`nav ${scrolled ? 'scrolled' : ''}`}
        role="banner"
      >
        <div className="nav__inner">
          {/* Logo & Brand matching myCloud */}
          <button
            type="button"
            onClick={() => handleNavClick('landing')}
            className="nav__logo"
            aria-label="myCam by mySphere"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <img
              src={logoIcon}
              alt="myCam logo"
              className="nav__logo-img"
              width="44"
              height="44"
            />
            <span className="nav__logo-text">
              my<span>Cam</span>
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="nav__links" aria-label="Main navigation">
            <button
              type="button"
              onClick={() => handleNavClick('#features', true)}
              className="nav__link"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('#preview', true)}
              className="nav__link"
            >
              Console
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('#how-it-works', true)}
              className="nav__link"
            >
              Workflow
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('#security', true)}
              className="nav__link"
            >
              Security
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('#pricing', true)}
              className="nav__link nav__link--badge"
            >
              Pricing <span className="coming-soon-pill">Soon</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('contact')}
              className={`nav__link ${activePage === 'contact' ? 'active' : ''}`}
            >
              Contact
            </button>

            {/* Legal Dropdown */}
            <div
              className={`nav__dropdown ${dropdownOpen ? 'show' : ''}`}
              onMouseEnter={() => setDropdownOpen(true)}
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <button
                type="button"
                className={`nav__link nav__dropdown-btn ${['privacy', 'terms', 'cookies'].includes(activePage) ? 'active' : ''}`}
                aria-expanded={dropdownOpen}
              >
                Legal <ChevronDown size={12} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <div className="nav__dropdown-content">
                <button
                  type="button"
                  onClick={() => handleNavClick('privacy')}
                  className={`nav__dropdown-link ${activePage === 'privacy' ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('terms')}
                  className={`nav__dropdown-link ${activePage === 'terms' ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Terms of Service
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('cookies')}
                  className={`nav__dropdown-link ${activePage === 'cookies' ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Cookie Policy
                </button>
              </div>
            </div>
          </nav>

          {/* Action Buttons: theme toggle -> login -> get started */}
          <div className="nav__actions">
            <button
              id="nav-theme-btn"
              className="nav__theme-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              type="button"
              onClick={onLoginClick}
              className="btn btn--ghost"
              id="nav-login-btn"
            >
              Login
            </button>
            <button
              type="button"
              onClick={onRegisterClick}
              className="btn btn--primary"
              id="nav-signup-btn"
            >
              Get Started
            </button>
            <button
              id="nav-hamburger"
              className={`nav__hamburger ${mobileMenuOpen ? 'open' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu matching myCloud: features -> console -> workflow -> security -> pricing -> legal -> theme -> login -> get started */}
      <nav
        id="mobile-menu"
        className={`nav__mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
        aria-label="Mobile navigation"
      >
        <button
          type="button"
          onClick={() => handleNavClick('#features', true)}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          Features
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('#preview', true)}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          Console
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('#how-it-works', true)}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          Workflow
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('#security', true)}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
        >
          Security
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('#pricing', true)}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span>Pricing</span>
          <span className="coming-soon-pill">Soon</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('contact')}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: activePage === 'contact' ? 'var(--accent-blue)' : undefined }}
        >
          Contact
        </button>

        <div className="nav__mobile-group-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '1.2rem', marginTop: '0.5rem', marginBottom: '-0.25rem' }}>
          Legal Documents
        </div>
        <button
          type="button"
          onClick={() => handleNavClick('privacy')}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: activePage === 'privacy' ? 'var(--accent-blue)' : undefined }}
        >
          Privacy Policy
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('terms')}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: activePage === 'terms' ? 'var(--accent-blue)' : undefined }}
        >
          Terms of Service
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('cookies')}
          className="nav__mobile-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: activePage === 'cookies' ? 'var(--accent-blue)' : undefined }}
        >
          Cookie Policy
        </button>

        <div className="nav__mobile-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => { setMobileMenuOpen(false); onLoginClick(); }}
            className="btn btn--outline btn--lg"
            style={{ width: '100%' }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setMobileMenuOpen(false); onRegisterClick(); }}
            className="btn btn--primary btn--lg"
            style={{ width: '100%' }}
          >
            Get Started
          </button>
        </div>
      </nav>
    </>
  );
};

export default PublicNavbar;
