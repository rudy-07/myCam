import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  CheckCircle2,
  AlertCircle,
  Shield,
  Radio,
  Activity,
  Bug,
  Lightbulb,
  Briefcase,
  ShieldAlert,
  HardDrive,
  Network,
  HelpCircle,
  Lock,
  Mail,
  ExternalLink,
  ChevronDown,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_BASE } from '../../config';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

const CONTACT_CATEGORIES = [
  {
    id: 'general',
    label: 'General support',
    icon: HelpCircle,
    colorClass: '',
    desc: 'Account access, general questions, and everyday myCam operation.',
  },
  {
    id: 'technical',
    label: 'Technical support',
    icon: Radio,
    colorClass: 'contact-card__icon--purple',
    desc: 'Broadcaster pairing, connection drops, browser stream troubleshooting.',
  },
  {
    id: 'zones',
    label: 'Polygon zones & motion',
    icon: Activity,
    colorClass: 'contact-card__icon--cyan',
    desc: 'Assistance calibrating trigger boundaries and tuning motion thresholds.',
  },
  {
    id: 'bug',
    label: 'Bug reports',
    icon: Bug,
    colorClass: 'contact-card__icon--orange',
    desc: 'Tell us what happened, what you expected, and reproduction steps.',
  },
  {
    id: 'feature',
    label: 'Feature requests',
    icon: Lightbulb,
    colorClass: 'contact-card__icon--pink',
    desc: 'Share workflows, hardware support ideas, or UI enhancements you need.',
  },
  {
    id: 'business',
    label: 'Business inquiries',
    icon: Briefcase,
    colorClass: 'contact-card__icon--emerald',
    desc: 'Discuss commercial deployment, custom hardware, or mySphere ecosystem collaborations.',
  },
  {
    id: 'security',
    label: 'Security reports',
    icon: ShieldAlert,
    colorClass: 'contact-card__icon--orange',
    desc: 'Responsible vulnerability disclosure and cryptographic protocol inquiries.',
  },
  {
    id: 'storage',
    label: 'Storage & NAS retention',
    icon: HardDrive,
    colorClass: 'contact-card__icon--purple',
    desc: 'Network mounts, quota limits, local drive management, and S3 mirroring.',
  },
  {
    id: 'webrtc',
    label: 'WebRTC & network traversal',
    icon: Network,
    colorClass: 'contact-card__icon--cyan',
    desc: 'NAT traversal, DTLS-SRTP negotiation, STUN/TURN, and firewall issues.',
  },
];

