import React, { useState, useRef } from 'react';
import {
  LayoutGrid,
  Activity,
  Film,
  Play,
  Pause,
  Camera,
  Sliders,
  Maximize2,
  Download,
  Clock,
  Disc,
  RefreshCw,
  CheckCircle2,
  Check,
  X,
  FastForward,
  Shield,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_ZONE1 = [
  { x: 50, y: 50 },
  { x: 270, y: 40 },
  { x: 290, y: 190 },
  { x: 60, y: 200 },
];

const INITIAL_ZONE2 = [
  { x: 420, y: 50 },
  { x: 640, y: 40 },
  { x: 660, y: 190 },
  { x: 430, y: 200 },
];

const RECORDINGS_DATA = [
  {
    id: 'rec-01',
    camera: 'Cam 01 · Main Entrance',
    type: 'motion',
    typeLabel: 'Motion Breach',
    typeColor: '#ef4444',
    time: '14:22:10 Today',
    duration: '00:48',
    size: '14.2 MB',
    resolution: '1080p @ 30fps',
    zone: 'Zone 1 (Entrance)',
    confidence: '96%',
  },
  {
    id: 'rec-02',
    camera: 'Cam 02 · Driveway East',
    type: 'scheduled',
    typeLabel: 'Scheduled Block',
    typeColor: '#f59e0b',
    time: '12:00:00 Today',
    duration: '05:00',
    size: '88.4 MB',
    resolution: '720p @ 30fps',
    zone: 'Full Field',
    confidence: '100%',
  },
  {
    id: 'rec-03',
    camera: 'Cam 02 · Driveway East',
    type: 'motion',
    typeLabel: 'Vehicle Alert',
    typeColor: '#60a5fa',
    time: '09:15:32 Today',
    duration: '01:12',
    size: '22.0 MB',
    resolution: '720p @ 30fps',
    zone: 'Driveway Zone',
    confidence: '91%',
  },
  {
    id: 'rec-04',
    camera: 'Cam 03 · Backyard Patio',
    type: 'manual',
    typeLabel: 'Manual Save',
    typeColor: '#10b981',
    time: '07:45:11 Today',
    duration: '02:30',
    size: '45.1 MB',
    resolution: '1080p @ 30fps',
    zone: 'Backyard Zone',
    confidence: 'User Triggered',
  },
  {
    id: 'rec-05',
    camera: 'Cam 01 · Main Entrance',
    type: 'motion',
    typeLabel: 'Motion Breach',
    typeColor: '#ef4444',
    time: 'Yesterday 23:41:04',
    duration: '00:34',
    size: '10.8 MB',
    resolution: '1080p @ 30fps',
    zone: 'Zone 1 (Entrance)',
    confidence: '94%',
  },
  {
    id: 'rec-06',
    camera: 'Cam 03 · Backyard Patio',
    type: 'scheduled',
    typeLabel: 'Scheduled Block',
    typeColor: '#f59e0b',
    time: 'Yesterday 20:00:00',
    duration: '10:00',
    size: '182.0 MB',
    resolution: '1080p @ 30fps',
    zone: 'Patio Perimeter',
    confidence: '100%',
  },
];

const ProductPreview = () => {
  const [activeTab, setActiveTab] = useState('grid');
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Interactive Live Monitoring Console controls
  const [gridFeeds, setGridFeeds] = useState(3); // 1 | 2 | 3 feeds
  const [snapshotAlert, setSnapshotAlert] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Interactive Polygon Zone Calibration controls
  const [zone1Pts, setZone1Pts] = useState(INITIAL_ZONE1);
  const [zone2Pts, setZone2Pts] = useState(INITIAL_ZONE2);
  const [draggingNode, setDraggingNode] = useState(null); // { zone: 1|2, index: number }
  const [aiFilters, setAiFilters] = useState({ humans: true, vehicles: true, pets: false });
  const [saveStatus, setSaveStatus] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const calSvgRef = useRef(null);

  // Interactive Recording Library controls
  const [selectedClip, setSelectedClip] = useState(null);
  const [isPlayingClip, setIsPlayingClip] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [downloadToast, setDownloadToast] = useState(false);

  const handleCalPointerMove = (e) => {
    if (!draggingNode || !calSvgRef.current) return;
    const rect = calSvgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = 700 / rect.width;
    const scaleY = 240 / rect.height;
    const rawX = Math.round((e.clientX - rect.left) * scaleX);
    const rawY = Math.round((e.clientY - rect.top) * scaleY);

    if (draggingNode.zone === 1) {
      const clampedX = Math.max(15, Math.min(340, rawX));
      const clampedY = Math.max(15, Math.min(225, rawY));
      setZone1Pts((prev) =>
        prev.map((pt, i) => (i === draggingNode.index ? { x: clampedX, y: clampedY } : pt))
      );
    } else {
      const clampedX = Math.max(360, Math.min(685, rawX));
      const clampedY = Math.max(15, Math.min(225, rawY));
      setZone2Pts((prev) =>
        prev.map((pt, i) => (i === draggingNode.index ? { x: clampedX, y: clampedY } : pt))
      );
    }
  };

  const handleCalPointerUp = (e) => {
    if (e && e.target && e.target.releasePointerCapture && e.pointerId !== undefined) {
      try { e.target.releasePointerCapture(e.pointerId); } catch { /* some pointers cannot be captured; dragging still works without it */ }
    }
    setDraggingNode(null);
  };

  const triggerSnapshot = () => {
    setSnapshotFlash(true);
    setSnapshotAlert(true);
    setTimeout(() => setSnapshotFlash(false), 250);
    setTimeout(() => setSnapshotAlert(false), 2600);
  };

  const resetZonePoints = () => {
    setIsResetting(true);
    setZone1Pts(INITIAL_ZONE1);
    setZone2Pts(INITIAL_ZONE2);
    setTimeout(() => setIsResetting(false), 600);
  };

  const saveCalibration = () => {
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2400);
  };

  const triggerDownloadClip = (clip) => {
    setDownloadToast(clip.id);
    setTimeout(() => setDownloadToast(false), 2500);
  };

  const formatPoints = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

  const filteredRecordings = RECORDINGS_DATA.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.type === selectedFilter;
  });

  return (
    <section className="product-preview-section" id="preview" style={{ padding: '5rem 0', position: 'relative' }}>
      <div className="container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div className="features__header" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="section-label">Interactive Console</span>
          <h2 className="section-title">
            Built for operators.<br />
            <span className="text-gradient">Engineered for absolute clarity.</span>
          </h2>
          <p className="section-subtitle" style={{ margin: '0.75rem auto 0', maxWidth: '640px' }}>
            Experience the clean, focused interface of myCam. Switch between the multi-camera monitoring console, precision zone calibration, and the indexed recording archive.
          </p>
        </div>

        {/* Tab Navigation with Animated Sliding Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div className="console-tab-pill-bar" style={{ display: 'inline-flex', gap: '4px', position: 'relative' }}>
            {[
              { id: 'grid', label: 'Surveillance Grid', icon: LayoutGrid },
              { id: 'zones', label: 'Polygon Zone Calibration', icon: Activity },
              { id: 'recordings', label: 'Recording Library', icon: Film },
            ].map(({ id, label, icon }) => {
              const TabIcon = icon;
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  style={{
                    position: 'relative',
                    padding: '8px 18px',
                    fontSize: '0.84rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    zIndex: 1,
                    transition: 'color 0.2s ease',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeConsoleTab"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                        zIndex: -1,
                      }}
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.4 }}
                    />
                  )}
                  <TabIcon size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Terminal/App Frame */}
        <motion.div
          layout
          className="console-frame"
          style={{
            maxWidth: isFocused ? '1200px' : '1080px',
            border: isFocused ? '1px solid rgba(59, 130, 246, 0.6)' : undefined,
          }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Console Header Bar */}
          <div className="console-header-bar">
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <span className="chrome-dot chrome-dot--red"></span>
              <span className="chrome-dot chrome-dot--yellow"></span>
              <span className="chrome-dot chrome-dot--green"></span>
            </div>
            <span className="console-header-title">
              myCam Operating Console &middot;{' '}
              {activeTab === 'grid'
                ? `Surveillance Grid (${gridFeeds === 1 ? '1 Feed' : gridFeeds === 2 ? '2 Feeds' : '3 Feeds Active'})`
                : activeTab === 'zones'
                ? 'Polygon Zone Calibration'
                : 'Footage Archive'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                System Armed
              </span>
            </div>
          </div>

          {/* TAB CONTENT TRANSITIONS */}
          <AnimatePresence mode="wait">
            {/* TAB 1: LIVE MONITORING CONSOLE */}
            {activeTab === 'grid' && (
              <motion.div
                key="grid-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}
              >
                {/* Camera Flash Animation on Snapshot */}
                <AnimatePresence>
                  {snapshotFlash && (
                    <motion.div
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ position: 'absolute', inset: 0, background: '#ffffff', zIndex: 30, borderRadius: '8px', pointerEvents: 'none' }}
                    />
                  )}
                </AnimatePresence>

                {/* Snapshot toast notification */}
                <AnimatePresence>
                  {snapshotAlert && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.96 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.16)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckCircle2 size={16} /> Snapshot saved: cam01_webrtc_capture.png (1080p HD)
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Camera Grid Viewports */}
                <motion.div
                  layout
                  className="console-feeds-grid"
                  data-feeds={gridFeeds}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                >
                  <AnimatePresence mode="popLayout">
                    {/* Tile 1: Cam 01 with Person Detection */}
                    <motion.div
                      layout
                      key="cam-tile-1"
                      className="console-cam-tile"
                      style={{
                        height: gridFeeds === 1 ? '320px' : '190px',
                      }}
                      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    >
                      <div style={{ position: 'absolute', top: '8px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2 }}>
                        <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.25)', color: '#ef4444', fontWeight: 700 }}>
                          REC
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cam 01 &middot; Main Entrance</span>
                      </div>
                      {/* Motion Detection Box: Person */}
                      <div style={{ position: 'absolute', top: '22%', left: '32%', width: '38%', height: '54%', border: '2px dashed #3b82f6', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '4px' }}>
                        <span style={{ position: 'absolute', top: '-18px', left: 0, fontSize: '0.62rem', background: '#3b82f6', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                          PERSON DETECTED 96%
                        </span>
                      </div>
                      <div style={{ position: 'absolute', bottom: '8px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 2 }}>
                        <span style={{ fontFamily: 'monospace' }}>1080p @ 30fps &middot; 4.2 Mbps</span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>WebRTC Direct (38ms)</span>
                      </div>
                    </motion.div>

                    {/* Tile 2: Cam 02 with Vehicle Detection */}
                    {gridFeeds >= 2 && (
                      <motion.div
                        layout
                        key="cam-tile-2"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18, ease: 'easeOut' } }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="console-cam-tile"
                        style={{
                          height: '190px',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                        }}
                      >
                        <div style={{ position: 'absolute', top: '8px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2 }}>
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700 }}>LIVE</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cam 02 &middot; Driveway East</span>
                        </div>
                        {/* Motion Detection Box: Vehicle */}
                        <div style={{ position: 'absolute', top: '25%', left: '24%', width: '52%', height: '50%', border: '2px dashed #f59e0b', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '4px' }}>
                          <span style={{ position: 'absolute', top: '-18px', left: 0, fontSize: '0.62rem', background: '#f59e0b', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            VEHICLE DETECTED 91%
                          </span>
                        </div>
                        <div style={{ position: 'absolute', bottom: '8px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 2 }}>
                          <span style={{ fontFamily: 'monospace' }}>720p @ 30fps &middot; 2.1 Mbps</span>
                          <span style={{ color: '#10b981' }}>Connected</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Tile 3: Cam 03 with Pet Detection */}
                    {gridFeeds >= 3 && (
                      <motion.div
                        layout
                        key="cam-tile-3"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18, ease: 'easeOut' } }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="console-cam-tile"
                        style={{
                          height: '190px',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                        }}
                      >
                        <div style={{ position: 'absolute', top: '8px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2 }}>
                          <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 700 }}>LIVE</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cam 03 &middot; Backyard Patio</span>
                        </div>
                        {/* Motion Detection Box: Pet */}
                        <div style={{ position: 'absolute', top: '30%', left: '28%', width: '44%', height: '46%', border: '2px dashed #10b981', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '4px' }}>
                          <span style={{ position: 'absolute', top: '-18px', left: 0, fontSize: '0.62rem', background: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            PET DETECTED 84%
                          </span>
                        </div>
                        <div style={{ position: 'absolute', bottom: '8px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', zIndex: 2 }}>
                          <span style={{ fontFamily: 'monospace' }}>1080p @ 30fps &middot; 3.8 Mbps</span>
                          <span style={{ color: '#10b981' }}>Connected</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Lower Console Operator Dock */}
                <div className="console-operator-dock">
                  {/* Telemetry info */}
                  <div className="console-operator-telemetry">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge-dot" style={{ background: '#10b981' }}></span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {gridFeeds === 1 ? '1 Focused Feed' : gridFeeds === 2 ? '2 Feeds' : '3 Feeds Active'}
                      </span>
                    </div>
                    <div style={{ height: '16px', width: '1px', background: 'var(--border)' }}></div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      Bitrate: 10.1 Mbps &middot; Drops: 0
                    </span>
                    <div style={{ height: '16px', width: '1px', background: 'var(--border)' }}></div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue-light)', fontFamily: 'monospace' }}>
                      Buffer: 99.8%
                    </span>
                  </div>

                  {/* Operator Actions Strip */}
                  <div className="console-operator-actions">
                    {/* Animated Grid layout switcher */}
                    <div className="console-feed-switcher" style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.05)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)', position: 'relative' }}>
                      {[
                        { count: 1, label: '1 Feed' },
                        { count: 2, label: '2 Feeds' },
                        { count: 3, label: '3 Feeds' },
                      ].map(({ count, label }) => {
                        const isSelected = gridFeeds === count;
                        return (
                          <motion.button
                            key={count}
                            type="button"
                            onClick={() => setGridFeeds(count)}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              position: 'relative',
                              padding: '5px 12px',
                              fontSize: '0.72rem',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                              background: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              zIndex: 1,
                              transition: 'color 0.15s ease',
                            }}
                          >
                            {isSelected && (
                              <motion.div
                                layoutId="activeGridCountPill"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'var(--accent-blue)',
                                  borderRadius: '4px',
                                  zIndex: -1,
                                }}
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                              />
                            )}
                            {label}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Snapshot Button with Tap Feedback */}
                    <motion.button
                      type="button"
                      onClick={triggerSnapshot}
                      whileTap={{ scale: 0.92 }}
                      whileHover={{ scale: 1.02 }}
                      className="btn btn--outline"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px', borderRadius: '6px' }}
                    >
                      <Camera size={14} /> Snapshot
                    </motion.button>

                    {/* Focus Grid Button */}
                    <motion.button
                      type="button"
                      onClick={() => setIsFocused(!isFocused)}
                      whileTap={{ scale: 0.92 }}
                      whileHover={{ scale: 1.02 }}
                      className="btn btn--primary"
                      style={{ padding: '6px 14px', fontSize: '0.75rem', gap: '6px', borderRadius: '6px' }}
                    >
                      <Maximize2 size={14} /> {isFocused ? 'Exit Focus' : 'Focus Grid'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: POLYGON ZONE EDITOR */}
            {activeTab === 'zones' && (
              <motion.div
                key="zones-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <AnimatePresence>
                  {saveStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.96 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.16)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckCircle2 size={16} /> Zone Calibration Saved &bull; 2 Detection Areas Armed
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Surveillance Snapshot & SVG Polygons */}
                <div
                  className="bento-demo-canvas"
                  style={{
                    position: 'relative',
                    height: '260px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  ></div>

                  {/* Labels Aligned Directly Above Each Respective Polygon */}
                  <div style={{ position: 'absolute', top: '12px', left: '4%', zIndex: 10 }}>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: '#3b82f6', color: '#fff', fontWeight: 700 }}>
                      Zone 1: Front Porch Entrance
                    </span>
                  </div>

                  <div style={{ position: 'absolute', top: '12px', left: '55%', zIndex: 10 }}>
                    <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 700 }}>
                      Zone 2: Storage Shed Perimeter
                    </span>
                  </div>

                  {/* Interactive SVG Canvas with touchAction: none and large touch targets */}
                  <svg
                    ref={calSvgRef}
                    viewBox="0 0 700 240"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      cursor: draggingNode ? 'grabbing' : 'crosshair',
                      touchAction: 'none',
                    }}
                    onPointerMove={handleCalPointerMove}
                    onPointerUp={handleCalPointerUp}
                    onPointerCancel={handleCalPointerUp}
                    onMouseMove={handleCalPointerMove}
                    onMouseUp={handleCalPointerUp}
                  >
                    {/* Zone 1 (Entrance) */}
                    <polygon
                      points={formatPoints(zone1Pts)}
                      fill="rgba(59, 130, 246, 0.22)"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                    />
                    {zone1Pts.map((pt, i) => (
                      <g key={`z1-${i}`}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="18"
                          fill="transparent"
                          style={{ cursor: 'grab', touchAction: 'none' }}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try { e.target.setPointerCapture(e.pointerId); } catch { /* some pointers cannot be captured; dragging still works without it */ }
                            setDraggingNode({ zone: 1, index: i });
                          }}
                          onPointerUp={handleCalPointerUp}
                          onPointerCancel={handleCalPointerUp}
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="6"
                          fill="#3b82f6"
                          stroke="#fff"
                          strokeWidth="2"
                          style={{ pointerEvents: 'none' }}
                        />
                      </g>
                    ))}

                    {/* Zone 2 (Storage Shed) */}
                    <polygon
                      points={formatPoints(zone2Pts)}
                      fill="rgba(16, 185, 129, 0.2)"
                      stroke="#10b981"
                      strokeWidth="2.5"
                    />
                    {zone2Pts.map((pt, i) => (
                      <g key={`z2-${i}`}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="18"
                          fill="transparent"
                          style={{ cursor: 'grab', touchAction: 'none' }}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try { e.target.setPointerCapture(e.pointerId); } catch { /* some pointers cannot be captured; dragging still works without it */ }
                            setDraggingNode({ zone: 2, index: i });
                          }}
                          onPointerUp={handleCalPointerUp}
                          onPointerCancel={handleCalPointerUp}
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="6"
                          fill="#10b981"
                          stroke="#fff"
                          strokeWidth="2"
                          style={{ pointerEvents: 'none' }}
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Guidance Pill */}
                  <div style={{ position: 'absolute', bottom: '10px', left: '12px', zIndex: 10 }}>
                    <span className="canvas-hint-pill">
                      Drag vertices to reshape trigger boundaries in real-time
                    </span>
                  </div>
                </div>

                {/* Zone Tuning Toolbar */}
                <div className="console-operator-dock">
                  {/* Single Line AI Filter Checkboxes */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '4px' }}>
                      AI Classifiers:
                    </span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAiFilters((prev) => ({ ...prev, humans: !prev.humans }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: aiFilters.humans ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--border)',
                        background: aiFilters.humans ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        color: aiFilters.humans ? 'var(--accent-blue-light)' : 'var(--text-muted)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {aiFilters.humans ? '✓ Humans' : 'Humans (Off)'}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAiFilters((prev) => ({ ...prev, vehicles: !prev.vehicles }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: aiFilters.vehicles ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid var(--border)',
                        background: aiFilters.vehicles ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                        color: aiFilters.vehicles ? '#f59e0b' : 'var(--text-muted)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {aiFilters.vehicles ? '✓ Vehicles' : 'Vehicles (Off)'}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAiFilters((prev) => ({ ...prev, pets: !prev.pets }))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: aiFilters.pets ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border)',
                        background: aiFilters.pets ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        color: aiFilters.pets ? '#10b981' : 'var(--text-muted)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {aiFilters.pets ? '✓ Pets' : 'Pets (Ignored)'}
                    </motion.button>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <motion.button
                      type="button"
                      onClick={resetZonePoints}
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.02 }}
                      className="btn btn--outline"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', gap: '6px' }}
                    >
                      <motion.div animate={{ rotate: isResetting ? 360 : 0 }} transition={{ duration: 0.5 }}>
                        <RefreshCw size={12} />
                      </motion.div>
                      Reset Points
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={saveCalibration}
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.02 }}
                      className="btn btn--primary"
                      style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '6px', gap: '6px' }}
                    >
                      <Check size={14} /> Save Calibration
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: RECORDING LIBRARY */}
            {activeTab === 'recordings' && (
              <motion.div
                key="recordings-tab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {/* Download Toast Notification */}
                <AnimatePresence>
                  {downloadToast && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.96 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.16)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        color: 'var(--accent-blue-light)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Download size={14} /> Exporting encrypted MP4 recording clip ({downloadToast})...
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Storage Pool Bar */}
                <div className="console-operator-dock" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Disc size={16} style={{ color: 'var(--accent-blue)' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Local Storage Pool &middot; NVMe 500 GB
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      142.4 GB used (28.4%) &middot; Retention: 30 Days Auto-Purge
                    </span>
                  </div>

                  <div>
                    <div style={{ position: 'relative', width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '28.4%', background: 'linear-gradient(90deg, #3b82f6, #10b981)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'monospace' }}>
                      <span>00:00 (Midnight)</span>
                      <span style={{ color: '#ef4444' }}>14:22 Motion Breach</span>
                      <span>23:59 (Armed)</span>
                    </div>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `All Clips (${RECORDINGS_DATA.length})` },
                    { id: 'motion', label: `Motion Breaches (${RECORDINGS_DATA.filter((r) => r.type === 'motion').length})` },
                    { id: 'scheduled', label: `Scheduled (${RECORDINGS_DATA.filter((r) => r.type === 'scheduled').length})` },
                    { id: 'manual', label: `Manual Saves (${RECORDINGS_DATA.filter((r) => r.type === 'manual').length})` },
                  ].map(({ id, label }) => {
                    const isSelected = selectedFilter === id;
                    return (
                      <motion.button
                        key={id}
                        type="button"
                        onClick={() => setSelectedFilter(id)}
                        whileTap={{ scale: 0.95 }}
                        className={`btn btn--sm ${isSelected ? 'btn--primary' : 'btn--outline'}`}
                        style={{ padding: '5px 12px', fontSize: '0.72rem', borderRadius: '6px' }}
                      >
                        {label}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Event Cards Grid */}
                <motion.div
                  layout
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}
                >
                  <AnimatePresence>
                    {filteredRecordings.map((clip) => (
                      <motion.div
                        layout
                        key={clip.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        whileHover={{ y: -3, transition: { duration: 0.2 } }}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          cursor: 'pointer',
                        }}
                        onClick={() => { setSelectedClip(clip); setIsPlayingClip(true); }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: `${clip.typeColor}22`,
                              color: clip.typeColor,
                              fontWeight: 700,
                            }}
                          >
                            {clip.typeLabel}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {clip.time}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {clip.camera}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          <span>Duration: {clip.duration} &middot; {clip.size}</span>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={(e) => { e.stopPropagation(); setSelectedClip(clip); setIsPlayingClip(true); }}
                            className="btn btn--ghost"
                            style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--accent-blue-light)' }}
                          >
                            <Play size={12} style={{ marginRight: '4px' }} /> Inspect
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Interactive Clip Detail & Playback Inspection Drawer */}
                <AnimatePresence>
                  {selectedClip && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        marginTop: '10px',
                        padding: '16px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Film size={16} style={{ color: 'var(--accent-blue)' }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Inspection View: {selectedClip.camera} ({selectedClip.time})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedClip(null); setIsPlayingClip(false); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Timeline Scrubber Mockup */}
                      <div style={{ background: '#070a14', borderRadius: '6px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#93c5fd', fontSize: '0.72rem', marginBottom: '8px', fontFamily: 'monospace' }}>
                          <span>00:14 / {selectedClip.duration}</span>
                          <span>Confidence: {selectedClip.confidence}</span>
                          <span>{selectedClip.resolution}</span>
                        </div>
                        <div style={{ position: 'relative', width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px' }}>
                          <motion.div
                            animate={{ width: isPlayingClip ? '100%' : '35%' }}
                            transition={{ duration: isPlayingClip ? 8 / playbackSpeed : 0.3, ease: 'linear' }}
                            style={{ height: '100%', background: '#3b82f6', borderRadius: '3px' }}
                          />
                        </div>
                      </div>

                      {/* Control Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setIsPlayingClip(!isPlayingClip)}
                            className="btn btn--primary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
                          >
                            {isPlayingClip ? <Pause size={13} /> : <Play size={13} />}
                            {isPlayingClip ? 'Pause' : 'Play Video'}
                          </button>

                          <div style={{ display: 'inline-flex', background: 'rgba(0, 0, 0, 0.06)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
                            {[0.5, 1, 2].map((spd) => (
                              <button
                                key={spd}
                                type="button"
                                onClick={() => setPlaybackSpeed(spd)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.7rem',
                                  fontWeight: playbackSpeed === spd ? 700 : 500,
                                  color: playbackSpeed === spd ? '#ffffff' : 'var(--text-secondary)',
                                  background: playbackSpeed === spd ? 'var(--accent-blue)' : 'transparent',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                }}
                              >
                                {spd}x
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => triggerDownloadClip(selectedClip)}
                          className="btn btn--outline"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '6px' }}
                        >
                          <Download size={13} /> Export MP4 ({selectedClip.size})
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};

export default ProductPreview;
