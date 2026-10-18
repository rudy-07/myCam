import React from 'react';
import { Camera, Sliders, MonitorCheck } from 'lucide-react';
import { motion } from 'motion/react';

const STEPS = [
  {
    number: '01',
    icon: Camera,
    title: 'Connect Any Camera Device',
    description: 'Use what you already have. Connect an RTSP/ONVIF security camera, a USB webcam, or simply open the secure broadcaster link on any old smartphone to stream HD video instantly.',
  },
  {
    number: '02',
    icon: Sliders,
    title: 'Define Zones and Armed Schedules',
    description: 'Draw custom polygon activity boundaries directly on the video frame. Configure sensitivity thresholds and 24/7 weekly schedules to only record footage when action happens.',
  },
  {
    number: '03',
    icon: MonitorCheck,
    title: 'Monitor and Review with Zero Cloud Lag',
    description: 'Stream direct peer-to-peer feeds from any desktop or mobile browser. Receive instant breach chimes and review indexed motion clips with local hardware data ownership.',
  },
];

const HowItWorks = () => {
  return (
    <section className="how-it-works-section" id="how-it-works" style={{ padding: '5rem 0', position: 'relative', borderTop: '1px solid var(--border)' }}>
      <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div className="features__header animate-fade-up">
          <span className="section-label">Workflow</span>
          <h2 className="section-title">
            Up and running in three simple steps.<br />
            <span className="text-gradient">No complex NVR hardware required.</span>
          </h2>
          <p className="section-subtitle">
            Deploy enterprise-grade monitoring without vendor lock-in, proprietary cloud subscriptions, or complicated firewall routing.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '3.5rem' }}>
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                className="workflow-step-card"
                whileHover={{ y: -6, transition: { duration: 0.25, ease: 'easeOut' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: 'rgba(59, 130, 246, 0.14)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-blue)',
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <span className="workflow-step-number">
                    {step.number}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px' }}>
                  {step.title}
                </h3>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
