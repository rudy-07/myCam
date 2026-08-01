import React, { useState, useEffect } from 'react';
import { Clock, Plus, Calendar, Trash2, CheckCircle2, XCircle, Power, Camera, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config';

const DAYS_LIST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ScheduleManager = ({ user }) => {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    camera_id: 'mobile',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    start_time: '22:00',
    end_time: '06:00'
  });

  const fetchSchedules = async () => {
    if (!user || !user.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/schedules?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error("Failed to load schedules", err);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [user]);

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!form.name || form.days.length === 0) {
      addToast('Schedule name and at least one active day are required.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          camera_id: form.camera_id,
          name: form.name,
          days: form.days,
          start_time: form.start_time,
          end_time: form.end_time
        })
      });

      if (res.ok) {
        addToast('Schedule created successfully!', 'success');
        setShowModal(false);
        setForm({
          name: '',
          camera_id: 'mobile',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          start_time: '22:00',
          end_time: '06:00'
        });
        fetchSchedules();
      } else {
        addToast('Failed to create schedule.', 'error');
      }
    } catch (err) {
      addToast('Network error creating schedule.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleScheduleActive = async (id, currentStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (res.ok) {
        addToast(`Schedule ${!currentStatus ? 'activated' : 'disabled'}`, 'info');
        fetchSchedules();
      }
    } catch (err) {
      addToast('Failed to toggle schedule.', 'error');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (confirm('Delete this recording schedule?')) {
      try {
        const res = await fetch(`${API_BASE}/api/schedules/${id}`, { method: 'DELETE' });
        if (res.ok) {
          addToast('Schedule deleted', 'success');
          fetchSchedules();
        }
      } catch (err) {
        addToast('Failed to delete schedule', 'error');
      }
    }
  };

  const toggleDaySelection = (day) => {
    if (form.days.includes(day)) {
      setForm({ ...form, days: form.days.filter(d => d !== day) });
    } else {
      setForm({ ...form, days: [...form.days, day] });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Clock className="text-primary-DEFAULT" /> Scheduled Recording Windows
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Automate video recording across designated time windows and days to save storage space and focus on key surveillance hours.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-DEFAULT hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg"
        >
          <Plus size={18} /> New Schedule Rule
        </button>
      </div>

      {/* Schedules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schedules.length === 0 ? (
          <div className="col-span-full bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-slate-300 font-bold text-lg">No Schedules Configured</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              Create a custom recording window schedule to automatically activate surveillance during specific hours (e.g. night time or weekends).
            </p>
          </div>
        ) : (
          schedules.map((sch) => {
            const days = typeof sch.days_json === 'string' ? JSON.parse(sch.days_json) : sch.days_json || [];
            return (
              <div 
                key={sch.id} 
                className={`bg-slate-800 rounded-2xl border transition-all p-6 flex flex-col justify-between space-y-4 shadow-xl ${sch.is_active ? 'border-primary-DEFAULT/50 bg-slate-800' : 'border-slate-700 opacity-60'}`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-900 text-primary-DEFAULT px-2.5 py-1 rounded-md border border-slate-700">
                        {sch.camera_id}
                      </span>
                      <h3 className="font-bold text-white text-lg mt-2">{sch.name}</h3>
                    </div>
                    <button 
                      onClick={() => toggleScheduleActive(sch.id, sch.is_active)}
                      className={`p-2 rounded-xl border transition-colors ${sch.is_active ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-slate-900 text-slate-500 border-slate-700'}`}
                      title={sch.is_active ? 'Disable Schedule' : 'Enable Schedule'}
                    >
                      <Power size={18} />
                    </button>
                  </div>

                  {/* Time Window */}
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between text-sm font-mono my-3">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Clock size={16} className="text-primary-DEFAULT" />
                      <span>{sch.start_time}</span>
                    </div>
                    <span className="text-slate-500 font-sans">to</span>
                    <div className="flex items-center gap-2 text-slate-300">
                      <span>{sch.end_time}</span>
                    </div>
                  </div>

                  {/* Days Matrix */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {DAYS_LIST.map((day) => {
                      const isActive = days.includes(day);
                      return (
                        <span 
                          key={day} 
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${isActive ? 'bg-primary-DEFAULT text-white' : 'bg-slate-900 text-slate-600'}`}
                        >
                          {day}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/50 flex justify-between items-center text-xs">
                  <span className="text-slate-500">
                    Status: <strong className={sch.is_active ? 'text-green-400' : 'text-slate-500'}>{sch.is_active ? 'Active' : 'Disabled'}</strong>
                  </span>
                  <button 
                    onClick={() => handleDeleteSchedule(sch.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                    title="Delete Schedule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Schedule Creator Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Plus className="text-primary-DEFAULT" /> Create Recording Schedule Rule
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-5">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Schedule Name</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Night Surveillance or Weekend Guard" 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-DEFAULT text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Target Camera</label>
                <select 
                  value={form.camera_id}
                  onChange={(e) => setForm({ ...form, camera_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-DEFAULT text-sm"
                >
                  <option value="mobile">CAM-MOBILE (Live Smartphone)</option>
                  <option value="cam2">CAM-02 (Kitchen)</option>
                  <option value="cam3">CAM-03 (Garage)</option>
                </select>
              </div>

              {/* Time Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Start Time</label>
                  <input 
                    type="time" 
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-DEFAULT text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">End Time</label>
                  <input 
                    type="time" 
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-DEFAULT text-sm font-mono"
                    required
                  />
                </div>
              </div>

              {/* Day of Week Selector */}
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Active Days</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_LIST.map((day) => {
                    const isSelected = form.days.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDaySelection(day)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-primary-DEFAULT text-white shadow-md' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary-DEFAULT hover:bg-primary-hover text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving Schedule...' : 'Save Schedule Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManager;
