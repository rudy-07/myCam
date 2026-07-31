import React, { useState, useEffect } from 'react';
import { Play, Calendar, Download, Share2 } from 'lucide-react';
import VideoPlayerModal from './VideoPlayerModal';
import { useToast } from '../../context/ToastContext';

const Recordings = ({ user, searchQuery }) => {
  const { addToast } = useToast();
  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  
  // Use a user ID from context or prop ideally, hardcoding just for the fetch demo as Dashboard passes no user prop to this comp yet in previous step? 
  // Ah, Dashboard DOES pass {activeTab === 'recordings' && ... <Recordings />} -> No User Prop passed in Dashboard.jsx! 
  // I need to update Dashboard.jsx to pass User to Recordings first, or just assume typical demo ID. 
  /* Fetch recordings on mount */
  useEffect(() => {
     const fetchRecordings = async () => {
         try {
             const response = await fetch(`http://localhost:3000/api/recordings?user_id=${user.id}`);
             if (response.ok) {
                 const data = await response.json();
                 // Augment with full URL
                 const augmented = data.map(rec => ({
                     ...rec,
                     url: `http://localhost:3000/api/videos/${rec.filename}`
                 }));
                 setRecordings(augmented);
             } else {
                setRecordings([]); // Clear recordings if response is not ok
             }
         } catch (err) {
             console.error("Failed to load recordings", err);
             setRecordings([]); // Clear recordings on error
         }
     };

     if(user) {
        fetchRecordings();
     } else {
        setRecordings([]); // Clear recordings if user is not available
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
    <div className="p-8">
      {selectedRecording && (
          <VideoPlayerModal 
            recording={selectedRecording} 
            onClose={() => setSelectedRecording(null)} 
          />
      )}

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Recordings Library</h2>
        <div className="flex gap-3">
             <button 
                onClick={() => {
                    const sorted = [...recordings].sort((a, b) => {
                        return new Date(b.created_at) - new Date(a.created_at);
                    });
                    // Toggle sort direction simply by reversing if already desc? 
                    // Let's just do a simple Reverse Toggle for demo
                    setRecordings([...recordings].reverse());
                }}
                className="flex items-center gap-2 bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
            >
                <Calendar className="w-4 h-4" />
                Sort Date
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredRecordings.map((rec) => (
            <div 
                key={rec.id} 
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-colors group"
                onClick={() => setSelectedRecording(rec)}
            >
                {/* Thumbnail */}
                <div className="aspect-video bg-black relative flex items-center justify-center group-hover:opacity-90 transition-opacity cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 ml-1" fill="currentColor" />
                    </div>
                    <span className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs font-mono text-white">
                        {rec.duration}
                    </span>
                    <span className="absolute top-2 left-2 bg-primary-DEFAULT/80 px-2 py-0.5 rounded text-xs font-bold text-white uppercase">
                        {rec.camera_id}
                    </span>
                </div>
                
                {/* Info */}
                <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-semibold text-white">Motion Detected</h3>
                            <p className="text-xs text-slate-400">{formatDate(rec.created_at)}</p>
                        </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addToast(`Saved ${rec.filename} to local drive.`, 'success');
                                }} 
                                className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-white transition-colors"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addToast(`Shared link copied for ${rec.filename}`, 'success');
                                }}
                                className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-white transition-colors"
                            >
                                <Share2 className="w-4 h-4" />
                            </button>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Recordings;
