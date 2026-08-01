import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CameraGrid from './CameraGrid';
import Recordings from './Recordings';
import ActivityZones from './ActivityZones';
import ScheduleManager from './ScheduleManager';
import Settings from './Settings';
import Broadcaster from '../Broadcaster';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('cameras');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex h-screen bg-[#060810] overflow-hidden font-sans text-slate-100 relative">
      {/* Ambient background layers identical to myCloud */}
      <div className="shell-bg" />
      <div className="shell-bg-grid" />

      {/* Glass Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={onLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar user={user} onLogout={onLogout} onSearch={setSearchQuery} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
             {activeTab === 'cameras' && <CameraGrid user={user} searchQuery={searchQuery} />}
             {activeTab === 'recordings' && <Recordings user={user} searchQuery={searchQuery} />}
             {activeTab === 'schedules' && <ScheduleManager user={user} />}
             {activeTab === 'activity' && <ActivityZones user={user} />}
             {activeTab === 'broadcast' && <Broadcaster user={user} />}
             {activeTab === 'settings' && <Settings user={user} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

