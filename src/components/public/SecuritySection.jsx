import React from 'react';
import { ShieldCheck, Lock, EyeOff, Server, HardDrive, CheckCircle2 } from 'lucide-react';

const SECURITY_POINTS = [
  {
    icon: Lock,
    title: 'DTLS-SRTP Stream Encryption',
    description: 'Video and audio streams are directly negotiated using modern WebRTC standards. Video packets are encrypted point-to-point and cannot be decrypted by intermediaries.',
  },
  {
    icon: HardDrive,
    title: 'Local Storage by Default',
    description: 'Footage and thumbnails are stored directly on the device running myCam or your internal network storage. You decide what stays, how long it is kept, and when it is purged.',
  },
  {
    icon: EyeOff,
    title: 'Zero Third-Party Telemetry',
    description: 'No marketing trackers, no external analytics SDKs, and no cloud surveillance subscriptions. Your camera feeds remain private to you and your authorized family or team members.',
  },
  {
    icon: Server,
    title: 'Self-Hosted Control Plane',
    description: 'Run the entire stack on your home lab, mini PC, NAS, or private cloud instance. Full sovereignty over ports, user authentication tokens, and access lists.',
  },
];

const SecuritySection = () => {
  return (
    <section className="security-section" id="security" style={{ padding: '5rem 0', position: 'relative', borderTop: '1px solid var(--border)' }}>
      <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div className="features__header animate-fade-up">
          <span className="section-label">Privacy by Design</span>
          <h2 className="section-title">
            Security that is transparent.<br />
            <span className="text-gradient">Not a marketing afterthought.</span>
          </h2>
          <p className="section-subtitle">
            Most smart camera companies monetize video feeds or lock basic recording capabilities behind recurring cloud subscriptions. myCam gives you full autonomy.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '3.5rem' }}>
          {SECURITY_POINTS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="card card-body"
                style={{
                  padding: '1.75rem',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-emerald)',
                  }}
                >
                  <Icon size={20} />
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
