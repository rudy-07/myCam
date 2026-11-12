import React from 'react';
import { ArrowRight } from 'lucide-react';

const CallToAction = ({ onRegisterClick, onLoginClick }) => {
  return (
    <section className="cta-banner" id="pricing" aria-labelledby="cta-heading">
      <div className="cta-banner__bg" aria-hidden="true" style={{ pointerEvents: 'none' }} />
      <div className="cta-banner__border" aria-hidden="true" />
      <div className="cta-banner__inner">
        <span className="badge">
          <span className="badge-dot" aria-hidden="true" />
          Free during beta
        </span>
        <h2 className="cta-banner__title" id="cta-heading">
          Take back control<br />
          <span className="text-gradient">of your surveillance today.</span>
        </h2>
        <p className="cta-banner__subtitle">
          Join the mySphere ecosystem. Your cameras, your rules, your footage.
          Start for free. No credit card required.
        </p>
        <div className="cta-banner__actions">
          <button
            type="button"
            onClick={onRegisterClick}
            className="btn btn--primary btn--xl"
            id="cta-get-started"
          >
            Get Started Free
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={onLoginClick}
            className="btn btn--outline btn--xl"
            id="cta-login"
          >
            Sign In to Console
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          No credit card &middot; Zero telemetry &middot; 100% data sovereignty
        </p>
      </div>
    </section>
  );
};

export default CallToAction;
