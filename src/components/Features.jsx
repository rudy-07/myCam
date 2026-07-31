import React from 'react';
import { Smartphone, Wifi, HardDrive, Cloud, Sliders, RefreshCw, Mic, ShieldAlert, Calendar, Camera } from 'lucide-react';
import FeatureCard from './FeatureCard';

const features = [
  {
    icon: Smartphone,
    title: "Phone as CCTV Camera",
    description: "Give your old smartphones a second life. Turn them into powerful security cameras or dashcams in seconds."
  },
  {
    icon: Wifi,
    title: "Remote Access",
    description: "Watch live feeds or recorded footage from anywhere in the world, on any device."
  },
  {
    icon: HardDrive,
    title: "Flexible Storage",
    description: "Save recordings locally to internal storage or SD card. You have full control over your data."
  },
  {
    icon: Cloud,
    title: "myCloud Integration",
    description: "Securely backup important footage to the cloud. Access your recordings even if the device is lost."
  },
  {
    icon: Sliders,
    title: "Adjustable Quality",
    description: "Optimize for storage or quality. Choose the resolution and bitrate that fits your needs."
  },
  {
    icon: RefreshCw,
    title: "Loop Recording",
    description: "Never run out of space. Old footage is automatically deleted to make room for new recordings."
  },
  {
    icon: Mic,
    title: "Two-Way Audio",
    description: "Speak and listen through your camera. Perfect for baby monitors or greeting visitors."
  },
  {
    icon: ShieldAlert,
    title: "Activity Zones & Alerts",
    description: "Define custom simple zones for motion detection and receive instant alerts when it matters."
  },
   {
    icon: Calendar,
    title: "Scheduled Recording",
    description: "Set custom schedules to record only when you need to, saving storage and battery."
  },
   {
    icon: Camera,
    title: "Image Capture Triggers",
    description: "Automatically capture high-res images on motion, schedule, or manual trigger."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-20 bg-slate-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything you need for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-DEFAULT to-accent-DEFAULT">
              Professional Security
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Packed with advanced features usually found in expensive dedicated hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard 
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
