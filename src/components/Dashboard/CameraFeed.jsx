import React, { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../../config';

const CameraFeed = ({ feedId, micActive = false, quality = 'HD' }) => {
  const videoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const broadcasterIdRef = useRef(null);
  const localMicStreamRef = useRef(null);

  // Handle local microphone toggle for two-way communication
  useEffect(() => {
    const handleMic = async () => {
      if (micActive) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localMicStreamRef.current = micStream;
          const audioTrack = micStream.getAudioTracks()[0];
          
          if (peerRef.current && audioTrack) {
            const senders = peerRef.current.getSenders();
            const existingAudioSender = senders.find(s => s.track && s.track.kind === 'audio');
            if (existingAudioSender) {
              existingAudioSender.replaceTrack(audioTrack);
            } else {
              peerRef.current.addTrack(audioTrack, micStream);
            }
            console.log('[CameraFeed] Two-way audio track attached to peer connection');
          }
        } catch (err) {
          console.error('[CameraFeed] Could not access microphone for two-way audio:', err);
        }
      } else {
        if (localMicStreamRef.current) {
          localMicStreamRef.current.getTracks().forEach(track => track.stop());
          localMicStreamRef.current = null;
          console.log('[CameraFeed] Two-way audio stopped');
        }
      }
    };

    handleMic();
  }, [micActive]);

  // Handle quality change signal to broadcaster
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('change-quality', quality);
    }
  }, [quality]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });
    peerRef.current = peerConnection;

    socket.on('offer', (id, description) => {
        broadcasterIdRef.current = id;
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
            const targetId = broadcasterIdRef.current || 'broadcaster';
            socket.emit('candidate', targetId, event.candidate);
        }
    };

    return () => {
        if (localMicStreamRef.current) {
          localMicStreamRef.current.getTracks().forEach(t => t.stop());
        }
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
            muted={false}
            className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 bg-red-600 px-2 py-0.5 rounded text-xs font-bold text-white animate-pulse">
            LIVE
        </div>
        {micActive && (
          <div className="absolute top-2 right-2 bg-green-600 px-2 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1 animate-pulse">
            MIC LIVE
          </div>
        )}
    </div>
  );
};

export default CameraFeed;
