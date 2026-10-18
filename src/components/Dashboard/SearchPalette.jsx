import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Camera,
  Video,
  ListChecks,
  Clock,
  Activity,
  Users,
  Settings,
  X,
  ArrowRight,
  History,
  Sun,
  Moon,
  Trash2,
  Sparkles,
  ShieldCheck,
  HardDrive,
  User,
  RadioTower,
  HelpCircle,
  FileText,
  BellRing,
} from 'lucide-react';
import { API_BASE } from '../../config';
import { authFetch } from '../../lib/api';
import useDismiss from '../../hooks/useDismiss';

const RECENT_KEY = 'mycam_recent_searches';
const MAX_RECENT = 6;

const STATIC_PAGES = [
  { id: 'cameras', label: 'Cameras', group: 'Monitoring', icon: Camera, desc: 'Real-time multi-camera video feeds and live WebRTC grid' },
  { id: 'recordings', label: 'Recordings', group: 'Monitoring', icon: Video, desc: 'Indexed security video archive, download clips and playback' },
  { id: 'events', label: 'Event Timeline', group: 'Monitoring', icon: ListChecks, desc: 'Chronological timeline of motion detection and security alerts' },
  { id: 'schedules', label: 'Schedules', group: 'Monitoring', icon: Clock, desc: 'Time-based automated recording schedules and armed hours' },
  { id: 'activity', label: 'Activity Zones', group: 'Monitoring', icon: Activity, desc: 'Draw custom motion detection boundary polygons' },
  { id: 'broadcast', label: 'Broadcaster', group: 'Monitoring', icon: Users, desc: 'Stream video from this device as a live security camera' },
  { id: 'settings', label: 'Settings', group: 'Preferences', icon: Settings, desc: 'Account credentials, alert preferences, and storage management' },
];

const STATIC_TOPICS = [
  {
    id: 'topic-webrtc',
    title: 'Zero-Latency WebRTC Streaming',
    subtitle: 'Peer-to-peer live camera feeds without middleman streaming lag',
    target: 'cameras',
    icon: Camera,
    badge: 'Technology',
  },
  {
    id: 'topic-privacy',
    title: 'Data Sovereignty & Local Storage',
    subtitle: 'All video footage and credentials are saved locally on your hardware',
    target: 'settings',
    icon: ShieldCheck,
    badge: 'Security',
  },
  {
    id: 'topic-zones',
    title: 'Activity Zone Motion Calibration',
    subtitle: 'How to draw polygon sensitivity boundaries to filter out false alerts',
    target: 'activity',
    icon: Activity,
    badge: 'Guide',
  },
  {
    id: 'topic-schedules',
    title: 'Automated Arming & Schedules',
    subtitle: 'Configure weekly active recording hours and automatic motion armed states',
    target: 'schedules',
    icon: Clock,
    badge: 'Guide',
  },
  {
    id: 'topic-storage',
    title: 'Storage Quota & Retention Policy',
    subtitle: 'Manage local disk space, recording limits, and video format retention',
    target: 'settings',
    icon: HardDrive,
    badge: 'Storage',
  },
  {
    id: 'topic-alerts',
    title: 'Alert Preferences (Motion, Toasts, System Notifications)',
    subtitle: 'Customize notification channels, browser permission, and event sounds',
    target: 'settings',
    icon: BellRing,
    badge: 'Preferences',
  },
  {
    id: 'topic-profile',
    title: 'Account Credentials & Profile',
    subtitle: 'Change display name, username, email address, or profile picture',
    target: 'settings',
    icon: User,
    badge: 'Account',
  },
];

