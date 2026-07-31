import React, { useState } from 'react';
import { Bell, Search } from 'lucide-react';

const TopBar = ({ user, onLogout, onSearch }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([
      { id: 1, text: "Motion detected in Backyard", time: "2 mins ago" },
      { id: 2, text: "New device connected (Kitchen)", time: "1 hour ago" }
  ]);

  return (
    <div className="h-20 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8">
      {/* Search / Title */}
      <div className="hidden md:flex items-center bg-slate-800 rounded-full px-4 py-2 w-96 border border-slate-700 focus-within:border-primary-DEFAULT transition-colors">
        <Search className="w-4 h-4 text-slate-400" />
        <input 
            type="text" 
            placeholder="Search cameras or recordings..." 
            className="bg-transparent border-none outline-none text-white px-3 w-full text-sm placeholder-slate-500"
            onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      
      <div className="md:hidden">
         {/* Mobile view title or spacer */}
         <h1 className="text-xl font-bold text-white">Dashboard</h1>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6">
        <div className="relative">
            <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative text-slate-400 hover:text-white transition-colors"
            >
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full ring-2 ring-slate-900" />
            </button>
            {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 z-50">
                    <div className="flex items-center justify-between px-2 py-1 mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">Notifications</p>
                        {notifications.length > 0 && (
                            <button onClick={() => setNotifications([])} className="text-xs text-primary-DEFAULT hover:text-white">Clear All</button>
                        )}
                    </div>
                    
                    <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <p className="text-sm text-slate-500 p-4 text-center">No new notifications</p>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} className="text-sm text-slate-200 p-2 hover:bg-slate-700 rounded cursor-pointer group">
                                    {n.text}
                                    <span className="block text-xs text-slate-500 group-hover:text-slate-400">{n.time}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>

        <div className="relative pl-6 border-l border-slate-800">
             <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
             >
                <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-white">{user?.name || user?.username || 'User'}</p>
                    <p className="text-xs text-slate-400">{user?.username || 'user'}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-DEFAULT to-accent-DEFAULT p-[2px]">
                    <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden">
                        {user?.profile_pic ? (
                             <img src={`http://localhost:3000/uploads/pfps/${user.profile_pic}`} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white font-bold">
                                {(user?.name?.[0] || 'U').toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
            </button>
            
            {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 z-50 overflow-hidden">
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                        My Profile
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                         Settings
                    </button>
                    <div className="h-px bg-slate-700 my-1"></div>
                    <button 
                        onClick={onLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
