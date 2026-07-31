import React, { useEffect, useRef } from 'react';
import io from 'socket.io-client';

const CameraFeed = ({ feedId }) => {
  const videoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();


  useEffect(() => {
    socketRef.current = io('http://localhost:3000');
    const socket = socketRef.current;

    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });
    peerRef.current = peerConnection;

    socket.on('offer', (id, description) => {
        peerConnection.setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then(sdp => peerConnection.setLocalDescription(sdp))
        .then(() => {
            socket.emit('answer', id, peerConnection.localDescription);
        });
    });

    socket.on('candidate', (id, candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('broadcaster', () => {
        socket.emit('watcher');
    });

    socket.on('connect', () => {
        socket.emit('watcher');
    });

    socket.on('disconnectPeer', () => {
        peerConnection.close();
    });

    peerConnection.ontrack = event => {
        if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', 'broadcaster_id_placeholder', event.candidate); // In real app, manage IDs better
        }
    };

    return () => {
        socket.disconnect();
        peerConnection.close();
    };
  }, []);

  return (
    <div className="w-full h-full bg-black relative group">
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline
            muted
            className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 bg-red-600 px-2 py-0.5 rounded text-xs font-bold text-white animate-pulse">
            LIVE
        </div>
    </div>
  );
};

export default CameraFeed;
