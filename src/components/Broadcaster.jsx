import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Camera, Mic, MicOff, Video, VideoOff } from 'lucide-react';

const peerConnections = {};

const Broadcaster = () => {
    const videoRef = useRef(null);
    const socketRef = useRef();
    const [status, setStatus] = useState('Initializing...');
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);

    useEffect(() => {
        socketRef.current = io('http://localhost:3000');
        
        const socket = socketRef.current;

        const getCamera = async () => {
             try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStatus('Ready to Broadcast');
                
                socket.emit('broadcaster');

                socket.on('watcher', id => {
                    const peerConnection = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' }
                        ]
                    });

                    peerConnections[id] = peerConnection;

                    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

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
                    peerConnections[id].setRemoteDescription(description);
                });

                socket.on('candidate', (id, candidate) => {
                    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
                });

                socket.on('disconnectPeer', id => {
                    peerConnections[id] && peerConnections[id].close();
                    delete peerConnections[id];
                });

                window.onunload = window.onbeforeunload = () => {
                    socket.close();
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
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full animate-pulse font-bold text-white text-sm">
                LIVE
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

                    <div className="flex gap-4">
                        <button 
                            onClick={toggleAudio}
                            className={`p-3 rounded-full ${audioEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
                        >
                            {audioEnabled ? <Mic /> : <MicOff />}
                        </button>
                        <button 
                            onClick={toggleVideo}
                            className={`p-3 rounded-full ${videoEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
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
