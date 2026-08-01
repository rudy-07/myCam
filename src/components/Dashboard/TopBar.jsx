import React, { useState, useEffect } from 'react';
import { Bell, Search, Clock, Calendar, X, User, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { API_BASE } from '../../config';
import logoIcon from '../../assets/mycam_no_text.png';

const TopBar = ({ user, onLogout, onSearch }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showClockDropdown, setShowClockDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Motion detected in Backyard", time: "2 mins ago" },
    { id: 2, text: "New device connected (Kitchen)", time: "1 hour ago" }
  ]);

  // Live Clock Interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Date & Time strings
  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // Analog Clock angles
  const secondsAngle = currentTime.getSeconds() * 6;
  const minutesAngle = currentTime.getMinutes() * 6 + currentTime.getSeconds() * 0.1;
  const hoursAngle = (currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5;

  // Greeting based on hour
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: "Good Morning", sub: "Have a productive day ahead" };
    if (hour < 17) return { text: "Good Afternoon", sub: "System running smoothly" };
    return { text: "Good Evening", sub: "All cameras active & secured" };
  };

  const greeting = getGreeting();

  return (
    <header className="sticky top-0 z-40 h-[68px] bg-[#060810]/70 backdrop-blur-xl border-b border-white/[0.07] flex items-center justify-between px-4 md:px-8">
      {/* Brand & Search Section */}
      <div className="flex items-center gap-6">
        {/* Brand Logo (Visible on mobile or header) */}
        <a href="/" className="flex items-center gap-2 group transition-all duration-300 hover:-translate-y-0.5">
          <img 
            src={logoIcon} 
            alt="myCam Logo" 
            className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6"
          />
          <span className="text-lg font-extrabold tracking-tight text-[#eef2ff]">
            my<span className="text-blue-500">Cam</span>
          </span>
        </a>

        {/* Pill Search Bar */}
        <div className="hidden md:flex items-center relative w-80 lg:w-96">
          <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search cameras, feeds, or recordings..." 
            className="w-full bg-white/[0.06] border border-white/[0.07] focus:border-blue-500 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/20 text-[#eef2ff] placeholder-slate-500 rounded-full pl-11 pr-4 py-2 text-xs transition-all duration-200 outline-none backdrop-blur-md"
            onChange={(e) => onSearch && onSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Right Actions & Controls */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Live Date/Time Pill Widget with Analog Clock Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowClockDropdown(!showClockDropdown)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
              showClockDropdown 
                ? 'bg-blue-500/15 border-blue-500/50 text-blue-400 shadow-glow-sm' 
                : 'bg-white/[0.04] border-white/[0.07] text-slate-300 hover:bg-white/[0.08] hover:border-white/[0.14]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="font-mono text-[11.5px] tracking-tight">{timeString}</span>
            <span className="hidden sm:inline text-slate-500">•</span>
            <span className="hidden sm:inline text-slate-400 text-[11px]">{dateString}</span>
          </button>

          {/* Analog Clock & Greeting Dropdown */}
          {showClockDropdown && (
            <div className="absolute right-0 top-full mt-3 w-72 bg-[#0a0d1a]/95 border border-white/10 rounded-2xl shadow-2xl p-5 z-50 backdrop-blur-2xl animate-fade-up">
              <div className="text-center mb-4">
                <h4 className="text-base font-bold text-slate-100">{greeting.text}, {user?.name || user?.username || 'User'}!</h4>
                <p className="text-xs text-slate-400 mt-0.5">{greeting.sub}</p>
              </div>

              {/* SVG Analog Clock */}
              <div className="relative w-36 h-36 mx-auto mb-4 bg-[#060810] rounded-full border border-white/10 shadow-inner flex items-center justify-center">
                {/* Clock ticks */}
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-0.5 h-2 bg-slate-600 rounded-full"
                    style={{ transform: `rotate(${i * 30}deg) translateY(-60px)` }}
                  />
                ))}
                {/* Hour Hand */}
                <div 
                  className="absolute w-1 h-10 bg-slate-200 rounded-full origin-bottom bottom-1/2 left-1/2 -ml-0.5"
                  style={{ transform: `rotate(${hoursAngle}deg)` }}
                />
                {/* Minute Hand */}
                <div 
                  className="absolute w-0.75 h-13 bg-blue-400 rounded-full origin-bottom bottom-1/2 left-1/2 -ml-0.375"
                  style={{ transform: `rotate(${minutesAngle}deg)` }}
                />
                {/* Second Hand */}
                <div 
                  className="absolute w-0.5 h-14 bg-red-400 rounded-full origin-bottom bottom-1/2 left-1/2 -ml-0.25"
                  style={{ transform: `rotate(${secondsAngle}deg)` }}
                />
                {/* Center Pin */}
                <div className="absolute w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#060810] z-10" />
              </div>

              <div className="text-center border-t border-white/5 pt-3">
                <div className="font-mono text-sm font-bold text-blue-400 tracking-wider">{timeString}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{dateString}</div>
              </div>
            </div>
          )}
        </div>

        {/* Bell Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] transition-all duration-200"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse-dot" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-3 w-80 bg-[#0a0d1a]/95 border border-white/10 rounded-2xl shadow-2xl p-3 z-50 backdrop-blur-2xl animate-fade-up">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">System Alerts</span>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => setNotifications([])}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">No new notifications</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-2.5 rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer group">
                      <p className="text-xs font-medium text-slate-200 group-hover:text-blue-300">{n.text}</p>
                      <span className="text-[10px] text-slate-500">{n.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative pl-3 border-l border-white/[0.08]">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                {user?.name || user?.username || 'Operator'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                {user?.role || 'Administrator'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 p-[2px] shadow-glow-sm group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full rounded-full bg-[#060810] overflow-hidden flex items-center justify-center">
                {user?.profile_pic ? (
                  <img src={`${API_BASE}/uploads/pfps/${user.profile_pic}`} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-blue-400" />
                )}
              </div>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-3 w-52 bg-[#0a0d1a]/95 border border-white/10 rounded-2xl shadow-2xl py-2 z-50 backdrop-blur-2xl animate-fade-up">
              <div className="px-4 py-2 border-b border-white/5 mb-1">
                <p className="text-xs font-bold text-slate-200">{user?.name || 'Operator'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@mysphere.co.in'}</p>
              </div>
              <button className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                <User className="w-3.5 h-3.5 text-slate-400" /> My Profile
              </button>
              <button className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                <Settings className="w-3.5 h-3.5 text-slate-400" /> Settings
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;

