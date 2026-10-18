import React, { useState, useEffect } from 'react';
import { Radio, Play, CheckCircle, Activity, Lock, ArrowRight } from 'lucide-react';

const HeroSection = ({ onRegisterClick, onDemoClick }) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero" id="home" aria-label="Hero">
      {/* Animated Background */}
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__gradient-mesh"></div>
        <div className="hero__grid"></div>
        <div className="hero__orb hero__orb--1"></div>
        <div className="hero__orb hero__orb--2"></div>
        <div className="hero__orb hero__orb--3"></div>
      </div>

      <div className="hero__inner">
        {/* Left / Main Content */}
        <div className="hero__content">
          <h1 className="hero__title">
            <span className="line-1">Your Space.</span>
            <span className="line-2">Your Eyes.</span>
            <span className="line-3 text-gradient">Real-Time Security.</span>
          </h1>

          <p className="hero__subtitle">
            The high-performance, privacy-first camera surveillance platform built for zero-latency monitoring, smart activity zones, edge detection, and encrypted feeds. Self-host. Stream. Own your footage.
          </p>

          {/* CTA Buttons */}
          <div className="hero__ctas">
            <button
              type="button"
              onClick={onRegisterClick}
              className="btn btn--primary btn--xl"
              id="hero-get-started"
            >
              <Radio size={18} />
              Get Started Free
            </button>
            <button
              type="button"
              onClick={onDemoClick}
              className="btn--ghost-hero"
              id="hero-learn-more"
            >
              <Play size={16} fill="currentColor" />
              See How It Works
            </button>
          </div>

          {/* 3 Balanced Stats on a Single Line */}
          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value" style={{ color: 'var(--accent-blue-light)' }}>Direct P2P</div>
              <div className="hero__stat-label">WebRTC stream</div>
            </div>
            <div className="hero__stat-divider" aria-hidden="true"></div>
            <div className="hero__stat">
              <div className="hero__stat-value" style={{ color: '#eef2ff' }}>TLS + SRTP</div>
              <div className="hero__stat-label">Encrypted in transit</div>
            </div>
            <div className="hero__stat-divider" aria-hidden="true"></div>
            <div className="hero__stat">
              <div className="hero__stat-value" style={{ color: 'var(--accent-emerald)' }}>100%</div>
              <div className="hero__stat-label">Local data retention</div>
            </div>
          </div>
        </div>

        {/* Right / Visual Mockup */}
        <div className="hero__visual" aria-hidden="true">
          <div className="hero__visual-wrapper">
            {/* Main Surveillance Console Card */}
            <div className="hero__mockup-card">
              <div className="hero__mockup-chrome">
                <span className="chrome-dot chrome-dot--red"></span>
                <span className="chrome-dot chrome-dot--yellow"></span>
                <span className="chrome-dot chrome-dot--green"></span>
                <span className="hero__mockup-url">cam.mysphere.co.in/live</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                    <span className="badge-dot" style={{ animation: 'pulse-dot 1.5s infinite' }}></span>
                    LIVE REC
                  </span>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {timeStr || '12:00:00'}
                  </span>
                </div>
              </div>

              {/* Simulated Camera Surveillance Grid */}
              <div className="hero-mockup-stage">
                {/* Primary Camera: Front Porch */}
                <div className="hero-cam-tile-primary">
                  {/* Grid Lines */}
                  <div className="hero-cam-grid-overlay"></div>
                  
                  {/* Simulated Motion Detection Polygon Box */}
                  <div style={{ position: 'absolute', top: '25%', left: '35%', width: '38%', height: '50%', border: '2px solid rgba(59, 130, 246, 0.8)', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px' }}>
                    <div style={{ position: 'absolute', top: '-18px', left: '0', background: '#3b82f6', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                      ZONE A: FRONT PORCH
                    </div>
                  </div>

                  {/* Camera Top Info */}
                  <div style={{ position: 'absolute', top: '8px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                      <span className="badge-dot"></span> Cam 01
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Main Entrance</span>
                  </div>

                  {/* Camera Bottom Telemetry */}
                  <div style={{ position: 'absolute', bottom: '8px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>1080p @ 30fps &middot; 4.2 Mbps</span>
                    <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '4px', color: '#10b981', fontWeight: 600 }}>WebRTC Direct</span>
                  </div>
                </div>

                {/* Secondary Camera: Driveway */}
                <div className="hero-cam-tile-secondary">
                  <div style={{ position: 'absolute', top: '6px', left: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="badge badge-accent" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>Cam 02</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 500 }}>Driveway</span>
                  </div>
                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    720p @ 30fps
                  </div>
                </div>

                {/* Tertiary Camera: Backyard */}
                <div className="hero-cam-tile-secondary">
                  <div style={{ position: 'absolute', top: '6px', left: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="badge badge-accent" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>Cam 03</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 500 }}>Backyard</span>
                  </div>
                  <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    720p @ 30fps
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Telemetry Chips */}
            <div className="hero__float-card hero__float-card--1">
              <div className="float-card__icon float-card__icon--green">
                <CheckCircle size={16} />
              </div>
              <div>
                <div className="float-card__title">Camera Online</div>
                <div className="float-card__sub">Cam 01 &middot; 1080p 30fps</div>
              </div>
            </div>

            <div className="hero__float-card hero__float-card--2">
              <div className="float-card__icon float-card__icon--blue">
                <Activity size={16} />
              </div>
              <div>
                <div className="float-card__title">Motion Detected</div>
                <div className="float-card__sub">Zone A &middot; Front Porch</div>
              </div>
            </div>

            <div className="hero__float-card hero__float-card--3">
              <div className="float-card__icon float-card__icon--purple">
                <Lock size={16} />
              </div>
              <div>
                <div className="float-card__title">DTLS-SRTP Stream</div>
                <div className="float-card__sub">End-to-End Encrypted</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