const Contact = ({ onBack, onNavigate, onLoginClick, onRegisterClick, onPrivacyClick }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: '',
    company: '', // Honeypot
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message: string, refId?: string }
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const formRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCategoryDropdownOpen(false);
      }
    };
    if (categoryDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [categoryDropdownOpen]);

  const handleCategorySelect = (catId) => {
    setFormData((prev) => ({ ...prev, category: catId }));
    setCategoryDropdownOpen(false);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    // Basic frontend validations matching myCloud standards
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setStatus({ type: 'error', message: 'Enter a valid name with at least 2 characters.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setStatus({ type: 'error', message: 'Enter a valid email address.' });
      return;
    }

    if (!formData.subject.trim() || formData.subject.trim().length < 3) {
      setStatus({ type: 'error', message: 'Enter a subject of at least 3 characters.' });
      return;
    }

    if (!formData.category) {
      setStatus({ type: 'error', message: 'Please select a topic or category for your request.' });
      return;
    }

    if (!formData.message.trim() || formData.message.trim().length < 20) {
      setStatus({ type: 'error', message: 'Enter a message between 20 and 5,000 characters with sufficient detail.' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to submit contact request.');
      }

      const generatedRef = `CAM-${Date.now().toString(36).toUpperCase()}`;
      setStatus({
        type: 'success',
        message: data.message || 'Thanks, your message has been sent. We will review it as soon as we can.',
        refId: generatedRef,
      });

      // Reset form fields
      setFormData({
        name: '',
        email: '',
        subject: '',
        category: '',
        message: '',
        company: '',
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'We could not send your message right now. Please try again later or email kanhaiffco2007@gmail.com directly.',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryObj = CONTACT_CATEGORIES.find((c) => c.id === formData.category);
  const SelectedCategoryIcon = selectedCategoryObj ? selectedCategoryObj.icon : HelpCircle;

  return (
    <div className="public-page public-page--contact">
      <PublicNavbar
        activePage="contact"
        onNavigate={onNavigate || onBack}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
      />

      {/* ═══════════════════════════════════════════
           1. HERO SECTION
           ═══════════════════════════════════════════ */}
      <section className="public-hero" aria-labelledby="contact-title">
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
              We're here to help
            </span>
          </div>

          <h1 id="contact-title">
            Let's make your surveillance <span className="text-gradient">work better.</span>
          </h1>

          <p className="public-hero__lead">
            Whether you need assistance pairing camera broadcasters, calibrating smart activity zones, tuning WebRTC streams, or reporting a security disclosure, choose the path that fits and we will route your message with context.
          </p>

          <div className="community-links" aria-label="Quick contact links">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Send a message
            </button>
            <a
              className="btn btn--outline"
              href="mailto:kanhaiffco2007@gmail.com"
            >
              Email Support Directly
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
           2. CONTACT OPTIONS GRID (3x3 Cards)
           ═══════════════════════════════════════════ */}
      <section className="public-section" aria-labelledby="contact-options-title">
        <div className="container">
          <div className="contact-section-head">
            <span className="section-label">Contact options</span>
            <h2 className="section-title" id="contact-options-title">Start in the right place.</h2>
            <p className="section-subtitle">
              Choose a focused path to prefill the message category, or reach out directly for priority topics.
            </p>
          </div>

          <div className="contact-grid">
            {CONTACT_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = Boolean(formData.category) && formData.category === cat.id;
              return (
                <article
                  key={cat.id}
                  className="contact-card"
                  style={{
                    borderColor: isSelected ? 'var(--accent-blue)' : undefined,
                    boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : undefined,
                  }}
                >
                  <div className={`contact-card__icon ${cat.colorClass}`}>
                    <Icon size={22} />
                  </div>
                  <h3>{cat.label}</h3>
                  <p>{cat.desc}</p>
                  <button
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className="contact-card__action"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Select this topic <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
           3. CONTACT FORM SECTION
           ═══════════════════════════════════════════ */}
      <section className="public-section" id="contact-form" ref={formRef} aria-labelledby="contact-form-title">
        <div className="container contact-form-layout">
          {/* Left Column: Context & Guidelines */}
          <div className="contact-form-intro">
            <span className="section-label">Send a message</span>
            <h2 id="contact-form-title">Give us the useful details.</h2>
            <p>
              A clear subject and a little context help us understand your request quickly. For camera, video, or stream problems, describe your device setup, browser, and any error message displayed.
            </p>

            <div className="contact-form-tip">
              <Shield size={17} style={{ flexShrink: 0, color: 'var(--accent-blue-light)', marginTop: '2px' }} />
              <span>
                Attachments are not accepted through this form. Please never include account passwords, API tokens, session cookies, or private video footage.
              </span>
            </div>

            <div style={{ marginTop: '2rem', padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                Direct Support Email
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} style={{ color: 'var(--accent-blue)' }} />
                <a
                  href="mailto:kanhaiffco2007@gmail.com"
                  style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem', textDecoration: 'none' }}
                >
                  kanhaiffco2007@gmail.com
                </a>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Managed directly by the mySphere development team.
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Form */}
          <div className="contact-form-panel">
            {status?.type === 'success' ? (
              <div
                style={{
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1.5px solid rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-emerald)',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Message Sent Successfully
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '420px', lineHeight: 1.6, margin: 0 }}>
                  {status.message}
                </p>
                {status.refId && (
                  <div style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--accent-blue)' }}>
                    Ticket Reference: {status.refId}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setStatus(null)}
                  className="btn btn--outline"
                  style={{ marginTop: '1rem' }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit} noValidate>
                {/* Honeypot field for bot suppression */}
                <div className="contact-honeypot" aria-hidden="true">
                  <label htmlFor="contact-company">Company</label>
                  <input
                    id="contact-company"
                    name="company"
                    type="text"
                    tabIndex="-1"
                    autoComplete="off"
                    value={formData.company}
                    onChange={handleChange}
                  />
                </div>

                {/* Error Banner */}
                {status?.type === 'error' && (
                  <div className="contact-form-status is-visible contact-form-status--error">
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{status.message}</span>
                  </div>
                )}

                {/* Row 1: Name and Email */}
                <div className="contact-form__row">
                  <div className="contact-field">
                    <label htmlFor="contact-name">Name</label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      placeholder="Your name"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="contact-field">
                    <label htmlFor="contact-email">Email Address</label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Row 2: Subject and Category */}
                <div className="contact-form__row">
                  <div className="contact-field">
                    <label htmlFor="contact-subject">Subject</label>
                    <input
                      id="contact-subject"
                      name="subject"
                      type="text"
                      required
                      placeholder="Brief summary of your question"
                      value={formData.subject}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="contact-field" ref={dropdownRef} style={{ position: 'relative' }}>
                    <label id="contact-category-label">Category</label>
                    <input type="hidden" name="category" value={formData.category} />

                    {/* Custom Dropdown Trigger */}
                    <button
                      type="button"
                      id="contact-category-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={categoryDropdownOpen}
                      aria-labelledby="contact-category-label contact-category-trigger"
                      onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                      className={`contact-custom-select-trigger ${categoryDropdownOpen ? 'is-open' : ''}`}
                    >
                      <div className="contact-custom-select-selected">
                        {selectedCategoryObj ? (
                          <>
                            <span className={`contact-custom-select-icon-pill ${selectedCategoryObj.colorClass}`}>
                              <SelectedCategoryIcon size={16} />
                            </span>
                            <span className="contact-custom-select-label">{selectedCategoryObj.label}</span>
                          </>
                        ) : (
                          <>
                            <span className="contact-custom-select-icon-pill">
                              <HelpCircle size={16} />
                            </span>
                            <span className="contact-custom-select-placeholder">Choose a topic or category...</span>
                          </>
                        )}
                      </div>
                      <ChevronDown
                        size={16}
                        className="contact-custom-select-chevron"
                        style={{
                          transform: categoryDropdownOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </button>

                    {/* Custom Dropdown Popover Menu */}
                    <AnimatePresence>
                      {categoryDropdownOpen && (
                        <motion.div
                          id="contact-category-menu"
                          role="listbox"
                          aria-labelledby="contact-category-label"
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          className="contact-custom-select-menu"
                        >
                          {CONTACT_CATEGORIES.map((c) => {
                            const ItemIcon = c.icon;
                            const isItemActive = formData.category === c.id;
                            return (
                              <div
                                key={c.id}
                                role="option"
                                aria-selected={isItemActive}
                                tabIndex={0}
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, category: c.id }));
                                  setCategoryDropdownOpen(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setFormData((prev) => ({ ...prev, category: c.id }));
                                    setCategoryDropdownOpen(false);
                                  }
                                }}
                                className={`contact-custom-select-option ${isItemActive ? 'is-active' : ''}`}
                              >
                                <div className={`contact-custom-select-option-icon ${c.colorClass}`}>
                                  <ItemIcon size={16} />
                                </div>
                                <div className="contact-custom-select-option-content">
                                  <span className="contact-custom-select-option-title">{c.label}</span>
                                  <span className="contact-custom-select-option-desc">{c.desc}</span>
                                </div>
                                {isItemActive && (
                                  <div className="contact-custom-select-option-check">
                                    <Check size={16} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Row 3: Message */}
                <div className="contact-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="contact-message">Message</label>
                    <span className="contact-field__hint">
                      {formData.message.length} / 5,000 characters
                    </span>
                  </div>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    placeholder="Tell us what you need help with. Please omit passwords, session tokens, and private camera footage."
                    value={formData.message}
                    onChange={handleChange}
                    rows="6"
                  ></textarea>
                </div>

                {/* Footer and Submit */}
                <div className="contact-form__footer">
                  <p className="contact-form__privacy">
                    By submitting, you agree that we may use the provided information to respond. See our{' '}
                    <button
                      type="button"
                      onClick={onPrivacyClick}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-blue-light)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
                    >
                      Privacy Policy
                    </button>.
                  </p>

                  <button
                    type="submit"
                    className="btn btn--primary btn--lg contact-submit"
                    disabled={loading}
                    aria-label="Send message"
                  >
                    <span className="contact-submit__label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {loading ? 'Sending Message...' : 'Send Message'}
                      {!loading && <Send size={15} />}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
           4. SHORTCUT / FAQ CALLOUT (Matching myCloud)
           ═══════════════════════════════════════════ */}
      <section className="public-section" aria-labelledby="shortcut-title" style={{ paddingBottom: '5rem' }}>
        <div className="container">
          <div className="contact-shortcut">
            <div className="contact-shortcut__icon">
              <Radio size={24} />
            </div>
            <div>
              <h2 id="shortcut-title">A quick answer may already be available.</h2>
              <p>Explore camera configuration, polygon activity zone calibration, and recording archive features in our interactive console.</p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="btn btn--primary"
            >
              Explore Console
            </button>
          </div>
        </div>
      </section>

      {/* Unified Public Footer */}
      <PublicFooter
        onNavigate={onNavigate || onBack}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
      />
    </div>
  );
};

export default Contact;
