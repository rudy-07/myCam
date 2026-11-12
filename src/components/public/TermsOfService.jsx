import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { motion } from 'motion/react';

const SECTIONS = [
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'license', label: 'Platform License' },
  { id: 'surveillance-ethics', label: 'Surveillance Ethics & Law' },
  { id: 'accounts', label: 'Account Responsibility' },
  { id: 'self-hosting', label: 'Self-Hosted Infrastructure' },
  { id: 'disclaimers', label: 'Disclaimers & Liability' },
  { id: 'termination', label: 'Termination' },
  { id: 'contact', label: 'Governing Law & Contact' },
];

const TermsOfService = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('acceptance');

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

  return (
    <div className="public-page public-page--terms">
      {/* Public Hero - Vertically Centered */}
      <section className="public-hero" aria-labelledby="terms-title">
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
              Legal &amp; Terms
            </span>
          </div>
          <h1 id="terms-title">
            Clear terms for <span className="text-gradient">private surveillance.</span>
          </h1>
          <p className="public-hero__lead">
            These terms define your rights and responsibilities when deploying, operating, or accessing camera streams and video recordings through the myCam platform.
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
              You own your hardware and video recordings. You are responsible for ensuring that camera placement complies with applicable local laws and privacy regulations. myCam is provided to empower secure monitoring without hidden surveillance or subscription lock-in.
            </div>

            <section id="acceptance" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Acceptance of Terms</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                By accessing, downloading, installing, or operating the myCam platform, you agree to be bound by these Terms of Service. If you do not agree with these terms, you must discontinue use and delete any associated server instances or software binaries.
              </p>
            </section>

            <section id="license" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Platform License</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Subject to your compliance with these terms, mySphere grants you a personal, worldwide, non-exclusive, revocable license to deploy and operate the myCam software for personal, residential, or internal business surveillance monitoring.
              </p>
            </section>

            <section id="surveillance-ethics" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Surveillance Ethics &amp; Law</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Video surveillance and audio recording are governed by federal, state, and local wiretapping and privacy statutes. When operating cameras through myCam, you expressly agree:
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Not to position cameras in locations where individuals possess a reasonable expectation of privacy (such as bathrooms, locker rooms, or bedrooms without explicit resident consent).</li>
                <li>To post clear, prominent surveillance warning signage where required by regional law.</li>
                <li>Not to use the software for unlawful stalking, harassment, or non-consensual voyeurism.</li>
              </ul>
            </section>

            <section id="accounts" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Account Responsibility</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                You are responsible for maintaining the confidentiality of administrative credentials, bearer tokens, and session keys. Any actions initiated under your authenticated account are deemed your responsibility.
              </p>
            </section>

            <section id="self-hosting" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Self-Hosted Infrastructure</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                For self-hosted instances, you are solely responsible for server maintenance, network security, firewall configuration, disk space capacity management, and data backups. mySphere is not liable for data loss caused by drive failures or misconfigured storage quotas.
              </p>
            </section>

            <section id="disclaimers" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Disclaimers &amp; Liability</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                myCam is provided "AS IS" without warranty of any kind, whether express or implied. While engineered for high uptime and resilience, myCam is not a certified emergency response, 911 dispatch, or critical life-safety system.
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                In no event shall mySphere or its contributors be liable for indirect, incidental, special, or consequential damages resulting from lost footage, network interruptions, or unauthorized access to unhardened self-hosted instances.
              </p>
            </section>

            <section id="termination" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Termination</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                You may terminate your agreement at any time by ceasing use of the platform and removing installed binaries. We reserve the right to suspend or restrict access to any managed cloud signaling relays in the event of documented abuse or terms violations.
              </p>
            </section>

            <section id="contact" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Governing Law &amp; Contact</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                These terms are governed by the laws of India and applicable international software copyright conventions. For questions regarding these terms, reach us at:
              </p>
              <div style={{ padding: '10px 16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'inline-block', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <a href="mailto:kanhaiffco2007@gmail.com" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>
                  kanhaiffco2007@gmail.com
                </a>
              </div>
            </section>
          </article>
        </div>
      </section>
    </div>
  );
};

export default TermsOfService;
