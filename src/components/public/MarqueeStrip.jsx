import React from 'react';
import { Radio, Lock, LayoutGrid, Activity, Calendar, Shield, Smartphone, HardDrive } from 'lucide-react';

const MARQUEE_ITEMS = [
  { icon: Radio, text: 'Zero-latency WebRTC streams' },
  { icon: Lock, text: 'Encrypted in transit (DTLS-SRTP)' },
  { icon: LayoutGrid, text: 'Simultaneous multi-camera grid' },
  { icon: Activity, text: 'Smart polygon activity zones' },
  { icon: Calendar, text: 'Automated 24/7 surveillance schedules' },
  { icon: Shield, text: '100% self-hosted & private' },
  { icon: Smartphone, text: 'Instant phone camera broadcaster' },
  { icon: HardDrive, text: 'Local NAS and disk retention' },
];

const MarqueeStrip = () => {
  return (
    <div className="marquee-section" aria-label="Key features highlight" aria-hidden="true">
      <div className="marquee__track">
        {/* First set */}
        {MARQUEE_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <span className="marquee__item" key={`m1-${index}`}>
              <Icon size={16} />
              {item.text}
            </span>
          );
        })}
        {/* Duplicate set for seamless looping */}
        {MARQUEE_ITEMS.map((item, index) => {
          const Icon = item.icon;
          return (
            <span className="marquee__item" key={`m2-${index}`}>
              <Icon size={16} />
              {item.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default MarqueeStrip;
