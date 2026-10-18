import React, { useRef, useState } from 'react';
import { Film, Loader2, AlertTriangle, FileX, Download, Share2, RotateCcw, ShieldCheck } from 'lucide-react';
import { Modal, Button, StatusBadge } from '../ui';
import { MEDIA_STATE, formatDateTime, formatDuration, formatFileSize } from '../../lib/recordingMedia';

const describeMediaError = (error) => {
  switch (error?.code) {
    case 1: return 'Playback was cancelled.';
    case 2: return 'A network error interrupted loading the video.';
    case 3: return 'The browser could not decode this video file.';
    case 4: return 'The video file is missing or its format is not supported by this browser.';
    default: return 'The video could not be played.';
  }
};

const Notice = ({ icon, spin, tone = 'neutral', title, children, role = 'status', action }) => (
  <div className="max-w-sm px-6 py-8 text-center" role={role}>
    <div className={`mx-auto mb-3 flex size-14 items-center justify-center rounded-full border bg-surface ${tone === 'warning' ? 'border-warning/30' : tone === 'danger' ? 'border-danger/30' : 'border-border'}`}>
      {React.createElement(icon, {
        className: `size-6 ${tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-fg-subtle'} ${spin ? 'animate-spin' : ''}`,
        'aria-hidden': true,
      })}
    </div>
    <p className="text-body font-semibold text-fg">{title}</p>
    <p className="mt-1 text-small text-fg-muted">{children}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

const Detail = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="meta-text">{label}</dt>
    <dd className="mt-0.5 break-words text-small text-fg [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

/**
 * Plays a real recording. The <video> element is mounted only when `mediaState`
 * is AVAILABLE (the server was confirmed to supply the file). CHECKING and
 * UNAVAILABLE both render a status panel instead, never a player.
 */
const VideoPlayerModal = ({
  recording, url, mediaState = MEDIA_STATE.CHECKING, onClose,
  onDownload, downloading, downloadDisabledReason, onShare, shareDisabledReason, onVerify, verifying = false,
}) => {
  const videoRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [attempt, setAttempt] = useState(0);

  if (!recording) return null;

  const canPlay = Boolean(url) && mediaState === MEDIA_STATE.AVAILABLE;
  const date = formatDateTime(recording.created_at);
  const duration = formatDuration(recording.duration);
  const size = formatFileSize(recording.file_size_bytes);
  const badge = mediaState === MEDIA_STATE.AVAILABLE
    ? <StatusBadge status="success" label="Video found" />
    : mediaState === MEDIA_STATE.UNAVAILABLE
      ? <StatusBadge status="warning" label="Video unavailable" />
      : <StatusBadge status="connecting" label="Checking file" />;
  const helper = [downloadDisabledReason, shareDisabledReason].filter(Boolean).join(' ');

  const retry = () => { setErrorText(''); setLoaded(false); setAttempt((n) => n + 1); };

  return (
    <Modal
      title={recording.camera_id ? `Recording from ${recording.camera_id}` : 'Recording'}
      subtitle={date || 'Capture time unknown'}
      headerExtra={badge}
      closeLabel="Close player"
      onClose={onClose}
      footer={(
        <>
          {helper && <p className="meta-text min-w-0 basis-full sm:basis-0 sm:flex-1" role="status">{helper}</p>}
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <Button size="sm" variant="secondary" icon={ShieldCheck} onClick={onVerify} loading={verifying} disabled={verifying} title="Check whether the file still exists in storage">
              {verifying ? 'Checking…' : 'Check file'}
            </Button>
            <Button
              size="sm" icon={Download} onClick={onDownload} loading={downloading}
              disabled={Boolean(downloadDisabledReason)}
              title={downloadDisabledReason || 'Download this recording'}
            >
              {downloading ? 'Downloading…' : 'Download'}
            </Button>
            <Button
              size="sm" icon={Share2} onClick={onShare}
              disabled={Boolean(shareDisabledReason)}
              title={shareDisabledReason || 'Share this recording'}
            >
              Share
            </Button>
          </div>
        </>
      )}
    >
      {/* Fixed 16:9 well: no layout shift when media loads; portrait video is letterboxed, never cropped */}
      <div className="relative flex aspect-video max-h-[62dvh] w-full items-center justify-center overflow-hidden bg-surface-sunken">
        {canPlay && !errorText && (
          <video
            key={attempt}
            ref={videoRef}
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label={`Recording ${recording.filename || ''}`.trim()}
            onLoadedData={() => setLoaded(true)}
            onError={() => setErrorText(describeMediaError(videoRef.current?.error))}
            className="size-full object-contain"
          />
        )}
        {canPlay && !errorText && !loaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-sunken/70">
            <Notice icon={Loader2} spin title="Loading recording">Waiting for the server to send the video.</Notice>
          </div>
        )}
        {canPlay && errorText && (
          <Notice
            icon={AlertTriangle} tone="danger" role="alert" title="Playback failed"
            action={<Button size="sm" icon={RotateCcw} onClick={retry}>Try again</Button>}
          >
            {errorText}
          </Notice>
        )}
        {!canPlay && mediaState === MEDIA_STATE.CHECKING && (
          <Notice icon={Loader2} spin title="Checking video file">Confirming that the server can supply this recording.</Notice>
        )}
        {!canPlay && mediaState !== MEDIA_STATE.CHECKING && (
          <Notice icon={mediaState === MEDIA_STATE.UNAVAILABLE ? FileX : Film} tone="warning" title="Video unavailable">
            This recording entry exists, but the server cannot supply its video file.
          </Notice>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-5 py-4 sm:grid-cols-4">
        <Detail label="File name">{recording.filename || 'Unknown'}</Detail>
        <Detail label="Recorded">{date || 'Unknown'}</Detail>
        <Detail label="Duration">{duration || 'Not recorded'}</Detail>
        <Detail label="File size">{size || 'Not reported'}</Detail>
      </dl>
    </Modal>
  );
};

export default VideoPlayerModal;
