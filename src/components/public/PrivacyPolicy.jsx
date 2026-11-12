import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { motion } from 'motion/react';

const SECTIONS = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'camera-feeds', label: 'Live Feeds & WebRTC' },
  { id: 'recordings-storage', label: 'Footage & Storage' },
  { id: 'activity-zones', label: 'Activity Zones & Motion' },
  { id: 'accounts', label: 'Account & Authentication' },
  { id: 'retention', label: 'Retention & Deletion' },
  { id: 'self-hosting', label: 'Self-Hosting Autonomy' },
  { id: 'third-parties', label: 'Zero-Tracking Guarantee' },
  { id: 'contact', label: 'Inquiries & Support' },
];

const PrivacyPolicy = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('introduction');

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
    <div className="public-page public-page--privacy">
      {/* Public Hero - Vertically Centered */}
      <section className="public-hero" aria-labelledby="privacy-title">
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
              Legal &amp; Trust
            </span>
          </div>
          <h1 id="privacy-title">
            Privacy that is <span className="text-gradient">specific.</span>
          </h1>
          <p className="public-hero__lead">
            This policy explains how myCam processes video streams, motion events, account authentication, and recording storage across self-hosted and cloud-connected deployments.
          </p>
          <p className="public-hero__meta">Last updated October 15, 2026</p>
        </div>
      </section>

      {/* Content Section */}
      <section className="public-section">
        <div className="container legal-shell">
          {/* Sticky Table of Contents with Live ScrollSpy */}
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
              myCam was built to remove surveillance middlemen. We do not inspect your video feeds, sell personal telemetry, or require third-party cloud streaming servers. Your video feeds are transmitted directly via peer-to-peer WebRTC, and your recordings live on the storage hardware you designate.
            </div>

            <section id="introduction" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Introduction</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                myCam is a personal and edge video surveillance application within the mySphere software ecosystem. This Privacy Policy outlines the categories of data processed by myCam applications (including the browser console, WebRTC broadcaster utility, and background synchronization daemon) and governs user data ownership.
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                When you deploy myCam on your own hardware or server infrastructure, you act as the primary data controller for that instance. This policy describes the baseline architecture implemented by the software.
              </p>
            </section>

            <section id="camera-feeds" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Live Feeds &amp; WebRTC Transmission</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Live camera video and audio streams are transmitted directly between the broadcasting camera device (such as an Android phone, USB camera, or RTSP proxy) and your monitoring browser using WebRTC (Web Real-Time Communication).
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                WebRTC media connections are secured via Datagram Transport Layer Security (DTLS) and the Secure Real-Time Transport Protocol (SRTP). Signaling metadata (session negotiation) passes through the myCam signaling relay over HTTPS/WSS and is discarded immediately after peer connection establishment.
              </p>
            </section>

            <section id="recordings-storage" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Footage &amp; Storage Sovereignty</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Recorded video clips and event snapshots are written to the storage destinations configured by the operator:
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: 'var(--text-primary)' }}>Local Storage:</strong> Internal drive mounts or dedicated network storage paths on your host.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>SD Card Storage:</strong> Removable media partitions mounted by the server daemon.</li>
                <li><strong style={{ color: 'var(--text-primary)' }}>Cloud Mirroring:</strong> S3-compatible private buckets configured with your own API credentials, secured via TLS in transit and AES-256 server-side encryption at rest.</li>
              </ul>
            </section>

            <section id="activity-zones" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Activity Zones &amp; Motion Detection</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Activity zones are stored as normalized geometric coordinate vectors (percentages relative to the video frame). Motion evaluation occurs locally on the broadcaster device or ingestion pipeline. myCam does not transmit your snapshot frames to public AI recognition APIs unless an operator explicitly configures a private model endpoint.
              </p>
            </section>

            <section id="accounts" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Account &amp; Authentication</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                User authentication is strictly scoped to your authorized operators:
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Passwords are hashed using salted cryptographic algorithms (scrypt and pbkdf2:sha256) prior to storage.</li>
                <li>Authentication session tokens are issued with bounded time-to-live expiration (43,200 seconds / 12 hours).</li>
                <li>Session tokens are stored in the client browser's local storage and submitted via Bearer authorization headers.</li>
              </ul>
            </section>

            <section id="retention" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Retention &amp; Deletion</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Operators have granular control over retention schedules in the Storage Settings console:
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Automatic deletion triggers when designated storage quotas (MB) are reached, purging the oldest recordings first.</li>
                <li>Manual one-click deletion of individual clips or batch time-ranges immediately unlinks the database record and removes the physical media file from disk.</li>
              </ul>
            </section>

            <section id="self-hosting" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Self-Hosting Autonomy</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                When running myCam as a containerized or local Node/Express deployment, no diagnostic logs, usage metrics, or video metadata leave your server network without your consent. You maintain root access and physical ownership over your database and media directories.
              </p>
            </section>

            <section id="third-parties" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Zero-Tracking Guarantee</h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                myCam does not include third-party advertising scripts, tracker pixels, behavior analytics SDKs, or data broker integrations. We believe security surveillance should be strictly private to the property owner.
              </p>
            </section>

            <section id="contact" className="legal-section">
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Inquiries &amp; Support</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                If you have questions regarding this Privacy Policy or wish to report a security disclosure, please contact the mySphere security team at:
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

export default PrivacyPolicy;
