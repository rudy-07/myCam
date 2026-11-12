import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Radio, Activity, LayoutGrid, Calendar, Film, Bell, Smartphone, Server, ShieldCheck, Zap } from 'lucide-react';

const FeaturesBento = () => {
  // Easter egg: interactive draggable polygon vertices
  const [zoneAPoints, setZoneAPoints] = useState([
    { x: 30, y: 35 },
    { x: 155, y: 25 },
    { x: 175, y: 95 },
    { x: 40, y: 90 },
  ]);

  const [zoneBPoints, setZoneBPoints] = useState([
    { x: 300, y: 30 },
    { x: 450, y: 20 },
    { x: 430, y: 95 },
    { x: 280, y: 88 },
  ]);

  const [draggingPoint, setDraggingPoint] = useState(null); // { zone: 'A'|'B', index: number }
  const svgRef = useRef(null);

  // Interactive surveillance schedules
  const [activeDays, setActiveDays] = useState([0, 1, 2, 3, 4]); // Mon-Fri active by default

  const toggleDay = (idx) => {
    setActiveDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  };

  const handleSvgPointerMove = (e) => {
    if (!draggingPoint || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = 500 / rect.width;
    const scaleY = 120 / rect.height;
    const rawX = Math.round((e.clientX - rect.left) * scaleX);
    const rawY = Math.round((e.clientY - rect.top) * scaleY);

    if (draggingPoint.zone === 'A') {
      const clampedX = Math.max(10, Math.min(220, rawX));
      const clampedY = Math.max(10, Math.min(110, rawY));
      setZoneAPoints((prev) =>
        prev.map((pt, i) => (i === draggingPoint.index ? { x: clampedX, y: clampedY } : pt))
      );
    } else {
      const clampedX = Math.max(250, Math.min(490, rawX));
      const clampedY = Math.max(10, Math.min(110, rawY));
      setZoneBPoints((prev) =>
        prev.map((pt, i) => (i === draggingPoint.index ? { x: clampedX, y: clampedY } : pt))
      );
    }
  };

  const handleSvgPointerUp = (e) => {
    if (e && e.target && e.target.releasePointerCapture && e.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* some pointers cannot be captured; dragging still works without it */ }
    }
    setDraggingPoint(null);
  };

  const formatPoints = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <section className="features" id="features" aria-labelledby="features-heading">
      <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div className="features__header animate-fade-up">
          <span className="section-label">Core Capabilities</span>
          <h2 className="section-title" id="features-heading">
            Surveillance without compromise.<br />
            <span className="text-gradient">Nothing hidden. Nothing exposed.</span>
          </h2>
          <p className="section-subtitle">
            myCam was engineered from the ground up for low-latency live monitoring, precision motion detection, and absolute data sovereignty on your own terms.
          </p>
        </div>

        <div className="bento-grid" role="list">
          {/* Card 1 - Zero-Latency WebRTC Streaming (span 5) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--blue" aria-hidden="true">
              <Radio size={22} />
            </div>
            <div className="bento-card__tag">Ultra-Low Latency</div>
            <h3 className="bento-card__title">Direct WebRTC Streaming</h3>
            <p className="bento-card__desc">
              Peer-to-peer browser video delivery eliminates intermediate server encoding lag. Sub-second live feeds allow you to see what is happening as it happens, not 15 seconds later.
            </p>

            {/* Transmission Delay Comparison Gauge */}
            <div className="bento-demo-box" style={{ marginTop: '1.25rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Transmission Latency
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  42 ms P2P Direct
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>myCam WebRTC</span>
                    <span style={{ color: 'var(--accent-emerald)', fontFamily: 'monospace' }}>42 ms</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: '12%', height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)', borderRadius: '3px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Cloud Relay Camera</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>1,850 ms (44x slower)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: '88%', height: '100%', background: 'rgba(239, 68, 68, 0.5)', borderRadius: '3px' }}></div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '6px', fontFamily: 'monospace' }}>
                <span>Jitter: 1.2ms</span>
                <span>Loss: 0.0%</span>
                <span style={{ color: 'var(--accent-blue-light)' }}>DTLS-SRTP</span>
              </div>
            </div>
          </article>

          {/* Card 2 - Smart Polygon Activity Zones (span 7 - Aligned & Draggable Easter Egg!) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--purple" aria-hidden="true">
              <Activity size={22} />
            </div>
            <div className="bento-card__tag">Precision Detection</div>
            <h3 className="bento-card__title">Smart Polygon Activity Zones</h3>
            <p className="bento-card__desc">
              Draw custom multi-point detection boundaries directly over high-risk regions. Filter out tree branches and highway traffic while triggering instant high-priority alerts only where security matters.
            </p>

            {/* Interactive Surveillance Canvas */}
            <div className="bento-demo-box">
              <div className="bento-demo-canvas">
                {/* Subtle grid backdrop */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                ></div>

                {/* Zone Labels Aligned directly above each respective polygon */}
                <div style={{ position: 'absolute', top: '8px', left: '4%', zIndex: 10 }}>
                  <span style={{ fontSize: '0.62rem', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    ZONE A: ENTRANCE
                  </span>
                </div>

                <div style={{ position: 'absolute', top: '8px', left: '56%', zIndex: 10 }}>
                  <span style={{ fontSize: '0.62rem', background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    ZONE B: PERIMETER
                  </span>
                </div>

                {/* Interactive SVG Canvas with touchAction: none and large touch targets */}
                <svg
                  ref={svgRef}
                  viewBox="0 0 500 120"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    cursor: draggingPoint ? 'grabbing' : 'crosshair',
                    touchAction: 'none',
                  }}
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}
                  onPointerCancel={handleSvgPointerUp}
                  onMouseMove={handleSvgPointerMove}
                  onMouseUp={handleSvgPointerUp}
                >
                  {/* Zone A Polygon (Entrance) */}
                  <polygon
                    points={formatPoints(zoneAPoints)}
                    fill="rgba(59, 130, 246, 0.22)"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                  {zoneAPoints.map((pt, i) => (
                    <g key={`za-${i}`}>
                      {/* Generous touch target */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="16"
                        fill="transparent"
                        style={{ cursor: 'grab', touchAction: 'none' }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try { e.target.setPointerCapture(e.pointerId); } catch { /* some pointers cannot be captured; dragging still works without it */ }
                          setDraggingPoint({ zone: 'A', index: i });
                        }}
                        onPointerUp={handleSvgPointerUp}
                        onPointerCancel={handleSvgPointerUp}
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5.5"
                        fill="#3b82f6"
                        stroke="#fff"
                        strokeWidth="1.5"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  ))}

                  {/* Zone B Polygon (Perimeter) - With generous horizontal distance */}
                  <polygon
                    points={formatPoints(zoneBPoints)}
                    fill="rgba(16, 185, 129, 0.2)"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                  {zoneBPoints.map((pt, i) => (
                    <g key={`zb-${i}`}>
                      {/* Generous touch target */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="16"
                        fill="transparent"
                        style={{ cursor: 'grab', touchAction: 'none' }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try { e.target.setPointerCapture(e.pointerId); } catch { /* some pointers cannot be captured; dragging still works without it */ }
                          setDraggingPoint({ zone: 'B', index: i });
                        }}
                        onPointerUp={handleSvgPointerUp}
                        onPointerCancel={handleSvgPointerUp}
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="5.5"
                        fill="#10b981"
                        stroke="#fff"
                        strokeWidth="1.5"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  ))}
                </svg>

                <div style={{ position: 'absolute', bottom: '8px', right: '10px', zIndex: 10 }}>
                  <span className="canvas-hint-pill">
                    Drag vertices to adjust
                  </span>
                </div>
              </div>

              {/* Status Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--accent-blue-light)' }}>
                    Humanoid AI Filter
                  </span>
                  <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--accent-emerald)' }}>
                    Zero False Alarms
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Sensitivity: 92%
                </span>
              </div>
            </div>
          </article>

          {/* Card 3 - Multi-Camera Grid (span 4) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--cyan" aria-hidden="true">
              <LayoutGrid size={22} />
            </div>
            <div className="bento-card__tag">Unified Console</div>
            <h3 className="bento-card__title">Multi-Camera Grid</h3>
            <p className="bento-card__desc">
              Monitor 1 to 16 cameras simultaneously in a responsive grid. Toggle PTZ pan-tilt-zoom, inspect live bitrates, and trigger full-screen focus modes with a single click.
            </p>
            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              <div style={{ height: '36px', borderRadius: '6px', background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-primary)' }}>CAM 01</span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
              </div>
              <div style={{ height: '36px', borderRadius: '6px', background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-primary)' }}>CAM 02</span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
              </div>
            </div>
          </article>

          {/* Card 4 - Automated Scheduling (span 4 - Interactive day selection!) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--emerald" aria-hidden="true">
              <Calendar size={22} />
            </div>
            <div className="bento-card__tag">Automation</div>
            <h3 className="bento-card__title">Surveillance Schedules</h3>
            <p className="bento-card__desc">
              Define recurring 7-day arming matrices. Automatically trigger continuous recording during business hours and shift to motion-only detection during quiet night windows.
            </p>
            {/* Interactive Day Selection - Easter Egg */}
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 5 }}>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                  const isActive = activeDays.includes(idx);
                  return (
                    <motion.button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDay(idx);
                      }}
                      whileTap={{ scale: 0.88 }}
                      whileHover={{ scale: 1.08 }}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '7px 0',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                        background: isActive ? 'rgba(16, 185, 129, 0.22)' : 'var(--bg-secondary)',
                        border: isActive ? '1px solid rgba(16, 185, 129, 0.55)' : '1px solid var(--border)',
                        color: isActive ? '#10b981' : 'var(--text-secondary)',
                        boxShadow: isActive ? '0 0 10px rgba(16, 185, 129, 0.25)' : 'none',
                      }}
                      title={`${isActive ? 'Armed' : 'Disarmed'} · Click to toggle`}
                    >
                      {day}
                    </motion.button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeDays.length > 0 ? '#10b981' : '#ef4444' }}></span>
                  {activeDays.length} Days Armed
                </span>
                <span style={{ color: activeDays.length > 0 ? '#10b981' : '#ef4444' }}>
                  {activeDays.length > 0 ? 'Schedule Active' : 'All Days Inactive'}
                </span>
              </div>
            </div>
          </article>

          {/* Card 5 - High-Speed Recording Library (span 4) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--orange" aria-hidden="true">
              <Film size={22} />
            </div>
            <div className="bento-card__tag">Footage Archive</div>
            <h3 className="bento-card__title">Indexed Recording Library</h3>
            <p className="bento-card__desc">
              Instant visual playback with thumbnail generation, timeline scrubbing, date filters, and batch MP4 export without waiting for cloud re-encoding.
            </p>
            <div style={{ marginTop: '1rem', padding: '8px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>00:00</span>
                <span style={{ color: '#fb923c', fontWeight: 600 }}>Breach 14:22</span>
                <span>24:00</span>
              </div>
              <div style={{ position: 'relative', width: '100%', height: '8px', borderRadius: '4px', background: 'var(--border)' }}>
                <div style={{ position: 'absolute', left: '55%', width: '6px', height: '100%', background: '#fb923c', borderRadius: '2px' }}></div>
              </div>
            </div>
          </article>

          {/* Card 6 - Instant Motion Alerts (span 7) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--blue" aria-hidden="true">
              <Bell size={22} />
            </div>
            <div className="bento-card__tag">Real-Time Alerts</div>
            <h3 className="bento-card__title">Edge Motion Notification</h3>
            <p className="bento-card__desc">
              Receive immediate desktop browser push notifications, sound chimes, and webhook alerts the millisecond an activity zone boundary is breached.
            </p>
            <div
              style={{
                marginTop: '1.25rem',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <Bell size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Breach Alert: Zone A Entrance</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Human motion detected &middot; 0.04s latency</div>
                </div>
              </div>
              <span style={{ fontSize: '0.65rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', fontWeight: 600 }}>
                View Feed
              </span>
            </div>
          </article>

          {/* Card 7 - Mobile Phone Broadcaster (span 5) */}
          <article className="bento-card" role="listitem">
            <div className="bento-card__icon bento-card__icon--pink" aria-hidden="true">
              <Smartphone size={22} />
            </div>
            <div className="bento-card__tag">Zero New Hardware</div>
            <h3 className="bento-card__title">Instant Phone Broadcaster</h3>
            <p className="bento-card__desc">
              Turn any old smartphone, tablet, or spare USB webcam into an HD security camera with audio simply by opening a secure broadcaster link in the browser.
            </p>
            <div style={{ marginTop: '1.25rem', padding: '10px', borderRadius: '8px', background: 'rgba(244, 114, 182, 0.08)', border: '1px solid rgba(244, 114, 182, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge-dot" style={{ background: '#f472b6' }}></span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>Live Broadcaster Ready</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#f472b6', fontFamily: 'monospace' }}>1080p @ 60fps</span>
            </div>
          </article>

          {/* Card 8 - Full Width: Distributed Storage & Cloud Backup (span 12 - 2x2 Symmetric Layout!) */}
          <article
            className="bento-card bento-card--full"
            role="listitem"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
            }}
          >
            <div>
              <div className="bento-card__icon bento-card__icon--purple" aria-hidden="true">
                <Server size={22} />
              </div>
              <div className="bento-card__tag">Data Sovereignty</div>
              <h3 className="bento-card__title">Local Hardware + Cloud Hybrid Storage</h3>
              <p className="bento-card__desc" style={{ maxWidth: '52ch' }}>
                Store footage locally on internal storage, network-attached drives (NAS), or mirror encrypted snapshots to S3-compatible cloud storage. You control data quotas, retention timelines, and automated cleanup policies.
              </p>
            </div>

            {/* 2x2 Perfectly Symmetric Grid of 4 Elements */}
            <div
              className="data-sovereignty-grid"
              aria-hidden="true"
            >
              <div className="data-sov-box">
                <div className="metric-val" style={{ color: 'var(--accent-blue)' }}>Local First</div>
                <div className="metric-lbl">NAS / Direct Disk</div>
              </div>
              <div className="data-sov-box">
                <div className="metric-val" style={{ color: 'var(--accent-emerald)' }}>S3 Compatible</div>
                <div className="metric-lbl">Encrypted Cloud Sync</div>
              </div>
              <div className="data-sov-box">
                <div className="metric-val" style={{ color: 'var(--accent-cyan)' }}>100%</div>
                <div className="metric-lbl">Data Ownership</div>
              </div>
              <div className="data-sov-box">
                <div className="metric-val" style={{ color: 'var(--accent-purple-light)' }}>Zero Relay</div>
                <div className="metric-lbl">Direct P2P Pipe</div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default FeaturesBento;
