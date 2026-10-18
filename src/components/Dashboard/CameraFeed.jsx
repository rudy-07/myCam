import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Camera, Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import { SOCKET_URL } from '../../config';
import { getAuthToken } from '../../lib/api';
import { CAMERA_STATUS } from '../../lib/cameraStatus';
import StatusBadge from '../ui/StatusBadge';
import { useCameraStatus } from '../../context/CameraStatusContext';
import { loadIceServers } from '../../lib/rtcConfig';

/**
 * Viewer for the broadcaster's WebRTC stream.
 *
 * Status is derived from real signals only:
 *  - offline    : signalling socket is up but no broadcaster has sent an offer,
 *                 or the peer connection was disconnected/closed
 *  - connecting : an offer was received and the peer connection is negotiating
 *  - live       : peer connection is "connected" AND a remote video track is delivering media
 *  - error      : the signalling socket could not connect, or the peer connection failed
 */
const CameraFeed = ({ feedKey = 'mobile', quality = 'HD', onStatusChange, showBadge = true, announce = true }) => {
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const broadcasterIdRef = useRef(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const { reportStatus, clearStatus } = useCameraStatus();
  const [status, setStatus] = useState(CAMERA_STATUS.OFFLINE);
  const [detail, setDetail] = useState('Connecting to the signalling server…');

  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  // Tell the broadcaster which quality was requested (it may or may not honour it).
  useEffect(() => {
    if (socketRef.current?.connected) socketRef.current.emit('change-quality', quality);
  }, [quality]);

  useEffect(() => {
    const flags = { socket: 'connecting', offer: false, pc: 'new', track: null };
    // Media is flowing only while the remote video track is live and not muted.
    const isFlowing = () => Boolean(
      flags.track && flags.track.readyState === 'live' && !flags.track.muted &&
      videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.readyState >= 2
    );
    let pc = null;
    let pendingCandidates = [];
    let disposed = false;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    const iceServersPromise = loadIceServers();

    const apply = () => {
      if (disposed) return;
      let next; let text;
      if (flags.socket === 'error') { next = CAMERA_STATUS.ERROR; text = 'Could not reach the signalling server'; }
      else if (flags.pc === 'failed') { next = CAMERA_STATUS.ERROR; text = 'The peer connection failed. The network may block direct connections (no TURN relay is configured).'; }
      else if (flags.socket === 'connecting') { next = CAMERA_STATUS.CONNECTING; text = 'Connecting to the signalling server…'; }
      else if (!flags.offer) { next = CAMERA_STATUS.OFFLINE; text = 'No broadcaster is connected. Open the Broadcast tab on a device with a camera.'; }
      else if (flags.pc === 'connected' && isFlowing()) { next = CAMERA_STATUS.LIVE; text = 'Receiving video'; }
      else if (flags.pc === 'disconnected' || flags.pc === 'closed') { next = CAMERA_STATUS.OFFLINE; text = 'The broadcaster disconnected.'; }
      else { next = CAMERA_STATUS.CONNECTING; text = 'Negotiating a connection with the broadcaster…'; }
      setStatus(next);
      setDetail(text);
      reportStatus(feedKey, next);
      onStatusChangeRef.current?.(next, text);
    };

    const closePeer = () => {
      if (pc) {
        pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null;
        pc.close();
        pc = null;
      }
      pendingCandidates = [];
      if (videoRef.current) videoRef.current.srcObject = null;
      flags.pc = 'new';
      flags.track = null;
    };

    const createPeer = async (socket) => {
      closePeer();
      const iceServers = await iceServersPromise;
      if (disposed) throw new Error('Camera viewer was disposed');
      const peer = new RTCPeerConnection({ iceServers });
      pc = peer;

      peer.ontrack = (event) => {
        const stream = event.streams[0];
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
        if (event.track.kind === 'video') {
          const track = event.track;
          flags.track = track;
          const refresh = () => { if (pc === peer && flags.track === track) apply(); };
          track.onunmute = refresh;
          track.onmute = refresh;
          track.onended = refresh;
          apply();
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('candidate', broadcasterIdRef.current || 'broadcaster', event.candidate);
        }
      };

      peer.onconnectionstatechange = () => {
        if (pc !== peer) return;
        flags.pc = peer.connectionState;
        if (peer.connectionState === 'connected') {
          reconnectAttempts = 0;
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = null;
        } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          // Give temporary network changes a short grace period before renegotiating.
          reconnectTimer = setTimeout(() => {
            if (disposed || pc !== peer || !socket.connected) return;
            if (reconnectAttempts >= 3) { apply(); return; }
            reconnectAttempts += 1;
            closePeer();
            flags.offer = false;
            flags.pc = 'new';
            socket.emit('watcher', feedKey);
            apply();
          }, peer.connectionState === 'failed' ? 500 : 2500);
        }
        apply();
      };
      return peer;
    };

    const socket = io(SOCKET_URL, { auth: { token: getAuthToken(), cameraId: feedKey } });
    socketRef.current = socket;

    const videoEl = videoRef.current;
    const onFrame = () => apply();
    videoEl?.addEventListener('loadeddata', onFrame);
    videoEl?.addEventListener('playing', onFrame);
    videoEl?.addEventListener('emptied', onFrame);

    socket.on('connect', () => {
      flags.socket = 'connected';
      socket.emit('watcher', feedKey);
      apply();
    });

    socket.on('connect_error', () => { flags.socket = 'error'; apply(); });
    socket.on('disconnect', () => { flags.socket = 'connecting'; flags.offer = false; closePeer(); apply(); });

    socket.on('broadcaster', () => {
      // A broadcaster (re)started. Ask it for a stream unless we're already receiving one.
      if (flags.pc === 'connected') return;
      socket.emit('watcher', feedKey);
    });

    socket.on('offer', async (id, description) => {
      try {
        broadcasterIdRef.current = id;
        flags.offer = true;
        const peer = await createPeer(socket);
        if (disposed) return;
        apply();
        await peer.setRemoteDescription(description);
        await peer.setLocalDescription(await peer.createAnswer());
        if (pc !== peer) return;
        socket.emit('answer', id, peer.localDescription);
        for (const c of pendingCandidates) {
          try { await peer.addIceCandidate(c); } catch (e) { console.warn('[CameraFeed] ICE candidate rejected', e); }
        }
        pendingCandidates = [];
      } catch (err) {
        console.error('[CameraFeed] Negotiation failed:', err);
        flags.pc = 'failed';
        apply();
      }
    });

    socket.on('candidate', async (id, candidate) => {
      if (!pc || !pc.remoteDescription) { pendingCandidates.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('[CameraFeed] ICE candidate rejected', e); }
    });

    socket.on('disconnectPeer', () => {
      flags.pc = 'closed';
      closePeer();
      flags.offer = false;
      apply();
    });

    apply();

    return () => {
      disposed = true;
      videoEl?.removeEventListener('loadeddata', onFrame);
      videoEl?.removeEventListener('playing', onFrame);
      videoEl?.removeEventListener('emptied', onFrame);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket.off();
      socket.disconnect();
      closePeer();
      socketRef.current = null;
      clearStatus(feedKey);
    };
  }, [feedKey, reportStatus, clearStatus]);

  const isLive = status === CAMERA_STATUS.LIVE;
  const StatusIcon = status === CAMERA_STATUS.CONNECTING ? Loader2 : status === CAMERA_STATUS.ERROR ? AlertTriangle : status === CAMERA_STATUS.OFFLINE ? WifiOff : Camera;

  const title = status === CAMERA_STATUS.CONNECTING ? 'Waiting for camera connection'
    : status === CAMERA_STATUS.ERROR ? 'Camera connection error'
    : 'No broadcast available';

  return (
    <div className="relative size-full bg-surface-sunken">
      {/* contain: the whole frame is shown, never cropped or stretched (phones often send portrait video) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`size-full object-contain ${isLive ? '' : 'invisible'}`}
      />

      {!isLive && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-surface-sunken px-6 text-center"
          role={announce ? 'status' : undefined}
        >
          <StatusIcon className={`mb-2 size-8 ${status === CAMERA_STATUS.ERROR ? 'text-danger' : 'text-fg-subtle'} ${status === CAMERA_STATUS.CONNECTING ? 'animate-spin' : ''}`} aria-hidden="true" />
          <p className="text-small font-semibold text-fg">{title}</p>
          <p className="meta-text mt-1 max-w-xs">{detail}</p>
        </div>
      )}

      {showBadge && (
        <div className="absolute left-2 top-2">
          <StatusBadge status={status} pulse={isLive} className="bg-background/80 backdrop-blur" />
        </div>
      )}
    </div>
  );
};

export default CameraFeed;
