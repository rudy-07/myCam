import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Bell, Moon, Shield, Save, Check } from 'lucide-react';

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

  useEffect(() => {
     if (user) {
         setFormData(prev => ({
             ...prev,
             name: user.name || '',
             email: user.email || '' // Assuming we had email in user object, if not need to fetch
         }));
     }
  }, [user]);

  const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setMessage('');

      try {
          const res = await fetch('http://localhost:3000/api/user/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: user.id,
                  name: formData.name,
                  email: formData.email,
                   // Password logic to be added
              })
          });
          
           if (res.ok) {
              const data = await res.json();
              setMessage('Profile updated successfully!');
              setIsEditing(false);
              // In real app, update global user context here
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
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>

      {/* Profile Section */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
          <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="text-primary-DEFAULT" /> Profile Information
              </h3>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="text-primary-DEFAULT hover:text-white transition-colors text-sm font-medium"
              >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Full Name</label>
                      <input 
                        type="text" 
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-primary-DEFAULT outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                  </div>
                   <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Email Address</label>
                      <input 
                        type="email" 
                        name="email"
                         value={formData.email}
                        onChange={handleChange}
                        disabled={!isEditing}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-primary-DEFAULT outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                  </div>
              </div>

               {isEditing && (
                  <div className="flex justify-end pt-2">
                      <button 
                        type="submit" 
                        disabled={isLoading}
                        className="bg-primary-DEFAULT hover:bg-primary-hover text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                         {isLoading ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                      </button>
                  </div>
              )}
               {message && <p className={`text-sm ${message.includes('success') ? 'text-green-400' : 'text-red-400'} mt-2`}>{message}</p>}
          </form>
      </div>

       {/* Appearance & Notifications (Visual Only for now) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
               <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <Bell className="text-yellow-500" /> Notifications
              </h3>
               <div className="space-y-4">
                   <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => document.getElementById('toggle-motion').click()}
                   >
                       <span className="text-slate-300 group-hover:text-white">Motion Alerts</span>
                       <div 
                            id="toggle-motion"
                            className="w-12 h-6 bg-primary-DEFAULT rounded-full relative transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.currentTarget.classList.toggle('bg-slate-700');
                                e.currentTarget.classList.toggle('bg-primary-DEFAULT');
                                e.currentTarget.children[0].classList.toggle('right-1');
                                e.currentTarget.children[0].classList.toggle('left-1');
                            }}
                       >
                           <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm transition-all"></div>
                       </div>
                   </div>
                    <div className="flex items-center justify-between">
                       <span className="text-slate-300">Email Updates</span>
                       <div className="w-12 h-6 bg-slate-700 rounded-full relative cursor-pointer"><div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1 shadow-sm"></div></div>
                   </div>
               </div>
            </div>

            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                   <Shield className="text-green-500" /> Security
               </h3>
               <div className="space-y-3">
                    <button 
                        onClick={() => alert("Password change flow would open here (Requires Auth implementation updates).")}
                        className="w-full flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors text-left group"
                    >
                        <span className="text-slate-300 group-hover:text-white">Change Password</span>
                        <Lock size={16} className="text-slate-500" />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors text-left group">
                       <span className="text-slate-300 group-hover:text-white">Active Sessions</span>
                       <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">2 Active</span>
                   </button>
              </div>
           </div>
      </div>
    </div>
  );
};

export default Settings;
