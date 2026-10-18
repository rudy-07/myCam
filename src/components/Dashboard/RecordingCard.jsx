import React from 'react';
import { Calendar, Download, Share2, HardDrive, Camera, Trash2, Activity, Clock }  from 'lucide-react';
import { Button } from '../ui';
import RecordingThumb from './RecordingThumb';
import {
  MEDIA_STATE, MEDIA_UNAVAILABLE_REASON, MEDIA_CHECKING_REASON,
  formatDateTime, formatDuration, formatFileSize, getShareUrl,
} from '../../lib/recordingMedia';

const STATE_LABEL = {
  [MEDIA_STATE.AVAILABLE]: 'video file found',
  [MEDIA_STATE.CHECKING]: 'checking video file',
  [MEDIA_STATE.UNAVAILABLE]: 'video unavailable',
};

/**
 * One library entry. The preview is the only "open" control; download/share are
 * siblings (never nested inside the preview button), so nothing triggers twice.
 */
const RecordingCard = ({ recording, mediaState, downloading, anyDownloading, onOpen, onDownload, onShare, onDelete, deleting }) => {
  const filename = recording.filename || 'Untitled recording';
  const date = formatDateTime(recording.created_at);
  const duration = formatDuration(recording.duration);
  const size = formatFileSize(recording.file_size_bytes);
  const shareUrl = getShareUrl(recording);

  const downloadReason = mediaState === MEDIA_STATE.UNAVAILABLE ? MEDIA_UNAVAILABLE_REASON
    : mediaState === MEDIA_STATE.CHECKING ? MEDIA_CHECKING_REASON : '';

  return (
    <article className="card group flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:border-border-strong">
      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full text-left"
        aria-label={`Open ${filename}, ${STATE_LABEL[mediaState] || STATE_LABEL[MEDIA_STATE.CHECKING]}`}
      >
        <RecordingThumb recording={recording} mediaState={mediaState} />
        {recording.camera_id && (
          <span className="badge badge-neutral absolute left-2.5 top-2.5 max-w-[60%] bg-background/80">
            <Camera className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{recording.camera_id}</span>
          </span>
        )}
        {duration && (
          <span className="absolute bottom-2.5 right-2.5 rounded-md border border-border bg-background/85 px-2 py-0.5 font-mono text-xs font-semibold text-fg">
            <span className="sr-only">Duration </span>{duration}
          </span>
        )}
        {recording.trigger_type && recording.trigger_type !== 'manual' && (
          <span className="badge badge-accent absolute right-2.5 top-2.5 max-w-[45%] bg-background/85" title={`Recording trigger: ${recording.trigger_type}`}>
            {recording.trigger_type === 'motion' ? <Activity className="size-3" aria-hidden="true" /> : <Clock className="size-3" aria-hidden="true" />}
            <span>{recording.trigger_type === 'motion' ? 'Motion event' : 'Scheduled'}</span>
          </span>
        )}
      </button>

      <div className="flex flex-1 items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-small font-semibold text-fg" title={filename}>{filename}</h3>
          <dl className="mt-1.5 space-y-1">
            <div className="meta-text flex items-center gap-1.5">
              <dt className="sr-only">Recorded</dt>
              <Calendar className="size-3 shrink-0" aria-hidden="true" />
              <dd className="min-w-0 truncate">{date || 'Date unknown'}</dd>
            </div>
            {size && (
              <div className="meta-text flex items-center gap-1.5">
                <dt className="sr-only">File size</dt>
                <HardDrive className="size-3 shrink-0" aria-hidden="true" />
                <dd>{size}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost" size="sm" iconOnly icon={Trash2}
            loading={deleting}
            disabled={deleting || downloading}
            onClick={onDelete}
            title="Delete recording"
            aria-label={`Delete ${filename}`}
          />
          <Button
            variant="ghost" size="sm" iconOnly icon={Download}
            loading={downloading}
            disabled={Boolean(downloadReason) || (anyDownloading && !downloading)}
            onClick={onDownload}
            title={downloadReason || 'Download clip'}
            aria-label={downloadReason ? `Download ${filename} (unavailable)` : `Download ${filename}`}
          />
          {shareUrl && (
            <Button
              variant="ghost" size="sm" iconOnly icon={Share2}
              onClick={onShare}
              title="Share link"
              aria-label={`Share ${filename}`}
            />
          )}
        </div>
      </div>
    </article>
  );
};

export default React.memo(RecordingCard);
