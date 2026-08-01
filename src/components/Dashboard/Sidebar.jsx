import React from 'react';
import { Camera, Video, Settings, Activity, Users, LogOut, ChevronLeft, ChevronRight, Clock, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import logoIcon from '../../assets/mycam_no_text.png';

const Sidebar = ({ isCollapsed, onToggle, onLogout, activeTab, onTabChange }) => {
  const mainItems = [
    { id: 'cameras', icon: Camera, label: 'Cameras' },
    { id: 'recordings', icon: Video, label: 'Recordings' },
    { id: 'schedules', icon: Clock, label: 'Schedules' },
    { id: 'activity', icon: Activity, label: 'Activity Zones' },
    { id: 'broadcast', icon: Users, label: 'Broadcast' },
  ];

  const systemItems = [
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <motion.aside 
      animate={{ width: isCollapsed ? 76 : 240 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="h-screen bg-[#060810]/70 backdrop-blur-xl border-r border-white/[0.07] flex flex-col relative z-30 sticky top-0"
    >
      {/* Header / Brand */}
      <div className="h-[68px] flex items-center px-4 border-b border-white/[0.07] relative justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer group overflow-hidden"
          onClick={() => onTabChange('cameras')}
        >
          <img 
            src={logoIcon} 
            alt="myCam Logo" 
            className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 flex-shrink-0"
          />
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="font-extrabold text-base text-[#eef2ff] tracking-tight whitespace-nowrap"
            >
              my<span className="text-blue-500">Cam</span>
            </motion.span>
          )}
        </div>
        
        {/* Toggle Collapse Button */}
        <button 
          onClick={onToggle}
          className="bg-white/[0.06] border border-white/[0.1] rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-6">
        {/* Main Section */}
        <div>
          {!isCollapsed && (
            <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-2">
              Security Overview
            </div>
          )}
          <div className="space-y-1">
            {mainItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative text-xs font-medium ${
                    isActive 
                      ? 'text-blue-400 bg-blue-500/10 font-semibold' 
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  {/* Active Left Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-r-full shadow-glow-sm" />
                  )}
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* System Section */}
        <div>
          {!isCollapsed && (
            <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-2">
              Preferences
            </div>
          )}
          <div className="space-y-1">
            {systemItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative text-xs font-medium ${
                    isActive 
                      ? 'text-blue-400 bg-blue-500/10 font-semibold' 
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-r-full shadow-glow-sm" />
                  )}
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-white/[0.07]">
        <button 
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;

