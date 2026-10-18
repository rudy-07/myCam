import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, Bell, Users } from 'lucide-react';
import { SOCKET_URL } from '../config';
import { getAuthToken } from '../lib/api';
import { loadIceServers } from '../lib/rtcConfig';
import { Button, StatusBadge } from './ui';

const RESOLUTION_PRESETS = {
    '4K': { width: { ideal: 3840 }, height: { ideal: 2160 } },
    'HD': { width: { ideal: 1920 }, height: { ideal: 1080 } },
    'SD': { width: { ideal: 854 }, height: { ideal: 480 } }
};

const BITRATE_MAP = { '4K': 8000000, 'HD': 3000000, 'SD': 800000 };

const Broadcaster = () => {
    const videoRef = useRef(null);
    const socketRef = useRef(null);
    const peerConnectionsRef = useRef({});
    const [cameraState, setCameraState] = useState('starting'); // starting | ready | error
    const [cameraError, setCameraError] = useState('');
    const [socketState, setSocketState] = useState('connecting'); // connecting | connected | error
    const [viewerCount, setViewerCount] = useState(0);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [quality, setQuality] = useState('HD');
    const [motionAlert, setMotionAlert] = useState(false);

    const applyQualityConstraints = async (newQuality) => {
        setQuality(newQuality);
        const stream = videoRef.current?.srcObject;
        const targetBitrate = BITRATE_MAP[newQuality] || 3000000;

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

        // Update RTCPeerConnection sender maxBitrate for active watchers
        Object.values(peerConnectionsRef.current).forEach(pc => {
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
    };
    // Keep the latest handler reachable from the socket listener without re-subscribing.
    const applyQualityRef = useRef(applyQualityConstraints);
    useEffect(() => { applyQualityRef.current = applyQualityConstraints; });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const requestedCameraId = params.get('cameraId');
        const cameraId = requestedCameraId && /^[A-Za-z0-9._:-]{1,50}$/.test(requestedCameraId) ? requestedCameraId : 'mobile';
        const socket = io(SOCKET_URL, { auth: { token: getAuthToken(), cameraId } });
        socketRef.current = socket;
        const peers = peerConnectionsRef.current;
        const pendingCandidates = {};
        const disconnectTimers = {};
        const iceServersPromise = loadIceServers();
        let stream = null;
        let motionInterval = null;
        let motionTimeout = null;
        let cancelled = false;

        const syncViewerCount = () => setViewerCount(Object.keys(peers).length);

        const dropPeer = (id) => {
            if (peers[id]) {
                peers[id].onconnectionstatechange = null;
                peers[id].onicecandidate = null;
                peers[id].close();
                delete peers[id];
                delete pendingCandidates[id];
                if (disconnectTimers[id]) clearTimeout(disconnectTimers[id]);
                delete disconnectTimers[id];
                syncViewerCount();
            }
        };

        socket.on('connect', () => {
            setSocketState('connected');
            // (Re)announce so viewers know a broadcaster is available.
            if (stream) socket.emit('broadcaster', cameraId);
        });
        socket.on('connect_error', () => setSocketState('error'));
        socket.on('disconnect', () => setSocketState('connecting'));

        socket.on('watcher', async (id, requestedCameraId) => {
            if (requestedCameraId && requestedCameraId !== cameraId) return;
            if (!stream) return;
            dropPeer(id); // never keep two connections for one viewer
            let iceServers;
            try { iceServers = await iceServersPromise; } catch { iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]; }
            if (cancelled || !stream) return;
            const peerConnection = new RTCPeerConnection({ iceServers });
            peers[id] = peerConnection;
            pendingCandidates[id] = [];

            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

            peerConnection.onicecandidate = event => {
                if (event.candidate) socket.emit('candidate', id, event.candidate);
            };

            peerConnection.onconnectionstatechange = () => {
                if (peers[id] !== peerConnection) return;
                if (peerConnection.connectionState === 'connected') {
                    if (disconnectTimers[id]) clearTimeout(disconnectTimers[id]);
                    delete disconnectTimers[id];
                } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                    if (disconnectTimers[id]) clearTimeout(disconnectTimers[id]);
                    disconnectTimers[id] = setTimeout(() => {
                        if (peers[id] === peerConnection && ['failed', 'disconnected'].includes(peerConnection.connectionState)) dropPeer(id);
                    }, peerConnection.connectionState === 'failed' ? 500 : 3000);
                }
                syncViewerCount();
            };

            peerConnection.createOffer()
                .then(sdp => peerConnection.setLocalDescription(sdp))
                .then(() => socket.emit('offer', id, peerConnection.localDescription))
                .catch(err => { console.error('[Broadcaster] Offer failed:', err); dropPeer(id); });

            syncViewerCount();
        });

        socket.on('answer', async (id, description) => {
            const peer = peers[id];
            if (!peer) return;
            try {
                await peer.setRemoteDescription(description);
                for (const candidate of pendingCandidates[id] || []) {
                    try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); }
                    catch (err) { console.warn('[Broadcaster] Queued ICE candidate rejected:', err); }
                }
                pendingCandidates[id] = [];
            } catch (err) { console.warn('[Broadcaster] Bad answer:', err); }
        });

        socket.on('candidate', async (id, candidate) => {
            const peer = peers[id];
            if (!peer) return;
            if (!peer.remoteDescription) {
                (pendingCandidates[id] ||= []).push(candidate);
                return;
            }
            try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); }
            catch (err) { console.warn('[Broadcaster] ICE candidate rejected:', err); }
        });

        socket.on('change-quality', (requestedQuality) => {
            if (RESOLUTION_PRESETS[requestedQuality]) applyQualityRef.current(requestedQuality);
        });

        socket.on('disconnectPeer', dropPeer);

        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraState('error');
                setCameraError('This browser cannot access a camera (getUserMedia is unavailable). Camera access usually requires HTTPS.');
                return;
            }
            try {
                const media = await navigator.mediaDevices.getUserMedia({ video: RESOLUTION_PRESETS.HD, audio: true });
                if (cancelled) { media.getTracks().forEach(t => t.stop()); return; }
                stream = media;
                if (videoRef.current) videoRef.current.srcObject = stream;
                setCameraState('ready');
                socket.emit('broadcaster', cameraId);

                // Motion detection by frame differencing: samples a frame every 500ms.
                const motionCanvas = document.createElement('canvas');
                motionCanvas.width = 160;
                motionCanvas.height = 90;
                const motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
                let lastFrameData = null;
                let lastAlertTime = 0;

                motionInterval = setInterval(() => {
                    if (!videoRef.current || videoRef.current.readyState !== 4) return;
                    motionCtx.drawImage(videoRef.current, 0, 0, 160, 90);
                    const currentFrame = motionCtx.getImageData(0, 0, 160, 90);

                    if (lastFrameData) {
                        let diffPixels = 0;
                        const data1 = lastFrameData.data;
                        const data2 = currentFrame.data;
                        for (let i = 0; i < data1.length; i += 16) {
                            const diff = Math.abs(data1[i] - data2[i]) + Math.abs(data1[i+1] - data2[i+1]) + Math.abs(data1[i+2] - data2[i+2]);
                            if (diff > 100) diffPixels++;
                        }

                        if (diffPixels > 100 && (Date.now() - lastAlertTime > 5000)) {
                            lastAlertTime = Date.now();
                            setMotionAlert(true);
                            socket.emit('motion-detected', { cameraId });
                            clearTimeout(motionTimeout);
                            motionTimeout = setTimeout(() => setMotionAlert(false), 3000);
                        }
                    }
                    lastFrameData = currentFrame;
                }, 500);
            } catch (error) {
                if (cancelled) return;
                console.error(error);
                setCameraState('error');
                setCameraError(error.name === 'NotAllowedError'
                    ? 'Camera or microphone permission was denied. Allow access in the browser and reopen this tab.'
                    : error.message || 'The camera could not be started.');
            }
        };

        startCamera();

        return () => {
            cancelled = true;
            clearInterval(motionInterval);
            clearTimeout(motionTimeout);
            Object.keys(peers).forEach(dropPeer);
            if (stream) stream.getTracks().forEach(t => t.stop());
            socket.off();
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const toggleAudio = () => {
        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getAudioTracks().forEach(track => track.enabled = !audioEnabled);
            setAudioEnabled(!audioEnabled);
        }
    };

    const toggleVideo = () => {
        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getVideoTracks().forEach(track => track.enabled = !videoEnabled);
            setVideoEnabled(!videoEnabled);
        }
    };

    const broadcasting = cameraState === 'ready' && socketState === 'connected';
    let badge;
    if (cameraState === 'error') badge = { status: 'error', label: 'Camera error' };
    else if (socketState === 'error') badge = { status: 'error', label: 'Server unreachable' };
    else if (broadcasting) badge = { status: 'live', label: 'Broadcasting' };
    else badge = { status: 'connecting', label: 'Starting' };

    let statusText;
    if (cameraState === 'error') statusText = cameraError;
    else if (cameraState === 'starting') statusText = 'Waiting for camera permission…';
    else if (socketState === 'error') statusText = 'Camera is on, but the signalling server cannot be reached, so viewers cannot connect.';
    else if (socketState === 'connecting') statusText = 'Camera is on. Connecting to the signalling server…';
    else statusText = `Broadcasting (${quality}) · ${viewerCount} viewer${viewerCount === 1 ? '' : 's'} connected`;

    const hasProblem = cameraState === 'error' || socketState === 'error';

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={badge.status} label={badge.label} pulse={broadcasting} />
                {broadcasting && (
                    <span className="badge badge-neutral"><Users className="size-3.5" aria-hidden="true" /> {viewerCount} viewer{viewerCount === 1 ? '' : 's'}</span>
                )}
                {motionAlert && (
                    <span className="badge badge-warning" role="status"><Bell className="size-3.5" aria-hidden="true" /> Motion detected</span>
                )}
            </div>

            <div className="card relative overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-video w-full bg-surface-sunken object-cover"
                />
                {cameraState !== 'ready' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken p-6 text-center" role="status">
                        <p className={`max-w-md text-small ${cameraState === 'error' ? 'text-danger' : 'text-fg-muted'}`}>
                            {cameraState === 'error' ? cameraError : 'Waiting for camera permission…'}
                        </p>
                    </div>
                )}

                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-t from-background/90 to-transparent p-4 sm:p-6">
                    <div className="max-w-md">
                        <h2 className="section-title">Broadcasting as CAM-MOBILE</h2>
                        <p className={`text-small ${hasProblem ? 'text-danger' : 'text-fg-muted'}`}>{statusText}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={quality}
                            onChange={(e) => applyQualityConstraints(e.target.value)}
                            disabled={cameraState !== 'ready'}
                            className="select !min-h-10 !w-auto"
                            aria-label="Broadcast quality"
                        >
                            <option value="4K">4K quality</option>
                            <option value="HD">1080p HD</option>
                            <option value="SD">SD (480p)</option>
                        </select>

                        <Button
                            iconOnly
                            variant={audioEnabled ? 'secondary' : 'danger'}
                            icon={audioEnabled ? Mic : MicOff}
                            onClick={toggleAudio}
                            disabled={cameraState !== 'ready'}
                            aria-pressed={!audioEnabled}
                            title={audioEnabled ? "Mute this device's microphone in the broadcast" : "Unmute this device's microphone in the broadcast"}
                            aria-label={audioEnabled ? 'Mute broadcast microphone' : 'Unmute broadcast microphone'}
                        />
                        <Button
                            iconOnly
                            variant={videoEnabled ? 'secondary' : 'danger'}
                            icon={videoEnabled ? Video : VideoOff}
                            onClick={toggleVideo}
                            disabled={cameraState !== 'ready'}
                            aria-pressed={!videoEnabled}
                            title={videoEnabled ? 'Turn camera video off' : 'Turn camera video on'}
                            aria-label={videoEnabled ? 'Turn camera video off' : 'Turn camera video on'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Broadcaster;
