import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Bell, Moon, Shield, Save, Check, HardDrive, Cloud, Database, RefreshCw, Sliders, SlidersHorizontal } from 'lucide-react';
import { API_BASE } from '../../config';

const Settings = ({ user }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Storage Settings & Quota State
  const [storageConfig, setStorageConfig] = useState({
    mode: 'local',
    local_target: 'both_failover',
    internal_quota_mb: 1200,
    sdcard_quota_mb: 3000,
    cloud_quota_mb: 5000
  });
  const [storageStatus, setStorageStatus] = useState({
    used_mb: { internal: 0, sdcard: 0, cloud: 0 },
    active_target: 'internal'
  });
  const [storageMsg, setStorageMsg] = useState('');
  const [isSavingStorage, setIsSavingStorage] = useState(false);

  const fetchStorageInfo = async () => {
    if (!user || !user.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/storage/status?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setStorageConfig(data.config || storageConfig);
        setStorageStatus(data);
      }
    } catch (e) {
      console.warn("Could not load storage status:", e);
    }
  };

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));
      fetchStorageInfo();
    }
  }, [user]);

  const handleSaveStorage = async (e) => {
    e.preventDefault();
    setIsSavingStorage(true);
    setStorageMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/storage/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          ...storageConfig
        })
      });

      if (res.ok) {
        setStorageMsg('Storage limits & loop recycling rules updated!');
        fetchStorageInfo();
      } else {
        setStorageMsg('Failed to update storage settings.');
      }
    } catch (err) {
      setStorageMsg('Network error updating storage.');
    } finally {
      setIsSavingStorage(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          name: formData.name,
          email: formData.email,
        })
      });
      
      if (res.ok) {
        setMessage('Profile updated successfully!');
        setIsEditing(false);
      } else {
        setMessage('Failed to update profile.');
      }
    } catch (err) {
      setMessage('Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b border-white/[0.07] pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[11px] font-bold tracking-widest uppercase mb-2">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Node Preferences & Security
        </div>
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-100">
          System Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage storage allocation, account credentials, and notification thresholds.
        </p>
      </div>

      {/* Storage & Loop Recording Settings */}
      <div className="bg-[#0a0d1a]/80 rounded-2xl p-6 border border-white/[0.08] shadow-xl backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Recording Storage & Quota Allocation
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure storage targets, custom quota caps, and FIFO auto-recycling rules.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30 uppercase">
            Target: {storageStatus.active_target}
          </span>
        </div>

        <form onSubmit={handleSaveStorage} className="space-y-6">
          {/* Storage Mode Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onClick={() => setStorageConfig({ ...storageConfig, mode: 'local' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                storageConfig.mode === 'local' 
                  ? 'bg-blue-500/10 border-blue-500/50 shadow-glow-sm text-slate-100' 
                  : 'bg-white/[0.02] border-white/[0.07] text-slate-400 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <HardDrive className="w-5 h-5 text-blue-400" />
                {storageConfig.mode === 'local' && <Check className="w-4 h-4 text-blue-400" />}
              </div>
              <h4 className="font-bold text-xs text-slate-100">Local Storage Only</h4>
              <p className="text-[11px] text-slate-400 mt-1">Record strictly to internal node memory or SD card.</p>
            </div>

            <div 
              onClick={() => setStorageConfig({ ...storageConfig, mode: 'cloud' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                storageConfig.mode === 'cloud' 
                  ? 'bg-indigo-500/10 border-indigo-500/50 shadow-glow-sm text-slate-100' 
                  : 'bg-white/[0.02] border-white/[0.07] text-slate-400 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Cloud className="w-5 h-5 text-indigo-400" />
                {storageConfig.mode === 'cloud' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <h4 className="font-bold text-xs text-slate-100">Cloud Storage Staging</h4>
              <p className="text-[11px] text-slate-400 mt-1">Quota-controlled myCloud cloud backup queue.</p>
            </div>

            <div 
              onClick={() => setStorageConfig({ ...storageConfig, mode: 'both' })}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                storageConfig.mode === 'both' 
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-glow-sm text-slate-100' 
                  : 'bg-white/[0.02] border-white/[0.07] text-slate-400 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Database className="w-5 h-5 text-emerald-400" />
                {storageConfig.mode === 'both' && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
              <h4 className="font-bold text-xs text-slate-100">Dual Failover Backup</h4>
              <p className="text-[11px] text-slate-400 mt-1">Simultaneous local storage & cloud quota allocation.</p>
            </div>
          </div>

          {/* Local Target Selector */}
          {storageConfig.mode !== 'cloud' && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Local Storage Location</label>
              <select 
                value={storageConfig.local_target}
                onChange={(e) => setStorageConfig({ ...storageConfig, local_target: e.target.value })}
                className="w-full bg-[#060810] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none"
              >
                <option value="internal" className="bg-slate-900">Internal Node Memory Only</option>
                <option value="sdcard" className="bg-slate-900">SD Card / External Expansion Card</option>
                <option value="both_failover" className="bg-slate-900">Auto Failover (Internal → SD Card when full)</option>
              </select>
            </div>
          )}

          {/* Quotas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="bg-[#060810]/70 p-4 rounded-xl border border-white/[0.06] space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-300">Internal Storage</span>
                <span className="text-blue-400 font-mono text-[11px]">
                  {storageStatus.used_mb?.internal || 0} / {storageConfig.internal_quota_mb} MB
                </span>
              </div>
              <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, ((storageStatus.used_mb?.internal || 0) / (storageConfig.internal_quota_mb || 1200)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={storageConfig.internal_quota_mb}
                  onChange={(e) => setStorageConfig({ ...storageConfig, internal_quota_mb: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-slate-100 text-xs px-3 py-1.5 rounded-lg outline-none"
                  placeholder="1200"
                />
                <span className="text-[11px] text-slate-500 font-bold">MB</span>
              </div>
            </div>

            <div className="bg-[#060810]/70 p-4 rounded-xl border border-white/[0.06] space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-300">SD Card Storage</span>
                <span className="text-indigo-400 font-mono text-[11px]">
                  {storageStatus.used_mb?.sdcard || 0} / {storageConfig.sdcard_quota_mb} MB
                </span>
              </div>
              <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, ((storageStatus.used_mb?.sdcard || 0) / (storageConfig.sdcard_quota_mb || 3000)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={storageConfig.sdcard_quota_mb}
                  onChange={(e) => setStorageConfig({ ...storageConfig, sdcard_quota_mb: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-slate-100 text-xs px-3 py-1.5 rounded-lg outline-none"
                  placeholder="3000"
                />
                <span className="text-[11px] text-slate-500 font-bold">MB</span>
              </div>
            </div>

            <div className="bg-[#060810]/70 p-4 rounded-xl border border-white/[0.06] space-y-2.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-300">myCloud Quota</span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  {storageStatus.used_mb?.cloud || 0} / {storageConfig.cloud_quota_mb} MB
                </span>
              </div>
              <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, ((storageStatus.used_mb?.cloud || 0) / (storageConfig.cloud_quota_mb || 5000)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={storageConfig.cloud_quota_mb}
                  onChange={(e) => setStorageConfig({ ...storageConfig, cloud_quota_mb: Number(e.target.value) })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-slate-100 text-xs px-3 py-1.5 rounded-lg outline-none"
                  placeholder="5000"
                />
                <span className="text-[11px] text-slate-500 font-bold">MB</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.07] pt-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" />
              <span>Automatic FIFO Recycling: Oldest video clips deleted when storage caps are reached.</span>
            </div>
            <button 
              type="submit"
              disabled={isSavingStorage}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-glow-sm transition-all duration-200 disabled:opacity-50"
            >
              <Save size={16} />
              {isSavingStorage ? 'Saving...' : 'Apply Storage Rules'}
            </button>
          </div>
          {storageMsg && <p className="text-xs text-emerald-400 font-medium">{storageMsg}</p>}
        </form>
      </div>

      {/* Profile Section */}
      <div className="bg-[#0a0d1a]/80 rounded-2xl p-6 border border-white/[0.08] shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6 border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Profile Information</h3>
              <p className="text-xs text-slate-400 mt-0.5">Update operator identity and contact email.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isEditing ? 'Cancel' : 'Edit Information'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full bg-[#060810] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
                className="w-full bg-[#060810] border border-white/[0.08] focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={isLoading}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-glow-sm transition-all"
              >
                <Save size={16} />
                {isLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          )}
          {message && <p className={`text-xs ${message.includes('success') ? 'text-emerald-400' : 'text-red-400'} font-medium`}>{message}</p>}
        </form>
      </div>
    </div>
  );
};

export default Settings;

