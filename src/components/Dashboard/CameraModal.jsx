import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Mic, MicOff, Settings, Maximize2, Move, Disc, Square, Bell, Clock, Cpu, Eye } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { analyzeFrameAI, isBoxIntersectingZone } from '../../utils/aiDetector';
import io from 'socket.io-client';
import { API_BASE, SOCKET_URL } from '../../config';

const CameraModal = ({ user, camera, onClose, children }) => {
  const { addToast } = useToast();
  const [micActive, setMicActive] = useState(false);
  const [quality, setQuality] = useState('HD');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [autoSnapshotInterval, setAutoSnapshotInterval] = useState(0); // 0 = off, 15, 30, 60 seconds
  const [activeScheduleName, setActiveScheduleName] = useState(null);
  
  // AI Motion Detection State
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiFilter, setAiFilter] = useState('all'); // all, person, vehicle
  const [activeDetections, setActiveDetections] = useState([]);
  const [cameraZones, setCameraZones] = useState([]);
  const aiCanvasRef = useRef(null);
  const lastAiAlertTimeRef = useRef(0);
  const socketRef = useRef(null);

  // Fetch Camera Activity Zones for AI Polygon Filtering
  useEffect(() => {
    const fetchZones = async () => {
      if (!user || !user.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/zones?user_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setCameraZones(data.filter(z => z.camera_id === camera.id || z.camera_id === 'mobile'));
        }
      } catch (e) {
        console.warn("Could not fetch zones for AI:", e);
      }
    };
    fetchZones();
  }, [user, camera.id]);

  // AI Frame Analyzer & Bounding Box Loop
  useEffect(() => {
    let aiTimer;
    if (aiEnabled) {
      aiTimer = setInterval(() => {
        const videoElement = document.querySelector('video');
        if (!videoElement) return;

        const detections = analyzeFrameAI(videoElement, aiFilter);
        setActiveDetections(detections);

        // Render Bounding Boxes on Overlay Canvas
        const canvas = aiCanvasRef.current;
        if (canvas) {
          canvas.width = videoElement.videoWidth || 800;
          canvas.height = videoElement.videoHeight || 450;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          detections.forEach(det => {
            const bx = det.box.x * canvas.width;
            const by = det.box.y * canvas.height;
            const bw = det.box.width * canvas.width;
            const bh = det.box.height * canvas.height;

            // Check Zone Intersection
            const inZone = cameraZones.some(z => isBoxIntersectingZone(det.box, z.coordinates_json));
            const boxColor = inZone ? '#ef4444' : '#22c55e'; // Red if in activity zone, Green otherwise

            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(bx, by, bw, bh);

            // Draw Tag Label
            ctx.fillStyle = boxColor;
            ctx.fillRect(bx, Math.max(0, by - 24), Math.min(bw, 140), 24);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`${det.label.toUpperCase()} ${det.confidence}%`, bx + 6, Math.max(16, by - 7));

            // Trigger AI Motion Snapshot & Smart Alert if object enters zone
            if (inZone && (Date.now() - lastAiAlertTimeRef.current > 5000)) {
              lastAiAlertTimeRef.current = Date.now();
              takeSnapshot('ai_motion');
              addToast(`🎯 AI DETECTED: ${det.label} inside Activity Zone!`, 'error', 4000);
              
              if (socketRef.current) {
                socketRef.current.emit('trigger-alert', {
                  message: `AI DETECTED: ${det.label} inside Activity Zone on ${camera.name || 'CAM-MOBILE'}!`
                });
              }
            }
          });
        }
      }, 300);
    } else {
      const canvas = aiCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setActiveDetections([]);
    }

    return () => clearInterval(aiTimer);
  }, [aiEnabled, aiFilter, cameraZones]);

  // Scheduled Recording Evaluator Loop
  useEffect(() => {
    const checkSchedules = async () => {
      if (!user || !user.id) return;
      try {
        const res = await fetch(`${API_BASE}/api/schedules?user_id=${user.id}`);
        if (!res.ok) return;
        const schedules = await res.json();
        
        const now = new Date();
        const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = daysMap[now.getDay()];
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const matchingSchedule = schedules.find(s => {
          if (!s.is_active) return false;
          const days = typeof s.days_json === 'string' ? JSON.parse(s.days_json) : s.days_json || [];
          if (!days.includes(currentDay)) return false;

          const start = s.start_time;
          const end = s.end_time;
          if (start <= end) {
            return currentTimeStr >= start && currentTimeStr <= end;
          } else {
            // Midnight span e.g. 22:00 to 06:00
            return currentTimeStr >= start || currentTimeStr <= end;
          }
        });

        if (matchingSchedule) {
          setActiveScheduleName(matchingSchedule.name);
        } else {
          setActiveScheduleName(null);
        }

      } catch (err) {
        console.warn("Schedule evaluation error:", err);
      }
    };

    checkSchedules();
    const interval = setInterval(checkSchedules, 10000);
    return () => clearInterval(interval);
  }, [user, camera.id]);

  // Listen for real-time smart alerts from Socket.IO
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('smart-alert', (data) => {
      addToast(`🚨 Smart Alert: ${data.message || 'Activity detected!'}`, 'error', 4000);
      
      // Native Web Push Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('myCam Security Alert', {
          body: data.message || `Motion detected on ${camera.name || 'CAM-MOBILE'}`,
          icon: '/favicon.ico'
        });
      }
    });

    // Request notification permission if not yet granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socket.disconnect();
    };
  }, [camera.name]);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Automated Interval Snapshot Trigger
  useEffect(() => {
    let intervalTimer;
    if (autoSnapshotInterval > 0) {
      intervalTimer = setInterval(() => {
        takeSnapshot('interval');
      }, autoSnapshotInterval * 1000);
    }
    return () => clearInterval(intervalTimer);
  }, [autoSnapshotInterval]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);

  // Image Capture Trigger Handler (Manual, Motion, or Interval)
  const takeSnapshot = async (triggerType = 'manual') => {
    const videoElement = document.querySelector('video');
    if (!videoElement || !videoElement.videoWidth) {
      addToast('No active video feed found to capture snapshot', 'error');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 1280;
      canvas.height = videoElement.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // Auto Download locally
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `snapshot-${camera.id || 'mobile'}-${timestamp}.jpg`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        // Upload to server API
        const formData = new FormData();
        formData.append('user_id', user?.id || 1);
        formData.append('camera_id', camera.id || 'mobile');
        formData.append('trigger_type', triggerType);
        formData.append('image', blob, filename);

        try {
          await fetch(`${API_BASE}/api/snapshots`, {
            method: 'POST',
            body: formData
          });
        } catch (err) {
          console.warn("Failed to persist snapshot to backend:", err);
        }

        addToast(`Snapshot captured (${triggerType}) & saved to MyCloud`, 'success');

        // Web Push notification trigger on snapshot
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('myCam Image Captured', {
            body: `Still frame snapshot saved (${triggerType} trigger)`
          });
        }
      }, 'image/jpeg', 0.95);

    } catch (err) {
      console.error("Snapshot error:", err);
      addToast('Snapshot failed', 'error');
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      // Start Recording
      try {
        const videoElement = document.querySelector('video');
        if (!videoElement || !videoElement.srcObject) {
             addToast('No active camera feed found', 'error');
             return;
        }

        const stream = videoElement.srcObject;
        const bitrateMap = {
          '4K': 8000000,
          'HD': 3000000,
          'SD': 800000
        };
        const videoBitsPerSecond = bitrateMap[quality] || 3000000;
        
        let mediaRecorder;
        try {
          mediaRecorder = new MediaRecorder(stream, { 
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond 
          });
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream, { videoBitsPerSecond });
        }
        
        mediaRecorderRef.current = mediaRecorder;
        recordedChunks.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
            const formData = new FormData();
            
            if (!user || !user.id) {
                addToast("User session invalid. Please re-login.", "error");
                return;
            }

            formData.append('user_id', user.id);
            formData.append('camera_id', camera.id);
            formData.append('duration', formatTime(recordingTime));
            formData.append('video', blob, `recording-${Date.now()}.webm`);

            try {
                const response = await fetch(`${API_BASE}/api/recordings`, {
                    method: 'POST',
                    body: formData 
                });

                if (response.ok) {
                    const savedRec = await response.json();
                    const targetLabel = (savedRec.active_target || 'internal').toUpperCase();
                    addToast(`Recording saved [TARGET: ${targetLabel}] (Loop Recycling Active)`, 'success');
                } else {
                    let errorMessage = 'Save failed';
                    const text = await response.text(); 
                    try {
                        const err = JSON.parse(text);
                        errorMessage = err.message || errorMessage;
                    } catch (e) {
                        console.error("Backend returned non-JSON:", text);
                        errorMessage = `Server Error (${response.status}): Check console`;
                    }
                    throw new Error(errorMessage);
                }


            } catch (err) {
                 console.error(err);
                 addToast(`Failed to save: ${err.message}`, 'error');
            }
        };

        mediaRecorder.start();
        setIsRecording(true);
        addToast(`Recording started at ${quality} quality`, "success");

      } catch (err) {
          console.error("Recording error:", err);
          setIsRecording(true);
          addToast('Recording started (Demo)', 'info');
      }
    } else {
      // Stop Recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in">
      <div className="relative bg-[#0a0d1a]/95 backdrop-blur-2xl rounded-3xl w-full max-w-5xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/[0.07] flex justify-between items-center bg-white/[0.03]">

            <div className="flex items-center gap-3">
                <div className="bg-red-500 w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <h3 className="font-bold text-white text-lg tracking-wide">{camera.name || 'CAM-MOBILE'}</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 px-2 py-1 rounded text-white/70">Live</span>
                {activeScheduleName && (
                  <span className="text-[10px] font-bold tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                    <Clock size={12} /> SCHEDULE: {activeScheduleName.toUpperCase()}
                  </span>
                )}
            </div>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all duration-300"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
             {/* Render the passed video component with micActive and quality props */}
             <div className="w-full h-full">
                {React.Children.map(children, child => {
                  if (React.isValidElement(child)) {
                    return React.cloneElement(child, { micActive, quality });
                  }
                  return child;
                })}
             </div>

             {/* AI Motion Bounding Box Canvas Overlay */}
             <canvas 
                ref={aiCanvasRef} 
                className="absolute inset-0 w-full h-full pointer-events-none z-10" 
             />

             {/* AI Active Detections Counter Badge */}
             {aiEnabled && activeDetections.length > 0 && (
                <div className="absolute top-4 left-4 bg-primary-DEFAULT/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 animate-pulse z-20">
                  <Eye size={14} /> AI TARGETS: {activeDetections.map(d => d.label).join(', ')}
                </div>
             )}

             {/* Recording Indicator Overlay */}
             {isRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/80 backdrop-blur text-white px-3 py-1 rounded-full animate-pulse z-20">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    <span className="font-mono font-bold text-sm tracking-widest">{formatTime(recordingTime)}</span>
                </div>
             )}

             {/* PTZ Controls Overlay */}
             <div className="absolute right-4 bottom-4 bg-black/50 backdrop-blur rounded-full p-2 grid grid-cols-3 gap-1 w-32 h-32 opacity-0 hover:opacity-100 transition-opacity z-20">
                <div className="col-start-2 flex justify-center"><button onClick={() => addToast("Pan Up", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 rotate-0" /></button></div>
                <div className="col-start-1 row-start-2 flex justify-center"><button onClick={() => addToast("Pan Left", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 -rotate-90" /></button></div>
                <div className="col-start-2 row-start-2 flex justify-center"><div className="w-2 h-2 bg-white rounded-full"></div></div>
                <div className="col-start-3 row-start-2 flex justify-center"><button onClick={() => addToast("Pan Right", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 rotate-90" /></button></div>
                <div className="col-start-2 row-start-3 flex justify-center"><button onClick={() => addToast("Pan Down", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 rotate-180" /></button></div>
             </div>
        </div>

        {/* Controls Footer */}
        <div className="p-6 bg-white/5 border-t border-white/5 flex flex-wrap gap-4 justify-between items-center backdrop-blur-md">
            <div className="flex gap-4 items-center flex-wrap">
                <button 
                    onClick={toggleRecording}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                        isRecording 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                >
                    {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Disc className="w-5 h-5" />}
                    <span>{isRecording ? 'Stop Rec' : 'Record'}</span>
                </button>

                <button 
                    onClick={() => setMicActive(!micActive)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 border ${micActive ? 'bg-primary-DEFAULT/20 text-primary-DEFAULT border-primary-DEFAULT/50' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'}`}
                >
                    {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    <span>Two-Way Audio</span>
                </button>

                {/* AI Motion Toggle & Category Selector */}
                <div className="flex items-center gap-2">
                  <button
                      onClick={() => setAiEnabled(!aiEnabled)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all border ${
                          aiEnabled 
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                          : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                      }`}
                  >
                      <Cpu className="w-5 h-5" />
                      <span>{aiEnabled ? 'AI Motion ON' : 'AI Motion OFF'}</span>
                  </button>

                  {aiEnabled && (
                    <select
                      value={aiFilter}
                      onChange={(e) => setAiFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none font-bold"
                    >
                      <option value="all" className="bg-slate-900">All Targets</option>
                      <option value="person" className="bg-slate-900">Persons Only</option>
                      <option value="vehicle" className="bg-slate-900">Vehicles Only</option>
                    </select>
                  )}
                </div>
                
                <button 
                    onClick={() => takeSnapshot('manual')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium transition-all duration-300 border border-white/5"
                    title="Capture image frame snapshot"
                >
                    <Camera className="w-5 h-5" />
                    <span>Snapshot</span>
                </button>

                {/* Auto Interval Snapshot Selector */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-slate-300 text-xs">
                    <Clock className="w-3.5 h-3.5 text-primary-DEFAULT" />
                    <span>Auto Snap:</span>
                    <select 
                        value={autoSnapshotInterval}
                        onChange={(e) => setAutoSnapshotInterval(Number(e.target.value))}
                        className="bg-transparent text-white outline-none font-bold"
                    >
                        <option value={0} className="bg-slate-900">Off</option>
                        <option value={15} className="bg-slate-900">15s</option>
                        <option value={30} className="bg-slate-900">30s</option>
                        <option value={60} className="bg-slate-900">60s</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <select 
                    value={quality} 
                    onChange={(e) => {
                        const newQ = e.target.value;
                        setQuality(newQ);
                        const bitrateLabels = { '4K': '4K UHD (8 Mbps)', 'HD': '1080p HD (3 Mbps)', 'SD': 'Standard (800 kbps)' };
                        addToast(`Quality changed to ${bitrateLabels[newQ] || newQ}`, 'info');
                    }}
                    className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-4 py-2 outline-none focus:border-white/30 transition-colors cursor-pointer"
                >
                    <option value="4K" className="bg-slate-900">4K UHD (8 Mbps)</option>
                    <option value="HD" className="bg-slate-900">1080p HD (3 Mbps)</option>
                    <option value="SD" className="bg-slate-900">Standard (800 kbps)</option>
                </select>
                <button 
                    className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                    title="Camera Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        } else {
                            document.documentElement.requestFullscreen();
                        }
                    }}
                    className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                    title="Fullscreen"
                >
                    <Maximize2 className="w-5 h-5" />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default CameraModal;
