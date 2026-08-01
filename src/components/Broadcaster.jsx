import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Camera, Mic, MicOff, Video, VideoOff, Bell } from 'lucide-react';
import { SOCKET_URL } from '../config';

const peerConnections = {};

const RESOLUTION_PRESETS = {
    '4K': { width: { ideal: 3840 }, height: { ideal: 2160 } },
    'HD': { width: { ideal: 1920 }, height: { ideal: 1080 } },
    'SD': { width: { ideal: 854 }, height: { ideal: 480 } }
};

const Broadcaster = () => {
    const videoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const socketRef = useRef();
    const [status, setStatus] = useState('Initializing...');
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [quality, setQuality] = useState('HD');
    const [incomingAudioActive, setIncomingAudioActive] = useState(false);
    const [motionAlert, setMotionAlert] = useState(false);

    const applyQualityConstraints = async (newQuality) => {
        setQuality(newQuality);
        const stream = videoRef.current?.srcObject;
        const bitrateMap = { '4K': 8000000, 'HD': 3000000, 'SD': 800000 };
        const targetBitrate = bitrateMap[newQuality] || 3000000;

        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && RESOLUTION_PRESETS[newQuality]) {
                try {
                    await videoTrack.applyConstraints(RESOLUTION_PRESETS[newQuality]);
                } catch (err) {
                    console.warn("Could not apply resolution constraint:", err);
                }
            }
        }

        // Dynamically update RTCPeerConnection sender maxBitrate for active watchers
        Object.values(peerConnections).forEach(pc => {
            if (!pc) return;
            pc.getSenders().forEach(sender => {
                if (sender.track && sender.track.kind === 'video') {
                    try {
                        const params = sender.getParameters();
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }
                        params.encodings[0].maxBitrate = targetBitrate;
                        sender.setParameters(params).catch(e => console.warn('Bitrate update warning:', e));
                    } catch (e) {
                        console.warn('Sender parameter error:', e);
                    }
                }
            });
        });

        setStatus(`Broadcasting (${newQuality})`);
    };

    useEffect(() => {
        socketRef.current = io(SOCKET_URL);
        
        const socket = socketRef.current;

        const getCamera = async () => {
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: RESOLUTION_PRESETS.HD, 
                    audio: true 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStatus('Ready to Broadcast (HD)');
                
                socket.emit('broadcaster');

                socket.on('watcher', id => {
                    const peerConnection = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' }
                        ]
                    });

                    peerConnections[id] = peerConnection;

                    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

                    // Listen for incoming audio track from watcher (Two-Way Communication)
                    peerConnection.ontrack = (event) => {
                        console.log('[Broadcaster] Received incoming track from watcher:', event.track.kind);
                        if (event.track.kind === 'audio' && remoteAudioRef.current) {
                            remoteAudioRef.current.srcObject = event.streams[0];
                            setIncomingAudioActive(true);
                        }
                    };

                    peerConnection.onicecandidate = event => {
                        if (event.candidate) {
                            socket.emit('candidate', id, event.candidate);
                        }
                    };

                    peerConnection.createOffer()
                    .then(sdp => peerConnection.setLocalDescription(sdp))
                    .then(() => {
                        socket.emit('offer', id, peerConnection.localDescription);
                    });
                });

                socket.on('answer', (id, description) => {
                    peerConnections[id] && peerConnections[id].setRemoteDescription(description);
                });

                socket.on('candidate', (id, candidate) => {
                    peerConnections[id] && peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
                });

                socket.on('change-quality', (requestedQuality) => {
                    console.log('[Broadcaster] Quality change requested by viewer:', requestedQuality);
                    applyQualityConstraints(requestedQuality);
                });

                socket.on('disconnectPeer', id => {
                    if (peerConnections[id]) {
                        peerConnections[id].close();
                        delete peerConnections[id];
                    }
                });

                window.onunload = window.onbeforeunload = () => {
                    socket.close();
                };

                // Motion Detection Loop (Samples frame every 500ms)
                const motionCanvas = document.createElement('canvas');
                motionCanvas.width = 160;
                motionCanvas.height = 90;
                const motionCtx = motionCanvas.getContext('2d');
                let lastFrameData = null;
                let lastAlertTime = 0;

                const motionInterval = setInterval(() => {
                    if (!videoRef.current || videoRef.current.readyState !== 4) return;
                    motionCtx.drawImage(videoRef.current, 0, 0, 160, 90);
                    const currentFrame = motionCtx.getImageData(0, 0, 160, 90);
                    
                    if (lastFrameData) {
                        let diffPixels = 0;
                        const data1 = lastFrameData.data;
                        const data2 = currentFrame.data;
                        for (let i = 0; i < data1.length; i += 16) { // sample every 4th pixel
                            const diff = Math.abs(data1[i] - data2[i]) + Math.abs(data1[i+1] - data2[i+1]) + Math.abs(data1[i+2] - data2[i+2]);
                            if (diff > 100) diffPixels++;
                        }
                        
                        // If more than 5% pixels changed and 5s cooled down
                        if (diffPixels > 100 && (Date.now() - lastAlertTime > 5000)) {
                            lastAlertTime = Date.now();
                            setMotionAlert(true);
                            socket.emit('motion-detected', { cameraId: 'CAM-MOBILE' });
                            setTimeout(() => setMotionAlert(false), 3000);
                        }
                    }
                    lastFrameData = currentFrame;
                }, 500);

                return () => {
                    clearInterval(motionInterval);
                };

             } catch (error) {
                console.error(error);
                setStatus('Error accessing camera: ' + error.message);
             }
        };

        getCamera();

    }, []);

    const toggleAudio = () => {
        const stream = videoRef.current?.srcObject;
        if(stream) {
            stream.getAudioTracks().forEach(track => track.enabled = !audioEnabled);
            setAudioEnabled(!audioEnabled);
        }
    };

    const toggleVideo = () => {
        const stream = videoRef.current?.srcObject;
        if(stream) {
            stream.getVideoTracks().forEach(track => track.enabled = !videoEnabled);
            setVideoEnabled(!videoEnabled);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            {/* Hidden audio element for receiving two-way audio from viewer */}
            <audio ref={remoteAudioRef} autoPlay />

            <div className="absolute top-4 left-4 flex items-center gap-3">
                <div className="bg-red-600 px-3 py-1 rounded-full animate-pulse font-bold text-white text-sm">
                    LIVE
                </div>
                {incomingAudioActive && (
                    <div className="bg-green-600 px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-1 animate-pulse">
                        <Mic className="w-3.5 h-3.5" /> Viewer Audio Active
                    </div>
                )}
                {motionAlert && (
                    <div className="bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 animate-bounce shadow-lg">
                        <Bell className="w-3.5 h-3.5 fill-current" /> MOTION DETECTED!
                    </div>
                )}
            </div>
            
            <div className="w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover aspect-video"
                />
                
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                    <div>
                        <h1 className="text-white font-bold text-lg">Broadcasting as CAM-MOBILE</h1>
                        <p className="text-slate-400 text-sm">{status}</p>
                    </div>

                    <div className="flex gap-4 items-center">
                        <button 
                            onClick={() => {
                                setMotionAlert(true);
                                socketRef.current?.emit('motion-detected', { cameraId: 'CAM-MOBILE' });
                                setTimeout(() => setMotionAlert(false), 3000);
                            }}
                            className="p-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-full transition-colors font-bold flex items-center justify-center shadow-lg"
                            title="Trigger Motion Alert"
                        >
                            <Bell className="w-5 h-5 fill-current" />
                        </button>

                        <select 
                            value={quality}
                            onChange={(e) => applyQualityConstraints(e.target.value)}
                            className="bg-black/60 text-white text-sm border border-slate-700 rounded-xl px-3 py-2 outline-none"
                        >
                            <option value="4K">4K Quality</option>
                            <option value="HD">1080p HD</option>
                            <option value="SD">SD (480p)</option>
                        </select>

                        <button 
                            onClick={toggleAudio}
                            className={`p-3 rounded-full ${audioEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
                            title="Toggle Mic"
                        >
                            {audioEnabled ? <Mic /> : <MicOff />}
                        </button>
                        <button 
                            onClick={toggleVideo}
                            className={`p-3 rounded-full ${videoEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
                            title="Toggle Video"
                        >
                            {videoEnabled ? <Video /> : <VideoOff />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Broadcaster;
