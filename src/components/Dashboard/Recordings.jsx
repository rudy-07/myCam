import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Film, FileX, RefreshCw, SearchX, ListFilter, HardDrive, CalendarClock, Trash2 } from 'lucide-react';
import VideoPlayerModal from './VideoPlayerModal';
import RecordingCard from './RecordingCard';
import { Button, PageHeader, EmptyState } from '../ui';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../config';
import { authFetch } from '../../lib/api';
import {
  MEDIA_STATE, getRecordingUrl, getShareUrl, downloadRecording, shareLink, probeRecordings,
  sortRecordings, matchesQuery, SHARE_UNAVAILABLE_REASON, MEDIA_UNAVAILABLE_REASON, MEDIA_CHECKING_REASON,
} from '../../lib/recordingMedia';

const FILTERS = [
  { id: 'all', label: 'All entries' },
  { id: MEDIA_STATE.AVAILABLE, label: 'Video found' },
  { id: MEDIA_STATE.UNAVAILABLE, label: 'Video unavailable' },
];

const NO_RECORDINGS = [];
const NO_MEDIA = {};
const formatBytesForToast = (value) => { const bytes = Number(value); if (!Number.isFinite(bytes) || bytes <= 0) return ''; const units = ['B', 'KB', 'MB', 'GB']; let size = bytes; let unit = 0; while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; } return `${size >= 100 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`; };

const GRID = 'grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

