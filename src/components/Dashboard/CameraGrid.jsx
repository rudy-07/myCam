import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import CameraFeed from './CameraFeed';
import CameraModal from './CameraModal';

const CameraGrid = ({ user, searchQuery }) => {
  const [selectedCamera, setSelectedCamera] = useState(null);
  /* State for user cameras (mock persistence) */
  const [cameras, setCameras] = useState([
      { id: 'cam2', name: 'CAM-02 (Kitchen)' },
      { id: 'cam3', name: 'CAM-03 (Garage)' }
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
          name: `CAM-${('0' + (cameras.length + 4)).slice(-2)} (New)`
      };
      setCameras([...cameras, newCam]);
  };

  const deleteCamera = (id) => {
      if(confirm('Disconnect this camera?')) {
        setCameras(cameras.filter(c => c.id !== id));
      }
  };

  return (
    <div className="p-8">
      {selectedCamera && (
        <CameraModal 
            camera={selectedCamera} 
            user={user}
            onClose={() => setSelectedCamera(null)} 
        >
            <CameraFeed cameraId={selectedCamera.id} />
        </CameraModal>
      )}

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Active Cameras</h2>
        <button 
            onClick={addCamera}
            className="flex items-center gap-2 bg-primary-DEFAULT hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
            <Plus className="w-4 h-4" />
            Add Camera
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Real Camera Feed (WebRTC) */}
        <div 
            onClick={() => openCamera({ id: 'mobile', name: 'CAM-MOBILE' })}
            className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 shadow-xl relative group cursor-pointer hover:border-primary-DEFAULT transition-all hover:scale-[1.02]"
        >
             <CameraFeed />
             <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-mono text-white pointer-events-none">
                CAM-MOBILE
            </div>
             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur">Click to Expand</span>
            </div>
        </div>

        {/* Placeholder Camera Cards */}
        {/* User Added Cameras */}
        {filteredCameras.map((cam) => (
            <div 
                key={cam.id} 
                onClick={() => openCamera(cam)}
                className="aspect-video bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl relative group cursor-pointer hover:border-slate-500 transition-colors"
                onContextMenu={(e) => {
                    e.preventDefault();
                    if(confirm(`Remove ${cam.name}?`)) {
                        deleteCamera(cam.id);
                    }
                }}
            >
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                    <span className="text-slate-500 text-sm">Offline</span>
                </div>
                 <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-mono text-white">
                    {cam.name}
                </div>
                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                         onClick={(e) => { e.stopPropagation(); deleteCamera(cam.id); }}
                         className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded"
                         title="Remove Camera"
                     >
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                     </button>
                 </div>
            </div>
        ))}
        
        {/* Add New Card */}
        <div 
            onClick={addCamera}
            className="aspect-video bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700 hover:border-primary-DEFAULT/50 hover:bg-slate-800 transition-all flex flex-col items-center justify-center cursor-pointer group text-slate-500 hover:text-primary-glow"
        >
            <div className="p-3 rounded-full bg-slate-800 group-hover:bg-primary-DEFAULT/10 mb-3 transition-colors">
                <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium">Connect New Device</span>
        </div>
      </div>
    </div>
  );
};

export default CameraGrid;
