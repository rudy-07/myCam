import React, { useState, useEffect, useRef, useMemo } from 'react';
import useDismiss from '../../hooks/useDismiss';

const PHRASES = [
  'All surveillance feeds active & secured.',
  'Edge motion detection online.',
  'Zero-latency WebRTC monitoring.',
  'System operational · Feeds nominal.',
  'Smart activity zones armed.',
  'Encrypted camera telemetry active.',
];

const ClockDropdown = ({ user }) => {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [clockStyle, setClockStyle] = useState(() => {
    try {
      return localStorage.getItem('mycam_clock_style') || 'modern';
    } catch {
      return 'modern';
    }
  });

  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  useDismiss(popoverRef, open, () => setOpen(false), buttonRef);

  // Update time every second for smooth ticking second hand
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const changeStyle = (style) => {
    setClockStyle(style);
    try {
      localStorage.setItem('mycam_clock_style', style);
    } catch {
      /* ignore storage failure */
    }
  };

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // Analog angles
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  // Personalized greeting
  const greeting = useMemo(() => {
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, [hours]);

  const userName = user?.name || user?.username || 'Operator';
  const phrase = useMemo(() => PHRASES[Math.floor(Math.random() * PHRASES.length)], [open]);

  // Formatted date and time strings
  const dateShort = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timeShort = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const timeLong = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateFull = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Timezone string
  const timezoneName = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    } catch {
      return 'Local';
    }
  }, []);

  return (
    <div className="relative">
      {/* Time Pill Button in Navbar */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Current time: ${timeShort}, ${dateShort}. Click to open clock details.`}
        className={`group flex items-center gap-2.5 rounded-full border px-4 py-2 min-h-[38px] text-[13px] font-medium transition-all duration-200 ${
          open
            ? 'border-accent/60 bg-accent/15 text-accent shadow-sm shadow-accent/20'
            : 'border-border bg-surface/80 text-fg-muted hover:border-accent/40 hover:bg-surface-hover hover:text-fg'
        }`}
      >
        <span className="font-sans font-medium text-fg-muted group-hover:text-fg transition-colors">
          {dateShort}
        </span>
        <span className="text-accent/60 font-bold">•</span>
        <span className="font-mono font-bold text-fg tracking-tight tabular-nums">
          {timeShort}
        </span>
      </button>

      {/* Clock Dropdown Card */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Time and system clock details"
          className="popover absolute right-0 top-full z-50 mt-2.5 w-[310px] animate-fade-up p-5 shadow-2xl backdrop-blur-xl border border-border-strong/70 bg-surface/95 rounded-2xl"
        >
          {/* Greeting Section */}
          <div className="mb-4 text-center">
            <h2 className="text-base font-bold text-fg tracking-tight">
              {greeting}, {userName}
            </h2>
            <p className="mt-0.5 text-[11px] font-medium text-accent">
              {phrase}
            </p>
          </div>

          {/* Analog Clock Dial */}
          <div className="relative mx-auto my-3 flex items-center justify-center">
            <div
              className={`relative size-44 rounded-full transition-all duration-300 ${
                clockStyle === 'minimal'
                  ? 'border-2 border-border-strong bg-surface-sunken/40 shadow-inner'
                  : clockStyle === 'classic'
                  ? 'border border-border-strong bg-gradient-to-br from-surface-hover/80 via-surface/60 to-surface-sunken shadow-lg'
                  : 'border-2 border-accent/70 bg-gradient-to-tr from-accent/10 via-surface/80 to-surface shadow-md shadow-accent/15'
              }`}
            >
              {/* 12 Hour Markers */}
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2"
                  style={{ transform: `rotate(${i * 30}deg)` }}
                >
                  <div
                    className={`mx-auto rounded-full ${
                      i % 3 === 0
                        ? 'h-2.5 w-[2.5px] bg-accent'
                        : 'h-1.5 w-[1.5px] bg-fg-muted/40'
                    }`}
                  />
                </div>
              ))}

              {/* Hour Hand */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
                style={{ transform: `rotate(${hourAngle}deg)` }}
              >
                <div className="h-12 w-[3.5px] -translate-y-5 rounded-full bg-fg shadow-sm" />
              </div>

              {/* Minute Hand */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
                style={{ transform: `rotate(${minuteAngle}deg)` }}
              >
                <div className="h-16 w-[2.5px] -translate-y-7 rounded-full bg-fg-muted shadow-sm" />
              </div>

              {/* Second Hand (Ticking red/electric) */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-75"
                style={{ transform: `rotate(${secondAngle}deg)` }}
              >
                <div className="h-20 w-[1.5px] -translate-y-8 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              </div>

              {/* Center Pivot Dot */}
              <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-fg shadow" />
            </div>
          </div>

          {/* Large Digital Clock & Date */}
          <div className="mt-3 text-center">
            <div className="font-mono text-2xl font-extrabold tracking-wider text-accent tabular-nums">
              {timeLong}
            </div>
            <div className="mt-0.5 text-xs font-semibold text-fg">
              {dateFull}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface-sunken/60 px-2.5 py-0.5 text-[10px] font-mono text-fg-muted">
              <span>Timezone:</span>
              <span className="font-semibold text-fg-muted">{timezoneName}</span>
            </div>
          </div>

          {/* Clock Style Switcher */}
          <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-border/60 pt-3">
            {['minimal', 'classic', 'modern'].map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => changeStyle(style)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-all duration-150 ${
                  clockStyle === style
                    ? 'border border-accent/60 bg-accent text-white shadow-sm shadow-accent/30'
                    : 'border border-border/70 bg-surface/60 text-fg-muted hover:border-border-strong hover:bg-surface-hover hover:text-fg'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockDropdown;
