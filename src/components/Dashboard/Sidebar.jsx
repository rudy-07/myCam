import React, { useState } from 'react';
import { Camera, Video, Settings, Activity, Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isCollapsed, onToggle, onLogout, activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'cameras', icon: Camera, label: 'Cameras' },
    { id: 'recordings', icon: Video, label: 'Recordings' },
    { id: 'activity', icon: Activity, label: 'Activity Zones' },
    { id: 'broadcast', icon: Users, label: 'Broadcast' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <motion.div 
        animate={{ width: isCollapsed ? 80 : 260 }}
        className="h-screen bg-slate-900 border-r border-slate-800 flex flex-col relative z-20"
    >
      {/* Header */}
      <div className="h-20 flex items-center justify-center border-b border-slate-800 relative">
        <div className="flex items-center gap-3">
            <div className="bg-primary-DEFAULT p-2 rounded-lg">
                <Camera className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
                <motion.span 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="font-bold text-xl text-white tracking-tight cursor-pointer"
                    onClick={() => onTabChange('cameras')}
                >
                    myCam
                </motion.span>
            )}
        </div>
        
        {/* Toggle Button */}
         <button 
            onClick={onToggle}
            className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white transition-colors"
        >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
         </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-8 px-4 space-y-2">
        {menuItems.map((item) => (
            <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === item.id 
                    ? 'bg-primary-DEFAULT shadow-lg shadow-primary-DEFAULT/25 text-white' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${isCollapsed ? 'justify-center' : ''}`}
            >
                <item.icon className="w-5 h-5" />
                {!isCollapsed && (
                    <span className="font-medium">{item.label}</span>
                )}
            </button>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800">
        <button 
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
        >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
