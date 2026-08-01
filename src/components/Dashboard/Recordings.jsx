import React, { useState, useEffect } from 'react';
import { Play, Calendar, Download, Share2, Film, Clock } from 'lucide-react';
import VideoPlayerModal from './VideoPlayerModal';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config';

const Recordings = ({ user, searchQuery }) => {
  const { addToast } = useToast();
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/recordings?user_id=${user?.id || 1}`);
        if (response.ok) {
          const data = await response.json();
          const augmented = data.map(rec => ({
            ...rec,
            url: `${API_BASE}/api/videos/${rec.filename}`
          }));
          setRecordings(augmented);
        } else {
          setRecordings([]);
        }
      } catch (err) {
        console.error("Failed to load recordings", err);
        setRecordings([]);
      }
    };

    if (user) {
      fetchRecordings();
    } else {
      setRecordings([]);
    }
  }, [user]);

  const filteredRecordings = recordings.filter(rec => 
    (rec.filename?.toLowerCase() || '').includes(searchQuery?.toLowerCase() || '') ||
    (rec.camera_id?.toLowerCase() || '').includes(searchQuery?.toLowerCase() || '')
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {selectedRecording && (
        <VideoPlayerModal 
          recording={selectedRecording} 
          onClose={() => setSelectedRecording(null)} 
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-[11px] font-bold tracking-widest uppercase mb-2">
            <Film className="w-3.5 h-3.5" />
            Media & Cloud Archives
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-100">
            Recordings Vault
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access stored motion clips, scheduled recordings, and encrypted cloud backups.
          </p>
        </div>

        <button 
          onClick={() => {
            setRecordings([...recordings].reverse());
            addToast('Reversed sort order', 'info');
          }}
          className="inline-flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
        >
          <Calendar className="w-3.5 h-3.5 text-blue-400" />
          Sort Date
        </button>
      </div>

      {/* Grid List */}
      {filteredRecordings.length === 0 ? (
        <div className="p-12 text-center bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl">
          <Film className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-300">No recordings found</p>
          <p className="text-xs text-slate-500 mt-1">Start recording live streams or enable automated schedules.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredRecordings.map((rec) => (
            <div 
              key={rec.id} 
              className="bg-[#0a0d1a]/80 rounded-2xl overflow-hidden border border-white/[0.08] hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-1 group shadow-lg cursor-pointer"
              onClick={() => setSelectedRecording(rec)}
            >
              {/* Thumbnail Area */}
              <div className="aspect-video bg-[#060810] relative flex items-center justify-center group-hover:opacity-90 transition-opacity">
                <div className="w-11 h-11 rounded-full bg-blue-500/30 border border-blue-400/40 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 shadow-glow-sm transition-transform">
                  <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                </div>

                <span className="absolute bottom-2.5 right-2.5 bg-[#060810]/80 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-slate-200">
                  {rec.duration || '00:15'}
                </span>

                <span className="absolute top-2.5 left-2.5 bg-blue-500/20 border border-blue-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-300 uppercase tracking-wider backdrop-blur-md">
                  {rec.camera_id || 'CAM-01'}
                </span>
              </div>
              
              {/* Info Area */}
              <div className="p-4 bg-white/[0.02]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                      {rec.title || 'Motion Event Clip'}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatDate(rec.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        addToast(`Downloading ${rec.filename}...`, 'success');
                      }} 
                      className="p-1.5 bg-white/[0.04] hover:bg-white/[0.1] rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5"
                      title="Download Clip"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        addToast(`Share link copied for ${rec.filename}`, 'info');
                      }}
                      className="p-1.5 bg-white/[0.04] hover:bg-white/[0.1] rounded-lg text-slate-300 hover:text-white transition-colors border border-white/5"
                      title="Copy Share Link"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Recordings;

