import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Maximize2,
  Minimize2,
  Disc,
  Square,
  Clock,
  Cpu,
  Activity,
  Volume2,
  VolumeX,
  X,
  Radio,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { Button, StatusBadge } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useCameraStatus } from '../../context/CameraStatusContext';
import { CAMERA_STATUS } from '../../lib/cameraStatus';
import { analyzeFrameMotion, resetMotionState, isBoxIntersectingZone } from '../../utils/aiDetector';
import io from 'socket.io-client';
import { API_BASE, SOCKET_URL } from '../../config';
import { authFetch, authUpload, getAuthToken } from '../../lib/api';
import { isWindowOpenNow } from '../../lib/schedule';

const BITRATE_MAP = { '4K': 8000000, 'HD': 3000000, 'SD': 800000 };
const QUALITY_LABELS = { '4K': '4K UHD (8 Mbps)', 'HD': '1080p HD (3 Mbps)', 'SD': 'Standard (800 kbps)' };

const CameraModal = ({ user, camera, onClose, onNavigate, children }) => {
  const { addToast } = useToast();
  const { statuses } = useCameraStatus();
  const status = statuses[camera.id] || CAMERA_STATUS.CONNECTING;
  const isLive = status === CAMERA_STATUS.LIVE;

  const [quality, setQuality] = useState('HD');
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [autoSnapshotInterval, setAutoSnapshotInterval] = useState(0); // 0 = off, 15, 30, 60 seconds
  const [activeScheduleName, setActiveScheduleName] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Motion detection (frame differencing) state
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [motionSensitivity, setMotionSensitivity] = useState('2');
  const [autoRecordOnMotion, setAutoRecordOnMotion] = useState(false);
  const [motionRegions, setMotionRegions] = useState([]);
  const [cameraZones, setCameraZones] = useState([]);

  const motionCanvasRef = useRef(null);
  const videoAreaRef = useRef(null);
  const lastMotionAlertRef = useRef(0);
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const recordingStartRef = useRef(0);
  const recordingActiveRef = useRef(false);
  const scheduledRecordingRef = useRef(false);
  const activeScheduleIdRef = useRef(null);
  const suppressedScheduleIdRef = useRef(null);
  const startRecordingRef = useRef(null);
  const stopRecordingRef = useRef(null);
  const motionRecordStopTimerRef = useRef(null);
  const lastAutoRecordAtRef = useRef(0);

  const getVideoElement = useCallback(() => videoAreaRef.current?.querySelector('video') || null, []);

  // Prevent background scroll while modal is active
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Escape key listener & fullscreen listener
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, [onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        addToast('Fullscreen is not available in this browser.', 'error');
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyBroadcasterLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('cameraId', camera.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      addToast(`Broadcaster link copied for ${camera.name}. Open it on your streaming device, sign in, then click Broadcast.`, 'success', 6000);
    } catch {
      addToast(`Broadcaster URL: ${url.toString()}`, 'info', 8000);
    }
  };

  const toggleAudio = () => {
    const video = getVideoElement();
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    addToast(nextMuted ? 'Live stream muted.' : 'Live stream unmuted.', 'info');
  };

  // Image capture (manual, motion, or interval). Reports exactly what happened.
  const takeSnapshot = useCallback(async (triggerType = 'manual') => {
    const videoElement = getVideoElement();
    if (!videoElement || !videoElement.videoWidth) {
      addToast('No live video frame is available to capture.', 'error');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      canvas.getContext('2d').drawImage(videoElement, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) {
        addToast('Snapshot failed: could not encode the frame.', 'error');
        return;
      }

      // Save a copy locally through the browser
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `snapshot-${camera.id || 'cam'}-${timestamp}.jpg`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Upload to server API
      const formData = new FormData();
      formData.append('user_id', user?.id || '');
      formData.append('camera_id', camera.id || 'mobile');
      formData.append('trigger_type', triggerType);
      formData.append('image', blob, filename);

      let uploaded = false;
      try {
        const res = await authFetch(`${API_BASE}/api/snapshots`, { method: 'POST', body: formData });
        uploaded = res.ok;
      } catch (err) {
        console.warn('Failed to persist snapshot to backend:', err);
      }

      if (uploaded) {
        addToast(`Snapshot (${triggerType}) saved locally and uploaded to server gallery.`, 'success');
      } else {
        addToast(`Snapshot (${triggerType}) saved locally, but server upload failed.`, 'warning', 5000);
      }
    } catch (err) {
      console.error('Snapshot error:', err);
      addToast('Snapshot capture failed.', 'error');
    }
  }, [addToast, camera.id, user, getVideoElement]);

  // Fetch activity zones for motion filtering
  useEffect(() => {
    const fetchZones = async () => {
      if (!user || !user.id) return;
      try {
        const res = await authFetch(`${API_BASE}/api/zones?user_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setCameraZones(data.filter(z => z.camera_id === camera.id || z.camera_id === 'mobile'));
        }
      } catch (e) {
        console.warn('Could not fetch zones for motion detection:', e);
      }
    };
    fetchZones();
  }, [user, camera.id]);

  // Socket used only to publish zone-motion alerts.
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: getAuthToken() } });
    socketRef.current = socket;
    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Motion detection loop (frame differencing)
  useEffect(() => {
    const clearOverlay = () => {
      const canvas = motionCanvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    if (!motionEnabled || !isLive) {
      clearOverlay();
      resetMotionState();
      setMotionRegions([]);
      return undefined;
    }

    const timer = setInterval(() => {
      const videoElement = getVideoElement();
      if (!videoElement) return;

      const regions = analyzeFrameMotion(videoElement, { sensitivity: Number(motionSensitivity) });
      setMotionRegions(regions);

      const canvas = motionCanvasRef.current;
      if (!canvas) return;
      canvas.width = videoElement.videoWidth || 800;
      canvas.height = videoElement.videoHeight || 450;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      regions.forEach(region => {
        const bx = region.box.x * canvas.width;
        const by = region.box.y * canvas.height;
        const bw = region.box.width * canvas.width;
        const bh = region.box.height * canvas.height;

        const inZone = cameraZones.some(z => isBoxIntersectingZone(region.box, z.coordinates_json));
        const boxColor = inZone ? '#ef4444' : '#22c55e';

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = boxColor;
        ctx.fillRect(bx, Math.max(0, by - 24), Math.min(bw, 140), 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(inZone ? 'MOTION IN ZONE' : 'MOTION', bx + 6, Math.max(16, by - 7));

        if ((cameraZones.length === 0 || inZone) && (Date.now() - lastMotionAlertRef.current > 5000)) {
          lastMotionAlertRef.current = Date.now();
          takeSnapshot('motion');
          socketRef.current?.emit('trigger-alert', {
            type: 'motion',
            cameraId: camera.id,
            timestamp: new Date().toISOString(),
            message: `Motion detected inside an activity zone on ${camera.name || camera.id}`
          });

          if (autoRecordOnMotion && !recordingActiveRef.current && Date.now() - lastAutoRecordAtRef.current >= 30000) {
            lastAutoRecordAtRef.current = Date.now();
            startRecordingRef.current?.({ motionTriggered: true });
            if (motionRecordStopTimerRef.current) clearTimeout(motionRecordStopTimerRef.current);
            motionRecordStopTimerRef.current = setTimeout(() => {
              if (recordingActiveRef.current && !scheduledRecordingRef.current) stopRecordingRef.current?.();
            }, 15000);
          }
        }
      });
    }, 300);

    return () => {
      clearInterval(timer);
      resetMotionState();
    };
  }, [motionEnabled, motionSensitivity, autoRecordOnMotion, isLive, cameraZones, camera.id, camera.name, getVideoElement, takeSnapshot]);

  // Scheduled recording verification
  useEffect(() => {
    let disposed = false;
    const checkSchedules = async () => {
      if (!user?.id) return;
      try {
        const res = await authFetch(`${API_BASE}/api/schedules?user_id=${user.id}`);
        if (!res.ok) return;
        const schedules = await res.json();
        if (disposed || !Array.isArray(schedules)) return;

        const matchingSchedule = schedules.find((schedule) => {
          const cameraMatches = String(schedule.camera_id) === String(camera.id);
          return cameraMatches && isWindowOpenNow(schedule, new Date());
        });

        activeScheduleIdRef.current = matchingSchedule ? String(matchingSchedule.id) : null;
        setActiveScheduleName(matchingSchedule ? matchingSchedule.name : null);

        if (!matchingSchedule) {
          suppressedScheduleIdRef.current = null;
          if (scheduledRecordingRef.current) stopRecording({ fromSchedule: true });
          return;
        }

        const scheduleId = String(matchingSchedule.id);
        if (isLive && !recordingActiveRef.current && suppressedScheduleIdRef.current !== scheduleId) {
          startRecording({ scheduled: true });
        }
      } catch (err) {
        console.warn('Schedule evaluation error:', err);
      }
    };

    checkSchedules();
    const interval = setInterval(checkSchedules, 10000);
    return () => { disposed = true; clearInterval(interval); };
  }, [user, camera.id, isLive]);

  // Recording elapsed-time display
  useEffect(() => {
    if (!isRecording) return undefined;
    const interval = setInterval(() => {
      setRecordingTime(Math.round((Date.now() - recordingStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Automated interval snapshots (only while the feed is live)
  useEffect(() => {
    if (autoSnapshotInterval <= 0 || !isLive) return undefined;
    const intervalTimer = setInterval(() => takeSnapshot('interval'), autoSnapshotInterval * 1000);
    return () => clearInterval(intervalTimer);
  }, [autoSnapshotInterval, isLive, takeSnapshot]);

  // Finish any in-progress recording if modal is unmounted
  useEffect(() => () => {
    if (motionRecordStopTimerRef.current) clearTimeout(motionRecordStopTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const stopRecording = ({ fromSchedule = false } = {}) => {
    if (scheduledRecordingRef.current && !fromSchedule && activeScheduleIdRef.current) {
      suppressedScheduleIdRef.current = activeScheduleIdRef.current;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recordingActiveRef.current = false;
    scheduledRecordingRef.current = false;
    setIsRecording(false);
    setRecordingTime(0);
  };

  const startRecording = ({ scheduled = false, motionTriggered = false } = {}) => {
    const videoElement = getVideoElement();
    if (recordingActiveRef.current) return;
    if (!isLive || !videoElement || !videoElement.srcObject) {
      if (!scheduled) addToast('Cannot record: camera feed is not currently live.', 'error');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      if (!scheduled) addToast('Recording is not supported by your browser.', 'error');
      return;
    }
    if (!user || !user.id) {
      if (!scheduled) addToast('Your session has expired. Please sign in again.', 'error');
      return;
    }

    const stream = videoElement.srcObject;
    const videoBitsPerSecond = BITRATE_MAP[quality] || 3000000;

    let mediaRecorder;
    try {
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond });
      } catch {
        mediaRecorder = new MediaRecorder(stream, { videoBitsPerSecond });
      }
    } catch (err) {
      console.error('Recording error:', err);
      if (!scheduled) addToast(`Could not start recording: ${err.message}`, 'error');
      return;
    }

    mediaRecorderRef.current = mediaRecorder;
    recordingActiveRef.current = true;
    scheduledRecordingRef.current = scheduled;
    recordedChunks.current = [];
    recordingStartRef.current = Date.now();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunks.current.push(event.data);
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      addToast('Recording stopped due to a browser capture error.', 'error');
      recordingActiveRef.current = false;
      scheduledRecordingRef.current = false;
      setIsRecording(false);
    };

    mediaRecorder.onstop = async () => {
      recordingActiveRef.current = false;
      scheduledRecordingRef.current = false;
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - recordingStartRef.current) / 1000));
      if (recordedChunks.current.length === 0) {
        addToast('No video data captured; nothing to upload.', 'error');
        return;
      }
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('camera_id', camera.id);
      formData.append('duration', formatTime(elapsedSeconds));
      formData.append('trigger_type', scheduled ? 'scheduled' : motionTriggered ? 'motion' : 'manual');
      formData.append('video', blob, `recording-${Date.now()}.webm`);

      try {
        const idempotencyKey = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
          ? globalThis.crypto.randomUUID()
          : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
        setUploadProgress(0);
        let response;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await authUpload(`${API_BASE}/api/recordings`, formData, { 'Idempotency-Key': idempotencyKey }, setUploadProgress);
          } catch (networkError) {
            if (attempt === 1) throw networkError;
            await new Promise((resolve) => setTimeout(resolve, 1200));
            continue;
          }
          if (response.status !== 409 || attempt === 1) break;
          const retryable = /still processing|already processing/i.test(response.body?.message || '');
          if (!retryable) break;
          await new Promise((resolve) => setTimeout(resolve, 2200));
        }
        if (response?.ok) {
          const savedRec = response.body;
          addToast(`Recording uploaded successfully (Target: ${savedRec.active_target || savedRec.storage_target || 'cloud'}).`, 'success', 5000);
        } else {
          throw new Error(response?.body?.message || `Server error (${response?.status || 'unknown'})`);
        }
      } catch (err) {
        console.error(err);
        addToast(`Recording upload failed: ${err.message}`, 'error', 6000);
      } finally {
        setUploadProgress(null);
      }
    };

    mediaRecorder.start();
    setRecordingTime(0);
    setIsRecording(true);
    addToast(scheduled
      ? `Scheduled recording started (${activeScheduleName || 'active schedule'}).`
      : motionTriggered
        ? 'Motion-triggered recording started (15-second clip).'
        : `Recording started (${QUALITY_LABELS[quality] || quality}).`, 'info');
  };

  useEffect(() => {
    startRecordingRef.current = startRecording;
    stopRecordingRef.current = stopRecording;
  });

  const toggleRecording = () => (isRecording ? stopRecording() : startRecording());

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Live View - ${camera.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-2xl text-fg overflow-y-auto animate-fade-in"
    >
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Camera className="size-4" />
            </div>
            <h2 className="font-heading text-base font-bold text-fg sm:text-lg truncate max-w-xs sm:max-w-md">
              {camera.name || 'Camera View'}
            </h2>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-sunken text-fg-muted border border-border">
            {camera.id}
          </span>
          <StatusBadge status={status} pulse={isLive} />
          {isRecording && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger animate-pulse">
              <span className="size-2 rounded-full bg-danger"></span>
              REC {formatTime(recordingTime)}
            </span>
          )}
          {uploadProgress !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
              Uploading {uploadProgress}%
            </span>
          )}
          {activeScheduleName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">
              <Clock className="size-3" /> Schedule: {activeScheduleName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Radio}
            onClick={copyBroadcasterLink}
            title="Copy broadcaster link to open on streaming device"
          >
            <span className="hidden sm:inline">Broadcaster link</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={isFullscreen ? Minimize2 : Maximize2}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label="Toggle fullscreen"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            aria-label="Close camera view"
            title="Close (Esc)"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      {/* Main Fullscreen Theater Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Cinematic Video Viewport */}
        <div
          ref={videoAreaRef}
          className="relative aspect-video w-full max-h-[64vh] mx-auto rounded-2xl overflow-hidden bg-black border border-border shadow-2xl flex items-center justify-center"
        >
          <div className="size-full">
            {React.Children.map(children, (child) =>
              React.isValidElement(child) ? React.cloneElement(child, { quality, showBadge: false }) : child
            )}
          </div>

          {/* Real-time Motion Detection Canvas Overlay */}
          <canvas
            ref={motionCanvasRef}
            className="pointer-events-none absolute inset-0 z-10 size-full object-contain"
            aria-hidden="true"
          />

          {/* Active Motion Warning Pill */}
          {motionEnabled && isLive && motionRegions.length > 0 && (
            <div className="absolute left-4 top-4 z-20 animate-fade-in" role="status">
              <span className="inline-flex items-center gap-2 rounded-full bg-danger/90 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur">
                <Activity className="size-3.5 animate-pulse" aria-hidden="true" />
                Motion detected ({motionRegions.length} region{motionRegions.length > 1 ? 's' : ''})
              </span>
            </div>
          )}

          {/* Bottom Stream Info Bar Overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-xs font-medium text-white/90">
            <div className="flex items-center gap-2">
              <span className="rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] backdrop-blur border border-white/10">
                {QUALITY_LABELS[quality] || quality}
              </span>
              {isLive && (
                <span className="flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[11px] backdrop-blur border border-white/10">
                  {isMuted ? <VolumeX className="size-3 text-white/70" /> : <Volume2 className="size-3 text-emerald-400" />}
                  {isMuted ? 'Muted' : 'Audio On'}
                </span>
              )}
            </div>
            <div className="font-mono text-[11px] text-white/70">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Organized Controls Section Below the Video */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {/* Card 1: Recording & Audio Controls */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Disc className="size-4 text-accent" />
              <h3 className="font-semibold text-sm text-fg">Recording & Audio</h3>
            </div>
            <div className="space-y-3">
              <Button
                variant={isRecording ? 'danger' : 'primary'}
                icon={isRecording ? Square : Disc}
                onClick={toggleRecording}
                disabled={!isLive && !isRecording}
                className={`w-full justify-center ${isRecording ? 'animate-pulse' : ''}`}
              >
                {isRecording ? `Stop Recording (${formatTime(recordingTime)})` : 'Record Stream'}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  icon={Camera}
                  onClick={() => takeSnapshot('manual')}
                  disabled={!isLive}
                  className="justify-center text-xs"
                >
                  Snapshot
                </Button>

                <Button
                  variant="secondary"
                  icon={isMuted ? VolumeX : Volume2}
                  onClick={toggleAudio}
                  disabled={!isLive}
                  className="justify-center text-xs"
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
              </div>

              <p className="text-[11px] text-fg-subtle leading-relaxed">
                Snapshots and recordings are saved locally and synced to your cloud storage account.
              </p>
            </div>
          </div>

          {/* Card 2: AI Motion Detection & Surveillance */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-accent" />
                <h3 className="font-semibold text-sm text-fg">Motion Detection</h3>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${motionEnabled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-surface-sunken text-fg-subtle'}`}>
                {motionEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-muted font-medium">Detection Engine</span>
                <Button
                  size="sm"
                  variant={motionEnabled ? 'primary' : 'secondary'}
                  onClick={() => setMotionEnabled(!motionEnabled)}
                >
                  {motionEnabled ? 'Disable' : 'Enable'}
                </Button>
              </div>

              <label className="flex flex-col gap-1.5 text-xs text-fg-muted">
                <span className="font-medium">Motion Sensitivity</span>
                <select
                  className="field py-1.5 text-xs"
                  value={motionSensitivity}
                  onChange={(e) => setMotionSensitivity(e.target.value)}
                  disabled={!motionEnabled}
                >
                  <option value="1">Low Sensitivity</option>
                  <option value="2">Balanced (Recommended)</option>
                  <option value="3">High Sensitivity</option>
                </select>
              </label>

              <label className="flex items-start gap-2.5 pt-1 text-xs text-fg cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRecordOnMotion}
                  onChange={(e) => setAutoRecordOnMotion(e.target.checked)}
                  disabled={!motionEnabled || !isLive}
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-fg-muted leading-tight">
                  Auto-record 15s clip when motion is detected
                </span>
              </label>

              {onNavigate && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Sliders}
                  onClick={() => { onClose(); onNavigate('zones'); }}
                  className="w-full justify-center text-xs text-accent hover:text-accent"
                >
                  Configure Activity Zones
                </Button>
              )}
            </div>
          </div>

          {/* Card 3: Quality & Automation Settings */}
          <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sliders className="size-4 text-accent" />
              <h3 className="font-semibold text-sm text-fg">Stream & Automation</h3>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-xs text-fg-muted">
                <span className="font-medium">Requested Stream Quality</span>
                <select
                  value={quality}
                  onChange={(e) => {
                    const newQ = e.target.value;
                    setQuality(newQ);
                    addToast(`Requested ${QUALITY_LABELS[newQ] || newQ} from broadcaster.`, 'info');
                  }}
                  className="field py-1.5 text-xs"
                >
                  <option value="4K">4K UHD (8 Mbps)</option>
                  <option value="HD">1080p HD (3 Mbps)</option>
                  <option value="SD">Standard (800 kbps)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs text-fg-muted">
                <span className="font-medium">Automated Periodic Snapshot</span>
                <select
                  value={autoSnapshotInterval}
                  onChange={(e) => setAutoSnapshotInterval(Number(e.target.value))}
                  className="field py-1.5 text-xs"
                >
                  <option value={0}>Disabled</option>
                  <option value={15}>Every 15 seconds</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 60 seconds</option>
                </select>
              </label>

              <Button
                variant="secondary"
                size="sm"
                icon={Radio}
                onClick={copyBroadcasterLink}
                className="w-full justify-center text-xs mt-2"
              >
                Copy Broadcaster Link
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>,
    document.body
  );
};

export default CameraModal;
