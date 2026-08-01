import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, Trash2, Save, Undo, MousePointer2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config';

const ActivityZones = ({ user }) => {
  const { addToast } = useToast();
  const [zones, setZones] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('mobile'); // Default to mobile cam
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [zoneName, setZoneName] = useState('');
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch Zones
  const fetchZones = async () => {
      if (!user) return;
      try {
          const res = await fetch(`${API_BASE}/api/zones?user_id=${user.id}`);
          if (!res.ok) {
              console.warn('Failed to fetch zones, status:', res.status);
              return; // Stop if failed
          }
          const data = await res.json();
          if (Array.isArray(data)) {
            setZones(data);
          } else {
             setZones([]); // Fallback
          }
      } catch (err) {
          console.error("Failed to load zones", err);
          setZones([]);
      }
  };

  useEffect(() => {
      fetchZones();
  }, [user]);

  // Handle Drawing on Canvas
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw existing zones for this camera
      zones.filter(z => z.camera_id === selectedCamera).forEach(zone => {
          let coords = zone.coordinates_json;
          if (typeof coords === 'string') {
              try { coords = JSON.parse(coords); } catch (e) { coords = []; }
          }
          if (Array.isArray(coords) && coords.length > 0) {
              ctx.beginPath();
              ctx.moveTo(coords[0].x * canvas.width, coords[0].y * canvas.height);
              for (let i = 1; i < coords.length; i++) {
                  ctx.lineTo(coords[i].x * canvas.width, coords[i].y * canvas.height);
              }
              ctx.closePath();
              ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'; // Green transparent
              ctx.fill();
              ctx.strokeStyle = '#22c55e';
              ctx.lineWidth = 2;
              ctx.stroke();
          }
      });

      // Draw current points
      if (points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
          for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
          }
          if (isDrawing) {
             // Close loop visual if enough points? or just open line
             ctx.strokeStyle = '#3b82f6'; // Blue drawing
             ctx.lineWidth = 2;
             ctx.stroke();
          } else {
             ctx.closePath();
             ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
             ctx.fill();
             ctx.strokeStyle = '#3b82f6';
             ctx.lineWidth = 2;
             ctx.stroke();
          }

          // Draw Vertex Points
          points.forEach(p => {
              ctx.beginPath();
              ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
              ctx.fillStyle = '#fff';
              ctx.fill();
              ctx.strokeStyle = '#3b82f6';
              ctx.stroke();
          });
      }

  }, [points, zones, selectedCamera]);

  const handleCanvasClick = (e) => {
      if (!isDrawing) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      setPoints([...points, { x, y }]);
  };

  const handleSave = async () => {
      if (!zoneName || points.length < 3) {
          addToast("Name and at least 3 points required.", "error");
          return;
      }

      try {
          const res = await fetch(`${API_BASE}/api/zones`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  user_id: user.id,
                  camera_id: selectedCamera,
                  name: zoneName,
                  coordinates: points
              })
          });
          
          if (res.ok) {
              setPoints([]);
              setIsDrawing(false);
              setZoneName('');
              fetchZones();
              addToast('Zone saved successfully', 'success');
          }
      } catch (err) {
          addToast('Error saving zone', 'error');
      }
  };

  const handleDelete = async (id) => {
      if (confirm('Delete this zone?')) {
          await fetch(`${API_BASE}/api/zones/${id}`, { method: 'DELETE' });
          fetchZones();
      }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Activity Zones</h2>
            <p className="text-slate-400">Draw zones to define where motion should trigger alerts.</p>
          </div>
          <div className="flex gap-4">
               {/* Controls */}
               {isDrawing ? (
                   <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <input 
                            type="text" 
                            placeholder="Zone Name" 
                            className="bg-slate-900 border border-slate-700 text-white px-3 py-1 rounded outline-none w-40 text-sm"
                            value={zoneName}
                            onChange={(e) => setZoneName(e.target.value)}
                        />
                        <button 
                            onClick={() => setPoints(points.slice(0, -1))}
                            className="p-1 hover:bg-slate-700 rounded text-slate-300"
                            title="Undo Point"
                        >
                            <Undo size={18} />
                        </button>
                        <button 
                            onClick={handleSave}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold"
                        >
                            <Save size={14} /> Save
                        </button>
                         <button 
                            onClick={() => { setIsDrawing(false); setPoints([]); }}
                            className="p-1 hover:bg-slate-700 rounded text-red-400 ml-1"
                            title="Cancel"
                        >
                            <Trash2 size={18} />
                        </button>
                   </div>
               ) : (
                   <button 
                        onClick={() => setIsDrawing(true)}
                        className="flex items-center gap-2 bg-primary-DEFAULT hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold transition-colors"
                   >
                       <Plus size={18} /> New Zone
                   </button>
               )}
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Visual Editor */}
          <div className="lg:col-span-2">
               <div className="bg-black rounded-xl border border-slate-700 overflow-hidden relative aspect-video group">
                   {/* Background Image (Placeholder or Real Snap) */}
                   <div 
                        className="absolute inset-0 bg-slate-900 bg-[url('https://images.unsplash.com/photo-1557597774-9d273605dfa9?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-50"
                        style={{ pointerEvents: 'none' }}   
                   ></div>
                   
                   {/* Drawing Canvas */}
                   <canvas
                        ref={canvasRef}
                        width={800}
                        height={450}
                        onClick={handleCanvasClick}
                        className={`absolute inset-0 w-full h-full ${isDrawing ? 'cursor-crosshair' : 'cursor-default'}`}
                   />

                   {/* Camera Selector (Overlay) */}
                   <div className="absolute top-4 left-4">
                       <select 
                            value={selectedCamera}
                            onChange={(e) => setSelectedCamera(e.target.value)}
                            className="bg-black/50 backdrop-blur text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none"
                       >
                           <option value="mobile">CAM-MOBILE (Live)</option>
                           <option value="cam2">CAM-02 (Kitchen)</option>
                           <option value="cam3">CAM-03 (Garage)</option>
                       </select>
                   </div>

                   {isDrawing && points.length === 0 && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
                               <MousePointer2 size={16} /> Click to place points
                           </div>
                       </div>
                   )}
               </div>
               
               <div className="mt-4 flex gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500/20 border border-green-500 rounded-sm"></div>
                        <span>Active Zone</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500/20 border border-blue-500 rounded-sm"></div>
                        <span>Draft Zone</span>
                    </div>
               </div>
          </div>

          {/* Zones List */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-fit">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Camera size={18} className="text-primary-DEFAULT" /> 
                  Configured Zones
              </h3>
              
              {zones.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No zones configured yet.</p>
              ) : (
                  <div className="space-y-3">
                      {zones.map(zone => (
                          <div key={zone.id} className="bg-slate-900 rounded-lg p-3 border border-slate-700 flex justify-between items-center group hover:border-slate-500 transition-colors">
                              <div>
                                  <h4 className="font-medium text-white text-sm">{zone.name}</h4>
                                  <p className="text-xs text-slate-500">{zone.camera_id}</p>
                              </div>
                              <button 
                                onClick={() => handleDelete(zone.id)}
                                className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                  <Trash2 size={16} />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ActivityZones;