const SearchPalette = ({
  searchQuery,
  onSearch,
  onNavigate,
  onSelectCamera,
  onSelectRecording,
  onClearAlerts,
  currentTheme,
  onToggleTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'cameras' | 'recordings' | 'events' | 'schedules' | 'zones' | 'pages' | 'actions'
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // Remote indexed data
  const [remoteCameras, setRemoteCameras] = useState([]);
  const [remoteRecordings, setRemoteRecordings] = useState([]);
  const [remoteEvents, setRemoteEvents] = useState([]);
  const [remoteSchedules, setRemoteSchedules] = useState([]);
  const [remoteZones, setRemoteZones] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useDismiss(containerRef, isOpen, () => setIsOpen(false));

  const saveRecent = useCallback((query) => {
    const q = (query || '').trim();
    if (!q || q.length < 2) return;
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignore */
    }
    setRecentSearches([]);
  }, []);

  // Comprehensive fetch across all API resources on the site
  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [camRes, recRes, alertRes, schedRes, zoneRes] = await Promise.allSettled([
        authFetch(`${API_BASE}/api/cameras`),
        authFetch(`${API_BASE}/api/recordings`),
        authFetch(`${API_BASE}/api/alerts?limit=50`),
        authFetch(`${API_BASE}/api/schedules`),
        authFetch(`${API_BASE}/api/zones`),
      ]);

      if (camRes.status === 'fulfilled' && camRes.value.ok) {
        const data = await camRes.value.json();
        if (Array.isArray(data)) setRemoteCameras(data);
      }

      if (recRes.status === 'fulfilled' && recRes.value.ok) {
        const data = await recRes.value.json();
        if (Array.isArray(data)) setRemoteRecordings(data);
      }

      if (alertRes.status === 'fulfilled' && alertRes.value.ok) {
        const data = await alertRes.value.json();
        if (Array.isArray(data)) setRemoteEvents(data);
      }

      if (schedRes.status === 'fulfilled' && schedRes.value.ok) {
        const data = await schedRes.value.json();
        if (Array.isArray(data)) setRemoteSchedules(data);
      }

      if (zoneRes.status === 'fulfilled' && zoneRes.value.ok) {
        const data = await zoneRes.value.json();
        if (Array.isArray(data)) setRemoteZones(data);
      }
    } catch {
      /* fallback gracefully */
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchData();
    }
  }, [isOpen, fetchData]);

  // Global keyboard shortcuts: "/" and "Ctrl+K" or "Cmd+K"
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      if ((e.key === '/' && !isInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Build Comprehensive Search Results
  const results = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const list = [];

    // 1. Pages Navigation
    if (filter === 'all' || filter === 'pages') {
      STATIC_PAGES.forEach((page) => {
        if (!q || page.label.toLowerCase().includes(q) || page.desc.toLowerCase().includes(q) || page.group.toLowerCase().includes(q)) {
          list.push({
            type: 'page',
            id: `page-${page.id}`,
            title: page.label,
            subtitle: `${page.group} · ${page.desc}`,
            icon: page.icon,
            badge: 'Page',
            action: () => {
              onNavigate?.(page.id);
              saveRecent(page.label);
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 2. Cameras
    if (filter === 'all' || filter === 'cameras') {
      remoteCameras.forEach((cam) => {
        const name = cam.name || `Camera ${cam.id}`;
        const camIdStr = String(cam.id || '');
        if (!q || name.toLowerCase().includes(q) || camIdStr.includes(q)) {
          list.push({
            type: 'camera',
            id: `cam-${cam.id}`,
            title: name,
            subtitle: `Camera ID #${cam.id} · Live WebRTC Feed`,
            icon: Camera,
            badge: cam.isOnline ? 'Online' : 'Offline',
            action: () => {
              onNavigate?.('cameras');
              onSelectCamera?.(cam);
              saveRecent(name);
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 3. Recordings
    if (filter === 'all' || filter === 'recordings') {
      remoteRecordings.forEach((rec) => {
        const title = rec.title || rec.filename || `Recording ${rec.id}`;
        const camName = rec.cameraName || `Camera ${rec.cameraId || ''}`;
        if (!q || title.toLowerCase().includes(q) || camName.toLowerCase().includes(q)) {
          list.push({
            type: 'recording',
            id: `rec-${rec.id}`,
            title,
            subtitle: `${camName} · ${rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : 'Archived Video'}`,
            icon: Video,
            badge: rec.duration ? `${rec.duration}s` : 'Recording',
            action: () => {
              onNavigate?.('recordings');
              onSelectRecording?.(rec.id);
              saveRecent(title);
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 4. Events / Timeline Alerts
    if (filter === 'all' || filter === 'events') {
      remoteEvents.forEach((evt) => {
        const msg = evt.message || 'Security event';
        const typeStr = evt.type || 'activity';
        if (!q || msg.toLowerCase().includes(q) || typeStr.toLowerCase().includes(q)) {
          list.push({
            type: 'event',
            id: `evt-${evt.id}`,
            title: msg,
            subtitle: `Event Timeline · ${evt.timestamp ? new Date(evt.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Logged'}`,
            icon: ListChecks,
            badge: typeStr.toUpperCase(),
            action: () => {
              onNavigate?.('events');
              saveRecent(msg.slice(0, 30));
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 5. Schedules
    if (filter === 'all' || filter === 'schedules') {
      remoteSchedules.forEach((sch) => {
        const name = sch.name || `Schedule ${sch.id}`;
        const days = Array.isArray(sch.days) ? sch.days.join(', ') : 'Weekly';
        if (!q || name.toLowerCase().includes(q) || days.toLowerCase().includes(q)) {
          list.push({
            type: 'schedule',
            id: `sch-${sch.id}`,
            title: name,
            subtitle: `Schedules · ${sch.startTime || '00:00'} - ${sch.endTime || '23:59'} (${days})`,
            icon: Clock,
            badge: sch.enabled !== false ? 'Active' : 'Disabled',
            action: () => {
              onNavigate?.('schedules');
              saveRecent(name);
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 6. Activity Zones
    if (filter === 'all' || filter === 'zones') {
      remoteZones.forEach((zn) => {
        const name = zn.name || `Zone ${zn.id}`;
        if (!q || name.toLowerCase().includes(q)) {
          list.push({
            type: 'zone',
            id: `zn-${zn.id}`,
            title: name,
            subtitle: `Activity Zone · Sensitivity ${zn.sensitivity || 'Default'}%`,
            icon: Activity,
            badge: 'Zone',
            action: () => {
              onNavigate?.('activity');
              saveRecent(name);
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 7. Settings & Platform Topics
    if (filter === 'all' || filter === 'settings') {
      STATIC_TOPICS.forEach((topic) => {
        if (!q || topic.title.toLowerCase().includes(q) || topic.subtitle.toLowerCase().includes(q) || topic.badge.toLowerCase().includes(q)) {
          list.push({
            type: 'topic',
            id: topic.id,
            title: topic.title,
            subtitle: topic.subtitle,
            icon: topic.icon,
            badge: topic.badge,
            action: () => {
              onNavigate?.(topic.target);
              saveRecent(topic.title);
              setIsOpen(false);
            },
          });
        }
      });
    }

    // 8. Quick Actions
    if (filter === 'all' || filter === 'actions') {
      const actions = [
        {
          id: 'action-test-alert',
          title: 'Send Test Alert Notification',
          subtitle: 'Dispatch a real system alert to verify toasts and bell badge',
          icon: BellRing,
          badge: 'Test Tool',
          action: async () => {
            try {
              await authFetch(`${API_BASE}/api/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'activity',
                  message: 'Security test alert triggered via Search Command Palette!',
                  cameraId: 'system'
                })
              });
            } catch (e) {
              console.error(e);
            }
            setIsOpen(false);
          },
        },
        {
          id: 'action-broadcast',
          title: 'Start Camera Broadcaster',
          subtitle: 'Stream video from this device as a live security camera',
          icon: Users,
          badge: 'Broadcast',
          action: () => {
            onNavigate?.('broadcast');
            setIsOpen(false);
          },
        },
        {
          id: 'action-zones',
          title: 'Create Activity Zone',
          subtitle: 'Draw custom motion detection boundary polygons',
          icon: Activity,
          badge: 'Zones',
          action: () => {
            onNavigate?.('activity');
            setIsOpen(false);
          },
        },
        {
          id: 'action-schedule',
          title: 'Add Recording Schedule',
          subtitle: 'Automate surveillance hours and motion armed states',
          icon: Clock,
          badge: 'Schedules',
          action: () => {
            onNavigate?.('schedules');
            setIsOpen(false);
          },
        },
        {
          id: 'action-theme',
          title: currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
          subtitle: 'Toggle dashboard appearance theme',
          icon: currentTheme === 'light' ? Moon : Sun,
          badge: 'Appearance',
          action: () => {
            onToggleTheme?.();
            setIsOpen(false);
          },
        },
      ];

      if (onClearAlerts) {
        actions.push({
          id: 'action-clear-alerts',
          title: 'Clear All Alert History',
          subtitle: 'Remove cached security events and alert notifications',
          icon: Trash2,
          badge: 'Cleanup',
          action: () => {
            onClearAlerts();
            setIsOpen(false);
          },
        });
      }

      actions.forEach((act) => {
        if (!q || act.title.toLowerCase().includes(q) || act.subtitle.toLowerCase().includes(q)) {
          list.push({
            type: 'action',
            id: act.id,
            title: act.title,
            subtitle: act.subtitle,
            icon: act.icon,
            badge: act.badge,
            action: act.action,
          });
        }
      });
    }

    return list;
  }, [searchQuery, filter, remoteCameras, remoteRecordings, remoteEvents, remoteSchedules, remoteZones, currentTheme, onNavigate, onSelectCamera, onSelectRecording, onToggleTheme, onClearAlerts, saveRecent]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, filter]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) {
        results[activeIndex].action();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Search Input Bar */}
      <div className="relative flex items-center w-full">
        <Search className="absolute left-3.5 size-4 text-fg-muted pointer-events-none" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search cameras, recordings, pages, settings… (/)"
          aria-label="Comprehensive Global Search"
          aria-expanded={isOpen}
          className="w-full rounded-full border border-border bg-surface/70 py-2 pl-9 pr-14 text-xs font-medium text-fg placeholder:text-fg-subtle transition-all duration-200 hover:border-accent/40 hover:bg-surface-hover focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20"
        />

        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearch('')}
            className="absolute right-3 p-0.5 text-fg-muted hover:text-fg"
            aria-label="Clear search text"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <div className="absolute right-3 hidden items-center gap-1 sm:flex pointer-events-none">
            <kbd className="inline-flex items-center rounded border border-border/80 bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fg-muted shadow-sm">
              /
            </kbd>
          </div>
        )}
      </div>

      {/* Comprehensive Command Palette Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Search results and quick navigation"
          className="popover absolute left-0 right-0 top-full z-50 mt-2 max-h-[500px] w-full min-w-[340px] md:min-w-[480px] animate-fade-up overflow-hidden rounded-2xl border border-border-strong/70 bg-surface/95 shadow-2xl backdrop-blur-2xl"
        >
          {/* Filter Chips Bar */}
          <div className="flex items-center gap-1 border-b border-border/70 px-3 py-2 overflow-x-auto text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle font-mono mr-1">
              Filter:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'cameras', label: 'Cameras' },
              { id: 'recordings', label: 'Recordings' },
              { id: 'events', label: 'Events' },
              { id: 'schedules', label: 'Schedules' },
              { id: 'zones', label: 'Zones' },
              { id: 'settings', label: 'Settings' },
              { id: 'actions', label: 'Actions' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-accent text-white shadow-sm shadow-accent/30 font-semibold'
                    : 'text-fg-muted hover:bg-surface-hover hover:text-fg'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Results List Area */}
          <div ref={listRef} className="max-h-[350px] overflow-y-auto p-2 space-y-1">
            {/* Recent Searches Header */}
            {!searchQuery && recentSearches.length > 0 && filter === 'all' && (
              <div className="mb-2">
                <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-fg-subtle">
                  <span className="flex items-center gap-1.5">
                    <History className="size-3 text-accent" /> Recent Searches
                  </span>
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="hover:text-danger text-[10px] font-medium transition-colors"
                  >
                    Clear history
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-2 py-1">
                  {recentSearches.map((term, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSearch(term)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] text-fg-muted hover:border-accent/40 hover:bg-surface-hover hover:text-fg transition-all"
                    >
                      <span>{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results Output */}
            {results.length === 0 ? (
              <div className="py-8 text-center">
                <Search className="mx-auto size-7 text-fg-subtle/50 mb-2" />
                <p className="text-xs font-semibold text-fg">No results found for &ldquo;{searchQuery}&rdquo;</p>
                <p className="text-[11px] text-fg-muted mt-0.5">Try searching for camera names, recordings, events, schedules, or settings.</p>
              </div>
            ) : (
              results.map((item, idx) => {
                const ItemIcon = item.icon || Sparkles;
                const isSelected = idx === activeIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-accent/15 border border-accent/40 text-fg shadow-sm'
                        : 'border border-transparent hover:bg-surface-hover text-fg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-accent/60 bg-accent text-white shadow-sm'
                            : 'border-border bg-surface text-fg-muted group-hover:border-accent/30 group-hover:text-accent'
                        }`}
                      >
                        <ItemIcon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-xs font-semibold ${isSelected ? 'text-fg' : 'text-fg group-hover:text-accent'}`}>
                          {item.title}
                        </p>
                        <p className="truncate text-[11px] text-fg-muted">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.badge && (
                        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-mono font-medium text-fg-muted">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight className={`size-3.5 transition-transform ${isSelected ? 'text-accent translate-x-0.5' : 'text-fg-subtle/40'}`} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Palette Footer Shortcuts */}
          <div className="flex items-center justify-between border-t border-border/70 bg-surface-sunken/60 px-3 py-2 text-[10px] font-medium text-fg-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface px-1 font-mono">↑</kbd>
                <kbd className="rounded border border-border bg-surface px-1 font-mono">↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface px-1 font-mono">↵</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface px-1 font-mono">esc</kbd>
                <span>close</span>
              </span>
            </div>
            <span className="font-mono text-accent">myCam Comprehensive Search</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPalette;
