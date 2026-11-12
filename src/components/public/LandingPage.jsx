import React from 'react';
import PublicNavbar from './PublicNavbar';
import HeroSection from './HeroSection';
import MarqueeStrip from './MarqueeStrip';
import FeaturesBento from './FeaturesBento';
import ProductPreview from './ProductPreview';
import HowItWorks from './HowItWorks';
import SecuritySection from './SecuritySection';
import CallToAction from './CallToAction';
import PublicFooter from './PublicFooter';

const LandingPage = ({
  onLoginClick,
  onRegisterClick,
  onNavigate,
}) => {
  const scrollToDemo = () => {
    const el = document.querySelector('#preview');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page-wrapper" style={{ minHeight: '100vh', background: 'transparent', color: 'var(--text-primary)', position: 'relative', zIndex: 1 }}>
      {/* Skip to Content Link */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Unified Public Navbar */}
      <PublicNavbar
        activePage="landing"
        onNavigate={onNavigate}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
      />

      {/* Main Landing Page Content */}
      <main id="main-content">
        <HeroSection
          onRegisterClick={onRegisterClick}
          onDemoClick={scrollToDemo}
        />
        <MarqueeStrip />
        <FeaturesBento />
        <ProductPreview />
        <HowItWorks />
        <SecuritySection />
        <CallToAction
          onRegisterClick={onRegisterClick}
          onLoginClick={onLoginClick}
        />
      </main>

      {/* Unified Public Footer */}
      <PublicFooter
        onNavigate={onNavigate}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
      />
    </div>
  );
};

export default LandingPage;
