import React, { useState } from 'react';
import { Plus, Camera, Signal, Trash2, Maximize2 } from 'lucide-react';
import CameraFeed from './CameraFeed';
import CameraModal from './CameraModal';

const CameraGrid = ({ user, searchQuery }) => {
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameras, setCameras] = useState([
    { id: 'cam2', name: 'CAM-02 (Kitchen)', status: 'offline' },
    { id: 'cam3', name: 'CAM-03 (Garage)', status: 'offline' }
  ]);

  const filteredCameras = cameras.filter(cam => 
    cam.name.toLowerCase().includes(searchQuery?.toLowerCase() || '')
  );

  const openCamera = (cam) => {
    setSelectedCamera(cam);
  };

  const addCamera = () => {
    const newId = `cam${cameras.length + 2 + Math.floor(Math.random() * 100)}`;
    const newCam = {
      id: newId,
      name: `CAM-${('0' + (cameras.length + 4)).slice(-2)} (New Feed)`,
      status: 'offline'
    };
    setCameras([...cameras, newCam]);
  };

  const deleteCamera = (id) => {
    if(confirm('Disconnect this camera feed?')) {
      setCameras(cameras.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {selectedCamera && (
        <CameraModal 
          camera={selectedCamera} 
          user={user}
          onClose={() => setSelectedCamera(null)} 
        >
          <CameraFeed cameraId={selectedCamera.id} />
        </CameraModal>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[11px] font-bold tracking-widest uppercase mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-dot" />
            Live Surveillance Matrix
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-100">
            Active Camera Feeds
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-channel monitoring and edge analytics for mySphere nodes.
          </p>
        </div>

        <button 
          onClick={addCamera}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-glow-sm hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4" />
          Add Feed
        </button>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {/* Main Live Mobile/WebRTC Camera Feed */}
        <div 
          onClick={() => openCamera({ id: 'mobile', name: 'CAM-01 (Mobile Broadcaster)', status: 'live' })}
          className="group relative aspect-video bg-[#060810] rounded-2xl overflow-hidden border border-white/[0.08] hover:border-blue-500/50 shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
          <CameraFeed />

          {/* Top Live Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md animate-pulse-ring">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </div>
          </div>

          {/* Bottom Title Bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#060810]/90 via-[#060810]/40 to-transparent p-3 flex items-center justify-between pointer-events-none">
            <span className="text-xs font-mono font-semibold text-slate-100 backdrop-blur-sm">
              CAM-01 (Mobile Stream)
            </span>
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
          </div>

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
            <span className="bg-[#0a0d1a]/90 text-blue-300 border border-blue-500/30 px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-glow-sm">
              Expand Stream
            </span>
          </div>
        </div>

        {/* Dynamic User Added Cameras */}
        {filteredCameras.map((cam) => (
          <div 
            key={cam.id} 
            onClick={() => openCamera(cam)}
            className="group relative aspect-video bg-[#0a0d1a]/80 rounded-2xl overflow-hidden border border-white/[0.08] hover:border-white/[0.16] shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
          >
            {/* Top Badges */}
            <div className="p-3 flex items-center justify-between z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-[10px] font-semibold uppercase backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                OFFLINE
              </div>

              <button 
                onClick={(e) => { e.stopPropagation(); deleteCamera(cam.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-all duration-200 border border-red-500/30"
                title="Disconnect Feed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Offline Center Icon */}
            <div className="flex flex-col items-center justify-center my-auto text-slate-600 group-hover:text-slate-500 transition-colors">
              <Camera className="w-8 h-8 mb-1 opacity-50" />
              <span className="text-[11px] font-medium">Stream Offline</span>
            </div>

            {/* Bottom Bar */}
            <div className="p-3 bg-[#060810]/70 border-t border-white/[0.04]">
              <span className="text-xs font-mono font-semibold text-slate-300">
                {cam.name}
              </span>
            </div>
          </div>
        ))}
        
        {/* Add Feed Card */}
        <div 
          onClick={addCamera}
          className="aspect-video bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-blue-500/40 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group text-slate-500 hover:text-blue-400"
        >
          <div className="p-3 rounded-full bg-white/[0.04] group-hover:bg-blue-500/10 mb-2 transition-colors border border-white/[0.08]">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold tracking-wide">Connect Camera Feed</span>
        </div>
      </div>
    </div>
  );
};

export default CameraGrid;

