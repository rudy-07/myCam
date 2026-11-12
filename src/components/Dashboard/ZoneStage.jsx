import React, { useEffect, useRef, useState, useCallback } from 'react';
import CameraFeed from './CameraFeed';
import { BROADCASTER_ID, BROADCASTER_LABEL, cameraLabel } from '../../lib/cameras';
import { parseCoordinates, containRect, toNormalized, fromNormalized } from '../../lib/zones';
import { CAMERA_STATUS } from '../../lib/cameraStatus';

const EDGE_TOLERANCE_PX = 12;
const COLORS = { saved: '#57d6a3', draft: '#8bb8ff' };

/**
 * The real camera feed with a drawing layer on top.
 *
 * Coordinates are mapped to the VIDEO FRAME, not the container: the feed is shown
 * with object-fit: contain, so a portrait video leaves bars at the sides. Overlays
 * are drawn only over the frame, and clicks outside it are ignored, so a saved
 * point can never describe a place that is not in the picture.
 *
 * Pointer events only (one handler for mouse, touch and pen) so a tap can never
 * register twice. The canvas is also operable from the keyboard.
 */
const ZoneStage = ({ zones, drawing, points, onAddPoint, onUndo, onStatusChange, describedBy, cameraId = BROADCASTER_ID, cameraName = '' }) => {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState(null); // last known video dimensions
  const [status, setStatus] = useState(CAMERA_STATUS.CONNECTING);
  const [cursor, setCursor] = useState({ x: 0.5, y: 0.5 });
  const [kbActive, setKbActive] = useState(false);

  const live = status === CAMERA_STATUS.LIVE;
  const rect = frame ? containRect(size.w, size.h, frame.w, frame.h) : null;
  const canPlace = drawing && live && Boolean(rect);

  const handleStatus = useCallback((next, detail) => { setStatus(next); onStatusChange?.(next, detail); }, [onStatusChange]);

  // Track the stage size (CSS px) so the canvas stays sharp and aligned at any width.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Follow the real video dimensions (they change if the broadcaster rotates the phone).
  useEffect(() => {
    const video = stageRef.current?.querySelector('video');
    if (!video) return undefined;
    const read = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setFrame((prev) => (prev && prev.w === video.videoWidth && prev.h === video.videoHeight ? prev : { w: video.videoWidth, h: video.videoHeight }));
      }
    };
    read();
    ['loadedmetadata', 'loadeddata', 'resize', 'playing'].forEach((ev) => video.addEventListener(ev, read));
    return () => ['loadedmetadata', 'loadeddata', 'resize', 'playing'].forEach((ev) => video.removeEventListener(ev, read));
  }, []);

  // Draw saved zones, the draft and the keyboard crosshair.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    if (!rect || !live) return;

    const path = (pts, close) => {
      ctx.beginPath();
      pts.forEach((p, i) => { const q = fromNormalized(p, rect); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      if (close) ctx.closePath();
    };

    zones.filter((z) => !cameraId || String(z.camera_id) === String(cameraId)).forEach((zone) => {
      const pts = parseCoordinates(zone.coordinates_json);
      if (!pts || pts.length < 3) return;
      path(pts, true);
      ctx.fillStyle = 'rgba(87, 214, 163, 0.18)';
      ctx.fill();
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.saved;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (points.length > 0) {
      path(points, points.length >= 3);
      if (points.length >= 3) { ctx.fillStyle = 'rgba(139, 184, 255, 0.16)'; ctx.fill(); }
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = COLORS.draft;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      points.forEach((p, i) => {
        const q = fromNormalized(p, rect);
        ctx.beginPath();
        ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#080b12';
        ctx.fill();
        ctx.strokeStyle = COLORS.draft;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#f3f6fc';
        ctx.fillText(String(i + 1), q.x, q.y + 0.5);
      });
    }

    if (drawing && kbActive) {
      const q = fromNormalized(cursor, rect);
      ctx.strokeStyle = '#f3f6fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(q.x - 11, q.y); ctx.lineTo(q.x + 11, q.y);
      ctx.moveTo(q.x, q.y - 11); ctx.lineTo(q.x, q.y + 11);
      ctx.stroke();
    }
  }, [size, rect, live, zones, points, drawing, kbActive, cursor, cameraId]);

  const handlePointerDown = (e) => {
    if (!canPlace) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const box = canvasRef.current.getBoundingClientRect();
    const point = toNormalized(e.clientX - box.left, e.clientY - box.top, rect, EDGE_TOLERANCE_PX);
    if (point) onAddPoint(point);
  };

  const handleKeyDown = (e) => {
    if (!canPlace) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move) {
      e.preventDefault();
      setCursor((c) => ({ x: Math.min(1, Math.max(0, +(c.x + move[0]).toFixed(4))), y: Math.min(1, Math.max(0, +(c.y + move[1]).toFixed(4))) }));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAddPoint({ ...cursor });
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onUndo();
    }
  };

  return (
    <div ref={stageRef} className="card relative aspect-video overflow-hidden bg-surface-sunken">
      <div className="absolute inset-0 pointer-events-none">
        <CameraFeed feedKey={cameraId || BROADCASTER_ID} onStatusChange={handleStatus} />
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onFocus={() => setKbActive(true)}
        onBlur={() => setKbActive(false)}
        tabIndex={canPlace ? 0 : -1}
        aria-label={canPlace ? 'Zone drawing area. Use arrow keys to move the crosshair, Enter to place a corner, Backspace to remove the last corner.' : 'Zone preview over the camera picture'}
        aria-describedby={drawing ? describedBy : undefined}
        className={`absolute inset-0 z-10 size-full rounded-[inherit] ${canPlace ? 'cursor-crosshair touch-none' : ''}`}
      />

      <div className="pointer-events-none absolute right-2 top-2 z-20">
        <span className="badge badge-neutral bg-background/80 backdrop-blur">{cameraName || cameraLabel(cameraId)}</span>
      </div>
    </div>
  );
};

export default ZoneStage;
