import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CameraGrid from './CameraGrid';
import Recordings from './Recordings';
import ActivityZones from './ActivityZones';
import Settings from './Settings';
import Broadcaster from '../Broadcaster';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('cameras'); // cameras, recordings, zones, settings
  const [searchQuery, setSearchQuery] = useState('');

  const renderContent = () => {
    switch (activeTab) {
      case 'cameras':
        return <CameraGrid searchQuery={searchQuery} />;
      case 'recordings':
        return <Recordings user={user} searchQuery={searchQuery} />;
      case 'zones':
        return <ActivityZones user={user} />;
      case 'broadcast':
        return <Broadcaster user={user} />;
      case 'settings':
        return <Settings user={user} />;
      default:
        return <CameraGrid searchQuery={searchQuery} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans text-slate-100">
      <Sidebar
        onLogout={onLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar user={user} onLogout={onLogout} onSearch={setSearchQuery} />
        <main className="flex-1 overflow-y-auto bg-slate-900 border-l border-slate-800 relative custom-scrollbar">
           {activeTab === 'cameras' && <CameraGrid user={user} searchQuery={searchQuery} />}
           {activeTab === 'recordings' && <Recordings user={user} searchQuery={searchQuery} />}
           {activeTab === 'zones' && <ActivityZones user={user} />}
           {activeTab === 'broadcast' && <Broadcaster user={user} />}
           {activeTab === 'settings' && <Settings user={user} />}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
