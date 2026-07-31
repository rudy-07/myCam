import React, { useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

const VideoPlayerModal = ({ recording, onClose }) => {
  const videoRef = useRef(null);

  // Auto-play on open
  useEffect(() => {
    if (videoRef.current) {
        videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
    }
  }, []);

  if (!recording) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-3xl w-full max-w-5xl overflow-hidden border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3">
                <div className="bg-primary-DEFAULT w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                <div>
                    <h3 className="font-bold text-white text-lg tracking-wide">{recording.filename || 'Recording'}</h3>
                    <p className="text-xs text-slate-400">
                        {recording.camera_id} • {new Date(recording.created_at).toLocaleString()}
                    </p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all duration-300"
            >
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden bg-[url('https://images.unsplash.com/photo-1557597774-9d273605dfa9?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
             <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
             
             {/* Mock Video Element or Real one if URL exists */}
             {recording.url ? (
                 <video 
                    ref={videoRef}
                    src={recording.url} 
                    controls 
                    className="w-full h-full object-contain relative z-10"
                 />
             ) : (
                <div className="text-center relative z-10 p-8">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-600">
                        <Play className="w-8 h-8 text-slate-400 ml-1" />
                    </div>
                    <p className="text-xl font-bold text-white mb-2">Video Source Unavailable</p>
                    <p className="text-slate-400 max-w-md mx-auto">
                        This is a mock recording entry. In a real application, this would stream the video file from storage.
                    </p>
                </div>
             )}
        </div>

        {/* Footer Controls (Mock if no real video control needed beyond native) */}
        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-between items-center text-sm text-slate-400 backdrop-blur-md">
            <span>Duration: {recording.duration}</span>
            <div className="flex gap-2">
                 <button className="hover:text-white transition-colors hover:bg-white/10 px-3 py-1 rounded-lg">Download Clip</button>
                 <span className="text-slate-600 py-1">|</span>
                 <button className="hover:text-white transition-colors hover:bg-white/10 px-3 py-1 rounded-lg">Share</button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default VideoPlayerModal;
