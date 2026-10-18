import React, { useState, useRef, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CameraGrid from './CameraGrid';
import Recordings from './Recordings';
import Events from './Events';
import ActivityZones from './ActivityZones';
import ScheduleManager from './ScheduleManager';
import Settings from './Settings';
import Broadcaster from '../Broadcaster';
import AlertListener from './AlertListener';
import useMediaQuery from '../../hooks/useMediaQuery';

const Dashboard = ({ user, onLogout, onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState('cameras');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  // Collapsed rail by default on tablets/small laptops, expanded from 1024px up.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuButtonRef = useRef(null);

  const closeDrawer = useCallback(() => setMobileOpen(false), []);

  // Close the mobile drawer when crossing into the desktop layout.
  const [prevDesktop, setPrevDesktop] = useState(isDesktop);
  if (isDesktop !== prevDesktop) {
    setPrevDesktop(isDesktop);
    if (isDesktop && mobileOpen) setMobileOpen(false);
  }

  const drawerOpen = mobileOpen && !isDesktop;

  // Restore focus to the menu button once the drawer has closed (after the
  // content area is no longer inert, otherwise focus() is ignored).
  const [linkedRecordingId, setLinkedRecordingId] = useState(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !drawerOpen && !isDesktop) menuButtonRef.current?.focus();
    wasOpen.current = drawerOpen;
  }, [drawerOpen, isDesktop]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-sans text-fg">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <AlertListener />

      <Sidebar
        isDesktop={isDesktop}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={closeDrawer}
        onLogout={onLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* inert while the drawer is open: no focus, clicks or scrolling behind it */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden" inert={drawerOpen}>
        <TopBar
          user={user}
          onLogout={onLogout}
          onNavigate={setActiveTab}
          activeTab={activeTab}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          menuButtonRef={menuButtonRef}
          menuOpen={drawerOpen}
          onMenuClick={() => setMobileOpen((open) => !open)}
          onSelectRecording={(id) => {
            setLinkedRecordingId(id);
            setActiveTab('recordings');
          }}
          onSelectCamera={() => {
            setActiveTab('cameras');
          }}
        />

        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto p-4 outline-none md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in space-y-6">
            {activeTab === 'cameras' && <CameraGrid user={user} searchQuery={searchQuery} onNavigate={setActiveTab} onClearSearch={() => setSearchQuery('')} />}
            {activeTab === 'recordings' && <Recordings user={user} searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} initialSelectedId={linkedRecordingId} onInitialSelectionHandled={() => setLinkedRecordingId(null)} />}
            {activeTab === 'events' && <Events user={user} onOpenRecording={(id) => { setLinkedRecordingId(id); setActiveTab('recordings'); }} />} 
            {activeTab === 'schedules' && <ScheduleManager user={user} />}
            {activeTab === 'activity' && <ActivityZones user={user} onNavigate={setActiveTab} />}
            {activeTab === 'broadcast' && <Broadcaster user={user} />}
            {activeTab === 'settings' && <Settings user={user} onUserUpdate={onUserUpdate} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