const SkeletonGrid = () => (
  <div role="status" aria-live="polite">
    <span className="sr-only">Loading recordings…</span>
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="aspect-video animate-pulse bg-surface-sunken" />
          <div className="space-y-2.5 p-4">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface-hover" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-hover" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Recordings = ({ user, searchQuery, onClearSearch, initialSelectedId = null, onInitialSelectionHandled }) => {
  const { addToast } = useToast();
  const userId = user?.id;

  // Results are keyed by the request that produced them, so "loading" is derived
  // (key mismatch) instead of being set synchronously inside the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${userId}:${reloadToken}`;
  const [result, setResult] = useState({ key: null, status: 'loading', list: [], error: '' });
  const loadState = result.key === requestKey ? result.status : 'loading';
  const recordings = result.key === requestKey ? result.list : NO_RECORDINGS;

  const [probeToken, setProbeToken] = useState(0);
  const probeKey = `${requestKey}:${probeToken}`;
  const [media, setMedia] = useState({ key: null, map: {} });
  const mediaMap = media.key === probeKey ? media.map : NO_MEDIA;
  const stateOf = useCallback((rec) => mediaMap[rec.id] || MEDIA_STATE.CHECKING, [mediaMap]);

  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    if (initialSelectedId == null) return;
    setSelectedId(String(initialSelectedId));
    onInitialSelectionHandled?.();
  }, [initialSelectedId, onInitialSelectionHandled]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const downloadLock = useRef(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [availability, setAvailability] = useState('all');
  const [triggerFilter, setTriggerFilter] = useState('all');
  const [retentionDays, setRetentionDays] = useState('30');
  const [retentionPreview, setRetentionPreview] = useState(null);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionDeleting, setRetentionDeleting] = useState(false);

  // 1. Recording metadata (existing endpoint and contract, unchanged)
  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await authFetch(`${API_BASE}/api/recordings?user_id=${userId}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`The server responded with ${response.status}.`);
        let data;
        try { data = await response.json(); } catch { throw new Error('The server sent a response that is not recording data.'); }
        if (!Array.isArray(data)) throw new Error('The server sent a response that is not a recording list.');
        setResult({ key: requestKey, status: 'ready', list: data, error: '' });
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to load recordings', err);
        const message = err instanceof TypeError ? 'Could not reach the server.' : (err.message || 'Could not reach the server.');
        setResult({ key: requestKey, status: 'error', list: [], error: message });
      }
    })();
    return () => controller.abort();
  }, [userId, requestKey]);

  // 2. Verify, per entry, that the server can really supply the video file.
  useEffect(() => {
    if (result.key !== requestKey || result.status !== 'ready' || result.list.length === 0) return undefined;
    const controller = new AbortController();
    probeRecordings(result.list, controller.signal, (rec, state) => {
      setMedia((prev) => (prev.key === probeKey
        ? { key: probeKey, map: { ...prev.map, [rec.id]: state } }
        : { key: probeKey, map: { [rec.id]: state } }));
    });
    return () => controller.abort();
  }, [result, requestKey, probeKey]);

  const counts = useMemo(() => {
    let available = 0; let unavailable = 0;
    recordings.forEach((r) => {
      if (mediaMap[r.id] === MEDIA_STATE.AVAILABLE) available += 1;
      else if (mediaMap[r.id] === MEDIA_STATE.UNAVAILABLE) unavailable += 1;
    });
    return { available, unavailable, checking: recordings.length - available - unavailable };
  }, [recordings, mediaMap]);

  const visible = useMemo(() => sortRecordings(
    recordings.filter((r) => matchesQuery(r, searchQuery) && (availability === 'all' || mediaMap[r.id] === availability) && (triggerFilter === 'all' || (r.trigger_type || 'manual') === triggerFilter)),
    newestFirst,
  ), [recordings, searchQuery, availability, triggerFilter, mediaMap, newestFirst]);

  const selected = recordings.find((r) => String(r.id) === String(selectedId)) || null;
  const hasQuery = Boolean(searchQuery?.trim());
  const hasFilter = availability !== 'all' || triggerFilter !== 'all';

  const handleDownload = useCallback(async (rec) => {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloadingId(rec.id);
    try {
      await downloadRecording(getRecordingUrl(rec), rec.filename);
      addToast(`${rec.filename} was received and handed to your browser's downloads.`, 'success');
    } catch (err) {
      addToast(`Could not download ${rec.filename}: ${err.message}`, 'error', 5000);
    } finally {
      downloadLock.current = false;
      setDownloadingId(null);
    }
  }, [addToast]);

  const handleDelete = useCallback(async (rec) => {
    const filename = rec.filename || 'this recording';
    if (!window.confirm(`Delete ${filename}? This permanently removes the saved recording from server storage.`)) return;
    setDeletingId(rec.id);
    try {
      const response = await authFetch(`${API_BASE}/api/recordings/${encodeURIComponent(rec.id)}`, { method: 'DELETE' });
      let payload = {};
      try { payload = await response.json(); } catch { /* use a generic message below */ }
      if (!response.ok) throw new Error(payload.message || `The server responded with ${response.status}.`);
      if (selectedId === rec.id) setSelectedId(null);
      addToast(`${filename} was deleted.`, 'success');
      setReloadToken((token) => token + 1);
    } catch (err) {
      addToast(`Could not delete ${filename}: ${err.message || 'Unknown error'}`, 'error', 5000);
    } finally {
      setDeletingId(null);
    }
  }, [addToast, selectedId]);

  const handleShare = useCallback(async (rec) => {
    const shareUrl = getShareUrl(rec);
    if (!shareUrl) { addToast(SHARE_UNAVAILABLE_REASON, 'info', 5000); return; }
    try {
      const outcome = await shareLink(shareUrl, rec.filename);
      if (outcome === 'copied') addToast('Share link copied to the clipboard.', 'success');
      else if (outcome === 'shared') addToast('Share sheet opened.', 'info');
      // 'cancelled' is the user's choice: no toast
    } catch (err) {
      addToast(`Could not share this recording: ${err.message}`, 'error', 5000);
    }
  }, [addToast]);

  const handleVerify = useCallback(async (rec) => {
    if (!rec?.id || verifyingId) return;
    setVerifyingId(rec.id);
    try {
      const response = await authFetch(`${API_BASE}/api/recordings/${encodeURIComponent(rec.id)}/verify`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `The server responded with ${response.status}.`);
      setProbeToken((token) => token + 1);
      if (payload.status === 'available') {
        const size = payload.actual_size_bytes ? formatBytesForToast(payload.actual_size_bytes) : '';
        addToast(`Recording file is available${size ? ` (${size})` : ''}.`, 'success');
      } else if (payload.status === 'missing') {
        addToast('Recording metadata exists, but its video file is missing.', 'error', 6000);
      } else {
        addToast(payload.message || 'Storage could not be verified. No recording metadata was changed.', 'info', 6000);
      }
    } catch (err) {
      addToast(`Could not verify recording: ${err.message || 'Unknown error'}`, 'error', 6000);
    } finally { setVerifyingId(null); }
  }, [addToast, verifyingId]);

  const loadRetentionPreview = useCallback(async () => {
    setRetentionLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/recordings/retention-preview?days=${encodeURIComponent(retentionDays)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || `The server responded with ${response.status}.`);
      setRetentionPreview(payload);
    } catch (err) {
      addToast(`Could not prepare storage preview: ${err.message || 'Unknown error'}`, 'error', 6000);
    } finally { setRetentionLoading(false); }
  }, [addToast, retentionDays]);

  const runRetentionCleanup = useCallback(async () => {
    const candidates = retentionPreview?.candidates || [];
    if (!candidates.length || retentionDeleting) return;
    const message = `Permanently delete ${candidates.length}${retentionPreview.truncated ? ' or more' : ''} recording(s) older than ${retentionDays} days? This deletes the stored media. Linked event history will be kept, but its recording link will be removed.`;
    if (!window.confirm(message)) return;
    setRetentionDeleting(true);
    let deleted = 0;
    const failures = [];
    try {
      for (const rec of candidates) {
        try {
          const response = await authFetch(`${API_BASE}/api/recordings/${encodeURIComponent(rec.id)}`, { method: 'DELETE' });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
          deleted += 1;
        } catch (error) { failures.push(`${rec.filename || rec.id}: ${error.message}`); }
      }
      if (candidates.some((rec) => String(rec.id) === String(selectedId))) setSelectedId(null);
      setReloadToken((token) => token + 1);
      await loadRetentionPreview();
      addToast(`${deleted} recording(s) deleted${failures.length ? `; ${failures.length} could not be deleted` : ''}.`, failures.length ? 'info' : 'success', 6000);
    } finally { setRetentionDeleting(false); }
  }, [addToast, loadRetentionPreview, retentionDays, retentionDeleting, retentionPreview, selectedId]);

  const formatStorageBytes = (value) => {
    const bytes = Number(value || 0);
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** exponent)).toFixed(exponent > 1 ? 1 : 0)} ${units[exponent]}`;
  };

  const clearAll = () => { setAvailability('all'); setTriggerFilter('all'); onClearSearch?.(); };

  const selectedState = selected ? stateOf(selected) : null;
  const downloadReason = selectedState === MEDIA_STATE.UNAVAILABLE ? MEDIA_UNAVAILABLE_REASON
    : selectedState === MEDIA_STATE.CHECKING ? MEDIA_CHECKING_REASON : '';

  const showControls = loadState === 'ready' && recordings.length > 0;

  return (
    <div className="space-y-6">
      {selected && (
        <VideoPlayerModal
          key={selected.id}
          recording={selected}
          url={getRecordingUrl(selected)}
          mediaState={selectedState}
          onClose={() => setSelectedId(null)}
          onDownload={() => handleDownload(selected)}
          downloading={downloadingId === selected.id}
          downloadDisabledReason={downloadReason || (downloadingId && downloadingId !== selected.id ? 'Another download is in progress.' : '')}
          onShare={() => handleShare(selected)}
          shareDisabledReason={getShareUrl(selected) ? '' : SHARE_UNAVAILABLE_REASON}
          onVerify={() => handleVerify(selected)}
          verifying={verifyingId === selected.id}
        />
      )}

      <PageHeader
        eyebrow="Recording library"
        title="Recordings"
        description="Clips recorded from the camera viewer. Each entry is checked against the server to confirm its video file can be retrieved."
      />

      <section className="card space-y-4 p-4 sm:p-5" aria-labelledby="storage-retention-title">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-surface-sunken p-3"><HardDrive aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="storage-retention-title" className="font-semibold text-fg">Storage & retention</h2>
            <p className="mt-1 text-sm text-fg-muted">Review account storage and preview older recordings before deleting anything. No automatic cleanup runs in the background.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <label htmlFor="retention-days" className="text-small text-fg-muted">Find recordings older than</label>
            <select id="retention-days" className="select" value={retentionDays} onChange={(event) => { setRetentionDays(event.target.value); setRetentionPreview(null); }}>
              {[7, 30, 60, 90, 180, 365].map((days) => <option key={days} value={days}>{days} days</option>)}
            </select>
          </div>
          <Button icon={CalendarClock} onClick={loadRetentionPreview} disabled={retentionLoading || retentionDeleting}>
            {retentionLoading ? 'Preparing preview…' : 'Preview retention'}
          </Button>
        </div>
        {retentionPreview && (
          <div className="space-y-3" aria-live="polite">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border-subtle p-3"><p className="text-xs text-fg-muted">Recorded storage total</p><p className="mt-1 text-lg font-semibold">{formatStorageBytes(retentionPreview.total_bytes)}</p><p className="text-xs text-fg-muted">{retentionPreview.total_recordings} entries</p></div>
              <div className="rounded-xl border border-border-subtle p-3"><p className="text-xs text-fg-muted">Local / internal</p><p className="mt-1 text-lg font-semibold">{formatStorageBytes(retentionPreview.local_bytes)}</p></div>
              <div className="rounded-xl border border-border-subtle p-3"><p className="text-xs text-fg-muted">Cloud metadata</p><p className="mt-1 text-lg font-semibold">{formatStorageBytes(retentionPreview.cloud_bytes)}</p></div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-surface-sunken p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{retentionPreview.candidate_count} eligible recording(s)</p><p className="text-sm text-fg-muted">Listed size: {formatStorageBytes(retentionPreview.candidate_bytes)}{retentionPreview.truncated ? ' · Preview capped at 500 entries; rerun after cleanup to review more.' : ''}</p></div>
              <Button variant="danger" icon={Trash2} disabled={!retentionPreview.candidate_count || retentionDeleting || retentionPreview.truncated} onClick={runRetentionCleanup}>
                {retentionDeleting ? 'Cleaning up…' : 'Delete previewed recordings'}
              </Button>
            </div>
            {retentionPreview.candidates.length > 0 && (
              <ul className="max-h-56 space-y-2 overflow-y-auto" aria-label="Retention candidates">
                {retentionPreview.candidates.slice(0, 12).map((candidate) => <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{candidate.filename}</span><span className="text-xs text-fg-muted">{candidate.camera_id} · {candidate.trigger_type} · {new Date(candidate.created_at).toLocaleString()}</span></span><span className="text-fg-muted">{formatStorageBytes(candidate.file_size_bytes)}</span></li>)}
                {retentionPreview.candidates.length > 12 && <li className="text-xs text-fg-muted">Showing 12 of {retentionPreview.candidate_count} candidates in this preview.</li>}
              </ul>
            )}
            <p className="text-xs text-fg-muted">{retentionPreview.note} Storage figures are based on recorded metadata and may differ from actual bytes until files are verified.</p>
          </div>
        )}
      </section>

      {showControls && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Filter by video availability" className="segmented self-start">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="segmented-item"
                  aria-pressed={availability === f.id}
                  onClick={() => setAvailability(f.id)}
                >
                  {f.label}
                  <span className="segmented-count">
                    {f.id === 'all' ? recordings.length : f.id === MEDIA_STATE.AVAILABLE ? counts.available : counts.unavailable}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="recordings-sort" className="text-small text-fg-muted">Sort by date</label>
              <select
                id="recordings-sort"
                className="select !w-auto"
                value={newestFirst ? 'newest' : 'oldest'}
                onChange={(e) => setNewestFirst(e.target.value === 'newest')}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="recording-trigger-filter" className="text-small text-fg-muted">Recording source</label>
            <select id="recording-trigger-filter" className="select !w-auto" value={triggerFilter} onChange={(event) => setTriggerFilter(event.target.value)}>
              <option value="all">All sources</option>
              <option value="manual">Manual</option>
              <option value="motion">Motion events</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>

          <p className="meta-text" role="status" aria-live="polite">
            {visible.length === recordings.length
              ? `${recordings.length} ${recordings.length === 1 ? 'entry' : 'entries'} returned by the server`
              : `Showing ${visible.length} of ${recordings.length} entries`}
            {' · '}
            {counts.checking > 0
              ? `checking ${counts.checking} video ${counts.checking === 1 ? 'file' : 'files'}…`
              : `${counts.available} with a video file, ${counts.unavailable} without`}
          </p>
        </div>
      )}

      {showControls && counts.checking === 0 && counts.unavailable > 0 && (
        <div role="status" className="callout callout-warning">
          <FileX aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p>
              {counts.unavailable === recordings.length
                ? 'The server cannot supply a video file for any of these entries.'
                : `The server cannot supply a video file for ${counts.unavailable} of ${recordings.length} entries.`}
              {' '}Playback and download are turned off for them. If this affects every entry, the server&apos;s video endpoint may not be available.
            </p>
          </div>
          <Button size="sm" icon={RefreshCw} onClick={() => setProbeToken((t) => t + 1)}>Check again</Button>
        </div>
      )}

      {loadState === 'loading' && <SkeletonGrid />}

      {loadState === 'error' && (
        <EmptyState
          tone="error"
          icon={FileX}
          title="Recordings could not be loaded"
          description={`The recording list could not be retrieved. ${result.error}`}
          action={<Button icon={RefreshCw} onClick={() => setReloadToken((t) => t + 1)}>Try again</Button>}
        />
      )}

      {loadState === 'ready' && recordings.length === 0 && (
        <EmptyState
          icon={Film}
          title="No recordings yet"
          description="Record a clip from an active camera using the recording controls in the camera viewer. Your saved recording entries will appear here."
        />
      )}

      {loadState === 'ready' && recordings.length > 0 && visible.length === 0 && (
        <EmptyState
          icon={hasQuery ? SearchX : ListFilter}
          title={hasQuery ? 'No recordings match your search' : 'No recordings match this filter'}
          description={hasQuery
            ? `Nothing matches “${searchQuery.trim()}”${hasFilter ? ' with the selected filter' : ''}. Search looks at file names and camera IDs.`
            : counts.checking > 0
              ? 'Some video files are still being checked, so this list may fill in shortly.'
              : 'No entries match the selected availability and recording source.'}
          action={(hasQuery || hasFilter) && <Button onClick={clearAll}>{hasQuery ? 'Clear search and filters' : 'Show all entries'}</Button>}
        />
      )}

      {loadState === 'ready' && visible.length > 0 && (
        <ul className={GRID} aria-label="Recordings">
          {visible.map((rec) => (
            <li key={rec.id} className="min-w-0">
              <RecordingCard
                recording={rec}
                mediaState={stateOf(rec)}
                downloading={downloadingId === rec.id}
                anyDownloading={Boolean(downloadingId)}
                onOpen={() => setSelectedId(rec.id)}
                onDownload={() => handleDownload(rec)}
                onShare={() => handleShare(rec)}
                onDelete={() => handleDelete(rec)}
                deleting={deletingId === rec.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Recordings;
