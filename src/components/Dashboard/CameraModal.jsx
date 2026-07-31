import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Mic, MicOff, Settings, Maximize2, Move, Disc, Square } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const CameraModal = ({ user, camera, onClose, children }) => {
  const { addToast } = useToast();
  const [micActive, setMicActive] = useState(false);
  const [quality, setQuality] = useState('HD');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);

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
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        
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
            try {
                const response = await fetch('http://localhost:3000/api/recordings', {
                    method: 'POST',
                    body: formData 
                });

                if (response.ok) {
                    addToast('Recording saved to MyCloud', 'success');
                } else {
                    let errorMessage = 'Save failed';
                    const text = await response.text(); 
                    try {
                        const err = JSON.parse(text);
                        errorMessage = err.message || errorMessage;
                    } catch (e) {
                         // JSON parse failed, use the raw text (likely HTML error)
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
        addToast("Recording started", "success");

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative bg-slate-900/85 backdrop-blur-xl rounded-3xl w-full max-w-5xl overflow-hidden border border-white/10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3">
                <div className="bg-red-500 w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <h3 className="font-bold text-white text-lg tracking-wide">{camera.name || 'CAM-MOBILE'}</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 px-2 py-1 rounded text-white/70">Live</span>
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
             {/* Render the passed video component (e.g. CameraFeed) here */}
             <div className="w-full h-full">
                {children}
             </div>

             {/* Recording Indicator Overlay */}
             {isRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/80 backdrop-blur text-white px-3 py-1 rounded-full animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    <span className="font-mono font-bold text-sm tracking-widest">{formatTime(recordingTime)}</span>
                </div>
             )}

             {/* PTZ Controls Overlay */}
             <div className="absolute right-4 bottom-4 bg-black/50 backdrop-blur rounded-full p-2 grid grid-cols-3 gap-1 w-32 h-32 opacity-0 hover:opacity-100 transition-opacity">
                <div className="col-start-2 flex justify-center"><button onClick={() => addToast("Pan Up", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 rotate-0" /></button></div>
                <div className="col-start-1 row-start-2 flex justify-center"><button onClick={() => addToast("Pan Left", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 -rotate-90" /></button></div>
                <div className="col-start-2 row-start-2 flex justify-center"><div className="w-2 h-2 bg-white rounded-full"></div></div>
                <div className="col-start-3 row-start-2 flex justify-center"><button onClick={() => addToast("Pan Right", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 rotate-90" /></button></div>
                <div className="col-start-2 row-start-3 flex justify-center"><button onClick={() => addToast("Pan Down", "info", 1000)} className="p-1 hover:bg-white/20 rounded"><Move className="w-4 h-4 rotate-180" /></button></div>
             </div>
        </div>

        {/* Controls Footer */}
        <div className="p-6 bg-white/5 border-t border-white/5 flex flex-wrap gap-4 justify-between items-center backdrop-blur-md">
            <div className="flex gap-4">
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
                <button 
                    onClick={() => {
                        addToast("Snapshot taken! (Mock)", "success");
                        // In real app, canvas.toDataURL or server trigger
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium transition-all duration-300 border border-white/5"
                >
                    <Camera className="w-5 h-5" />
                    <span>Snapshot</span>
                </button>
            </div>

            <div className="flex items-center gap-4">
                <select 
                    value={quality} 
                    onChange={(e) => setQuality(e.target.value)}
                    className="bg-black/30 border border-white/10 text-white text-sm rounded-xl px-4 py-2 outline-none focus:border-white/30 transition-colors"
                >
                    <option value="4K">4K UHD</option>
                    <option value="HD">1080p HD</option>
                    <option value="SD">Standard</option>
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
