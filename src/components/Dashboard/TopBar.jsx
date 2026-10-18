import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  Radio,
  ListChecks,
  CheckCheck,
  Trash2,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { API_BASE } from '../../config';
import { useNotifications } from '../../context/NotificationContext';
import { useCameraStatus } from '../../context/CameraStatusContext';
import useDismiss from '../../hooks/useDismiss';
import { findNav } from './navConfig';
import ClockDropdown from './ClockDropdown';
import SearchPalette from './SearchPalette';

const TopBar = ({
  user,
  onLogout,
  onNavigate,
  activeTab,
  searchQuery,
  onSearch,
  menuButtonRef,
  menuOpen,
  onMenuClick,
  onSelectCamera,
  onSelectRecording,
}) => {
  const { events, clearEvents, markAllRead } = useNotifications();
  const { summary } = useCameraStatus();
  const unreadCount = events.filter((e) => !e.read).length;

  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all' | 'unread'
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchMobileOpen, setSearchMobileOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState('');
  const [theme, setTheme] = useState(() => {
    try {
      return document.documentElement.getAttribute('data-theme') || localStorage.getItem('mycam_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const bellRef = useRef(null);
  const bellBtnRef = useRef(null);
  const profileRef = useRef(null);
  const profileBtnRef = useRef(null);
  const menuRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  useDismiss(bellRef, showNotifications, useCallback(() => setShowNotifications(false), []), bellBtnRef);
  useDismiss(profileRef, showProfileMenu, useCallback(() => setShowProfileMenu(false), []), profileBtnRef);

  // Sync theme with document attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('mycam_theme', next);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const current = findNav(activeTab);
  const displayName = user?.name || user?.username || 'Operator';
  const avatarUrl = user?.profile_pic ? `${API_BASE}/uploads/pfps/${user.profile_pic}` : '';
  const avatarFailed = Boolean(avatarUrl) && failedAvatarUrl === avatarUrl;

  const formatEventTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredEvents = useMemo(() => {
    if (notificationFilter === 'unread') {
      return events.filter((e) => !e.read);
    }
    return events;
  }, [events, notificationFilter]);

  const onMenuKeys = (e) => {
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Tab') {
      setShowProfileMenu(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl transition-colors">
      <div className="flex h-[68px] items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
        {/* Left: Mobile hamburger + Clean Page Breadcrumb Title */}
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onMenuClick}
            className="btn btn-ghost btn-icon -ml-2 md:hidden"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
          >
            {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm md:text-[15px] font-semibold text-fg-muted font-display tracking-tight shrink-0">
              {current?.group ?? 'Monitoring'}
            </span>
            <span className="text-sm md:text-base font-light text-border-strong select-none shrink-0">
              /
            </span>
            <h1 className="text-base md:text-lg font-bold text-fg font-display tracking-tight truncate">
              {current?.label ?? 'Cameras'}
            </h1>
          </div>
        </div>

        {/* Center: Desktop Global Command Palette Search */}
        <div className="hidden min-w-0 max-w-md flex-1 md:block">
          <SearchPalette
            searchQuery={searchQuery}
            onSearch={onSearch}
            onNavigate={onNavigate}
            onSelectCamera={onSelectCamera}
            onSelectRecording={onSelectRecording}
            onClearAlerts={clearEvents}
            currentTheme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>

        {/* Right Actions: Clock Pill, Theme Switcher, Notifications Pill, Profile Pill */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2.5">
          {/* 1. Time Pill with Interactive Clock Dropdown */}
          <div className="hidden lg:block">
            <ClockDropdown user={user} />
          </div>

          {/* 2. Mobile Search Button */}
          <button
            type="button"
            onClick={() => setSearchMobileOpen((v) => !v)}
            className="btn btn-ghost btn-icon relative md:hidden size-9 rounded-full border border-border bg-surface/60 hover:bg-surface-hover hover:border-accent/40"
            aria-label="Toggle mobile search"
            aria-expanded={searchMobileOpen}
          >
            <Search className="size-4 text-fg-muted" aria-hidden="true" />
            {searchQuery && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-background" />
            )}
          </button>

          {/* 3. Theme Toggle Button (myCloud style) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon size-9 rounded-full border border-border bg-surface/60 text-fg-muted hover:border-accent/40 hover:bg-surface-hover hover:text-fg transition-all duration-200"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="size-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="size-4 text-indigo-400 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>

          {/* 4. Notification Bell Pill */}
          <div className="relative" ref={bellRef}>
            <button
              ref={bellBtnRef}
              type="button"
              onClick={() => {
                const opening = !showNotifications;
                setShowNotifications(opening);
                setShowProfileMenu(false);
                if (opening) markAllRead();
              }}
              aria-expanded={showNotifications}
              aria-haspopup="dialog"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              className={`btn btn-ghost btn-icon group relative size-9 rounded-full border transition-all duration-200 ${
                showNotifications
                  ? 'border-accent bg-accent/15 text-accent shadow-sm'
                  : 'border-border bg-surface/60 text-fg-muted hover:border-accent/40 hover:bg-surface-hover hover:text-fg'
              }`}
            >
              <Bell className="size-4 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-105" aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse"
                  aria-hidden="true"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Enhanced Notification Dropdown Card */}
            {showNotifications && (
              <div
                role="dialog"
                aria-label="Alerts & Notifications"
                className="popover fixed inset-x-3 top-[4.5rem] z-50 animate-fade-up overflow-hidden rounded-2xl border border-border-strong/70 bg-surface/95 shadow-2xl backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-88"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-fg font-mono">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-accent/20 border border-accent/40 px-2 py-0.5 text-[10px] font-bold text-accent">
                        {unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors"
                        title="Mark all as read"
                      >
                        <CheckCheck className="size-3" /> Mark read
                      </button>
                    )}
                    {events.length > 0 && (
                      <button
                        type="button"
                        onClick={clearEvents}
                        className="text-[11px] font-medium text-fg-muted hover:text-rose-400 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 border-b border-border/60 bg-surface-sunken/40 px-4 py-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setNotificationFilter('all')}
                    className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                      notificationFilter === 'all'
                        ? 'bg-accent/20 text-accent font-semibold'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    All ({events.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationFilter('unread')}
                    className={`rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                      notificationFilter === 'unread'
                        ? 'bg-accent/20 text-accent font-semibold'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                {/* Notification Items List */}
                <div className="max-h-[300px] divide-y divide-border/40 overflow-y-auto p-1.5">
                  {filteredEvents.length === 0 ? (
                    <div className="p-6 text-center">
                      <ShieldCheck className="mx-auto size-8 text-emerald-500/60 mb-2" />
                      <p className="text-xs font-semibold text-fg">Surveillance Perimeter Secure</p>
                      <p className="mt-1 text-[11px] text-fg-muted leading-relaxed">
                        No active security incidents or motion alerts detected. All feeds are nominal.
                      </p>
                    </div>
                  ) : (
                    filteredEvents.map((n) => {
                      const isMotion = n.message?.toLowerCase().includes('motion');
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            setShowNotifications(false);
                            onNavigate?.('events');
                          }}
                          className={`flex items-start gap-3 rounded-xl p-2.5 transition-all cursor-pointer ${
                            !n.read ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-hover'
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border ${
                              isMotion
                                ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                                : 'border-accent/40 bg-accent/15 text-accent'
                            }`}
                          >
                            {isMotion ? <AlertTriangle className="size-3.5" /> : <Activity className="size-3.5" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="break-words text-xs font-semibold text-fg leading-snug">
                              {n.message}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-fg-muted">
                              <span>{formatEventTime(n.timestamp)}</span>
                              {n.cameraId && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-accent">Cam #{n.cameraId}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer link to timeline */}
                <div className="border-t border-border/80 bg-surface-sunken/60 px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate?.('events');
                    }}
                    className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors inline-flex items-center gap-1"
                  >
                    View Complete Event Timeline →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 5. User Profile Dropdown Pill */}
          <div className="relative ml-0.5 md:ml-1" ref={profileRef}>
            <button
              ref={profileBtnRef}
              type="button"
              onClick={() => {
                setShowProfileMenu((v) => !v);
                setShowNotifications(false);
              }}
              aria-expanded={showProfileMenu}
              aria-haspopup="menu"
              aria-label={`Account menu for ${displayName}`}
              className={`flex items-center gap-2.5 rounded-full border p-1 transition-all duration-200 ${
                showProfileMenu
                  ? 'border-accent bg-accent/15 shadow-sm'
                  : 'border-border bg-surface/60 hover:border-accent/40 hover:bg-surface-hover'
              }`}
            >
              <div className="flex size-7.5 md:size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-gradient-to-tr from-accent to-indigo-600 font-bold text-white shadow-sm text-xs">
                {avatarUrl && !avatarFailed ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    onError={() => setFailedAvatarUrl(avatarUrl)}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{(displayName || 'O')[0].toUpperCase()}</span>
                )}
              </div>

              <div className="hidden max-w-32 text-left md:block pr-1">
                <span className="block truncate text-xs font-bold text-fg leading-tight">
                  {displayName}
                </span>
                <span className="block truncate text-[10px] text-accent font-medium leading-none mt-0.5">
                  {user?.username ? `@${user.username}` : 'Operator'}
                </span>
              </div>

              <ChevronDown
                className={`size-3.5 text-fg-muted transition-transform duration-200 mr-1.5 hidden md:block ${
                  showProfileMenu ? 'rotate-180 text-accent' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Enhanced Profile Dropdown Card (myCloud style) */}
            {showProfileMenu && (
              <div
                ref={menuRef}
                role="menu"
                aria-label="Account Menu"
                onKeyDown={onMenuKeys}
                className="popover absolute right-0 top-full z-50 mt-2.5 w-[280px] animate-fade-up overflow-hidden rounded-2xl border border-border-strong/70 bg-surface/95 shadow-2xl backdrop-blur-2xl"
              >
                {/* Profile Header Redesign Banner */}
                <div className="flex flex-col items-center border-b border-border/80 bg-gradient-to-b from-accent/15 via-accent/5 to-transparent p-5 text-center">
                  <div className="relative mb-3 flex size-16 items-center justify-center rounded-full border-2 border-accent/60 bg-gradient-to-tr from-accent to-indigo-600 text-xl font-extrabold text-white shadow-lg shadow-accent/25">
                    {avatarUrl && !avatarFailed ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{(displayName || 'O')[0].toUpperCase()}</span>
                    )}
                    <span
                      className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-surface bg-emerald-500 shadow-sm"
                      title="Online"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-fg tracking-tight">
                    {displayName}
                  </h3>
                  <p className="text-xs text-accent font-medium">
                    {user?.username ? `@${user.username}` : 'Operator'}
                  </p>
                  {user?.email && (
                    <p className="mt-0.5 text-[11px] text-fg-muted truncate max-w-[220px]">
                      {user.email}
                    </p>
                  )}

                  <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-mono font-medium text-accent">
                    mySphere Account · Operator
                  </span>
                </div>

                {/* Quick Status Info Bar */}
                <div className="grid grid-cols-2 divide-x divide-border/60 border-b border-border/60 bg-surface-sunken/40 py-2 text-center text-[11px]">
                  <div>
                    <span className="block text-fg-muted text-[10px]">Cameras</span>
                    <strong className="font-mono text-fg font-bold">{summary.total || 0} feeds</strong>
                  </div>
                  <div>
                    <span className="block text-fg-muted text-[10px]">Security</span>
                    <strong className="text-emerald-400 font-semibold">WebRTC Active</strong>
                  </div>
                </div>

                {/* Profile Actions List */}
                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate?.('settings');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-fg hover:bg-surface-hover hover:text-accent transition-all text-left"
                  >
                    <Settings className="size-4 text-fg-muted" aria-hidden="true" />
                    <span>Profile &amp; Settings</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate?.('broadcast');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-fg hover:bg-surface-hover hover:text-accent transition-all text-left"
                  >
                    <Radio className="size-4 text-fg-muted" aria-hidden="true" />
                    <span>Camera Broadcaster</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate?.('events');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-fg hover:bg-surface-hover hover:text-accent transition-all text-left"
                  >
                    <ListChecks className="size-4 text-fg-muted" aria-hidden="true" />
                    <span>Event Timeline</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleTheme();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-fg hover:bg-surface-hover transition-all text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      {theme === 'dark' ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-indigo-400" />}
                      <span>Theme Mode</span>
                    </span>
                    <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-muted capitalize">
                      {theme}
                    </span>
                  </button>
                </div>

                {/* Sign Out Divider & Button */}
                <div className="border-t border-border/80 p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all text-left"
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay Panel */}
      {searchMobileOpen && (
        <div className="border-t border-border/70 bg-background px-4 py-3 md:hidden animate-fade-in">
          <div className="flex items-center gap-2">
            <SearchPalette
              searchQuery={searchQuery}
              onSearch={onSearch}
              onNavigate={(tab) => {
                onNavigate?.(tab);
                setSearchMobileOpen(false);
              }}
              onSelectCamera={(cam) => {
                onSelectCamera?.(cam);
                setSearchMobileOpen(false);
              }}
              onSelectRecording={(recId) => {
                onSelectRecording?.(recId);
                setSearchMobileOpen(false);
              }}
              onClearAlerts={clearEvents}
              currentTheme={theme}
              onToggleTheme={toggleTheme}
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon size-9 rounded-full shrink-0"
              aria-label="Close mobile search"
              onClick={() => setSearchMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopBar;
