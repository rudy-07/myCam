import { API_BASE } from '../config';
import { authFetch } from './api';

/**
 * Recording media helpers.
 *
 * The frontend's existing integration expects recordings at
 * `${API_BASE}/api/videos/<filename>`. Nothing here invents a URL: availability
 * is verified with a real request, and a missing endpoint/file is reported as such.
 */
export const getRecordingUrl = (rec) => {
  if (!rec?.filename) return null;
  const url = `${API_BASE}/api/videos/${encodeURIComponent(rec.filename)}`;
  return url;
};

/** A share URL is only usable if the backend supplied one on the recording record. */
export const getShareUrl = (rec) => rec?.share_url || rec?.shareUrl || null;

export const MEDIA_STATE = { CHECKING: 'checking', AVAILABLE: 'available', UNAVAILABLE: 'unavailable' };

/* ------------------------------------------------------------------ Metadata
 * Every formatter returns null when the value is missing or unusable, so the UI
 * can show a fallback instead of a fabricated or misleading value.
 */

/** Parse a server timestamp. Returns epoch milliseconds, or null if absent/invalid. */
export const parseTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

export const formatDateTime = (value) => {
  const ms = parseTimestamp(value);
  if (ms === null) return null;
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

/** The server stores duration as text such as "02:15". Show it as given; never invent 00:00. */
export const formatDuration = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const total = Math.round(value);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = String(total % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
  }
  const text = String(value).trim();
  return text || null;
};

/** Real byte counts only. Missing, zero or non-numeric sizes return null (not "0 B"). */
export const formatFileSize = (bytes) => {
  const n = Number(bytes);
  if (bytes === null || bytes === undefined || bytes === '' || !Number.isFinite(n) || n <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = n;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; }
  return `${size >= 100 || i === 0 ? Math.round(size) : size.toFixed(1)} ${units[i]}`;
};

/**
 * A thumbnail is only used if the record carries a plausible http(s) or root-relative URL.
 * (Uploads currently store an empty thumbnail_url, so this is usually null.)
 */
export const getThumbnailUrl = (rec) => {
  const raw = typeof rec?.thumbnail_url === 'string' ? rec.thumbnail_url.trim() : '';
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/') && !raw.startsWith('//')) return `${API_BASE}${raw}`;
  return null;
};

/** Sort by created_at. Records with a missing/invalid timestamp always go last. Returns a new array. */
export const sortRecordings = (list, newestFirst = true) =>
  [...list].sort((a, b) => {
    const ta = parseTimestamp(a.created_at);
    const tb = parseTimestamp(b.created_at);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return newestFirst ? tb - ta : ta - tb;
  });

export const matchesQuery = (rec, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  return String(rec.filename ?? '').toLowerCase().includes(q) || String(rec.camera_id ?? '').toLowerCase().includes(q);
};

/**
 * Probe many recordings with limited concurrency so a long library does not fire
 * dozens of simultaneous requests. `onResult(rec, state)` is skipped once aborted.
 */
export const probeRecordings = async (list, signal, onResult, concurrency = 4) => {
  const queue = [...list];
  const worker = async () => {
    while (queue.length && !signal.aborted) {
      const rec = queue.shift();
      try {
        const state = await probeMedia(getRecordingUrl(rec), signal);
        if (!signal.aborted) onResult(rec, state);
      } catch { /* aborted: nothing to report */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
};

/**
 * Check that the URL really serves video. Returns MEDIA_STATE.AVAILABLE only for
 * a successful response whose content type is not an HTML/JSON error page.
 */
export const probeMedia = async (url, signal) => {
  if (!url) return MEDIA_STATE.UNAVAILABLE;
  try {
    let res = await authFetch(url, { method: 'HEAD', signal });
    if (res.status === 405 || res.status === 501) {
      res = await authFetch(url, { headers: { Range: 'bytes=0-0' }, signal });
    }
    if (!res.ok) return MEDIA_STATE.UNAVAILABLE;
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (type.startsWith('text/') || type.includes('json')) return MEDIA_STATE.UNAVAILABLE;
    return MEDIA_STATE.AVAILABLE;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return MEDIA_STATE.UNAVAILABLE;
  }
};

/**
 * Download a recording through fetch -> Blob -> anchor click.
 * Resolves only after the file body was received; throws on any failure.
 * (A browser cannot confirm the user saved the file, only that the download was handed over.)
 */
export const downloadRecording = async (url, filename) => {
  if (!url) throw new Error('This recording has no file name to download.');
  let res;
  try {
    res = await authFetch(url);
  } catch {
    throw new Error('Could not reach the server.');
  }
  if (!res.ok) throw new Error(`The server responded with ${res.status}.`);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('text/') || type.includes('json')) throw new Error('The server did not return a video file.');
  const blob = await res.blob();
  if (!blob.size) throw new Error('The file is empty.');

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'recording.webm';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
};

/**
 * Share a backend-supplied URL with the Web Share API, falling back to the clipboard.
 * Returns 'shared' | 'copied' | 'cancelled'; throws if neither works.
 */
export const shareLink = async (url, title) => {
  if (navigator.share && (!navigator.canShare || navigator.canShare({ url }))) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // fall through to clipboard for other failures
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }
  throw new Error('Sharing and clipboard access are not available in this browser.');
};

export const SHARE_UNAVAILABLE_REASON =
  'Sharing is not available: the server does not generate share links for recordings yet.';
export const MEDIA_UNAVAILABLE_REASON =
  'The video file for this recording is not available from the server.';
export const MEDIA_CHECKING_REASON = 'Checking whether the video file is available…';
