import React from 'react';
import { Github, Globe, Mail } from 'lucide-react';
import logoIcon from '../../assets/mycam_no_text.png';

const PublicFooter = ({ onNavigate, onLoginClick, onRegisterClick }) => {
  const handleNav = (target, isHash = false) => {
    if (isHash) {
      onNavigate('landing');
      setTimeout(() => {
        const el = document.querySelector(target);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      onNavigate(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openCookiePrefs = () => {
    window.dispatchEvent(new CustomEvent('open-cookie-preferences'));
  };

  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer__inner">
          {/* Brand Column matching myCloud */}
          <div className="footer__brand">
            <button
              type="button"
              onClick={() => handleNav('landing')}
              className="footer__logo"
              aria-label="myCam home"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <img
                src={logoIcon}
                alt="myCam"
                className="footer__logo-img"
                width="44"
                height="44"
              />
              <span className="footer__logo-text">
                my<span style={{ color: 'var(--accent-blue)' }}>Cam</span>
              </span>
            </button>

            <p className="footer__tagline">
              Your personal surveillance platform. Privacy-first, zero-latency WebRTC streams, and built for the mySphere ecosystem.
            </p>

            {/* Social Buttons with Proper Placement & Hover Glow */}
            <div className="footer__socials">
              <a
                href="https://github.com/rudy-07"
                className="footer__social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="myCam on GitHub"
              >
                <Github size={16} />
              </a>
              <a
                href="https://mysphere.co.in"
                className="footer__social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="mySphere website"
              >
                <Globe size={16} />
              </a>
              <a
                href="mailto:kanhaiffco2007@gmail.com"
                className="footer__social-link"
                aria-label="Contact myCam"
              >
                <Mail size={16} />
              </a>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="footer__col">
            <div className="footer__col-title">Product</div>
            <div className="footer__links">
              <button type="button" onClick={() => handleNav('#features', true)} className="footer__link">
                Features
              </button>
              <button type="button" onClick={() => handleNav('#preview', true)} className="footer__link">
                Console Grid
              </button>
              <button type="button" onClick={() => handleNav('#how-it-works', true)} className="footer__link">
                Workflow
              </button>
              <button type="button" onClick={() => handleNav('#security', true)} className="footer__link">
                Security
              </button>
            </div>
          </div>

          {/* Column 2: Company */}
          <div className="footer__col">
            <div className="footer__col-title">Company</div>
            <div className="footer__links">
              <a href="https://mysphere.co.in" className="footer__link" target="_blank" rel="noopener noreferrer">
                mySphere
              </a>
              <a href="https://mysphere.co.in/about" className="footer__link" target="_blank" rel="noopener noreferrer">
                About mySphere
              </a>
              <a href="https://cloud.mysphere.co.in" className="footer__link" target="_blank" rel="noopener noreferrer">
                myCloud Storage
              </a>
              <button type="button" onClick={() => handleNav('contact')} className="footer__link">
                Contact &amp; Support
              </button>
            </div>
          </div>

          {/* Column 3: Legal */}
          <div className="footer__col">
            <div className="footer__col-title">Legal</div>
            <div className="footer__links">
              <button type="button" onClick={() => handleNav('privacy')} className="footer__link">
                Privacy Policy
              </button>
              <button type="button" onClick={() => handleNav('terms')} className="footer__link">
                Terms of Service
              </button>
              <button type="button" onClick={() => handleNav('cookies')} className="footer__link">
                Cookie Policy
              </button>
              <button type="button" onClick={openCookiePrefs} className="footer__link">
                Cookie Settings
              </button>
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; 2026 mySphere. All rights reserved. Built with engineering rigor.
          </p>
          <div className="footer__bottom-links">
            <button type="button" onClick={() => handleNav('privacy')} className="footer__bottom-link">
              Privacy
            </button>
            <button type="button" onClick={() => handleNav('terms')} className="footer__bottom-link">
              Terms
            </button>
            <button type="button" onClick={() => handleNav('cookies')} className="footer__bottom-link">
              Cookies
            </button>
            <button type="button" onClick={openCookiePrefs} className="footer__bottom-link">
              Cookie Settings
            </button>
            <button type="button" onClick={() => handleNav('contact')} className="footer__bottom-link">
              Contact
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
