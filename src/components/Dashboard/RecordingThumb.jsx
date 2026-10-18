import React, { useState } from 'react';
import { Film, Loader2, FileX, Play } from 'lucide-react';
import { MEDIA_STATE, getThumbnailUrl } from '../../lib/recordingMedia';

/**
 * Preview surface shared by the library cards. It shows a genuine thumbnail only
 * when the record has a usable thumbnail URL and that image actually loads;
 * otherwise a neutral placeholder. Media state is shown as an icon + label.
 */
const RecordingThumb = ({ recording, mediaState, className = '' }) => {
  const thumbUrl = getThumbnailUrl(recording);
  const [failedUrl, setFailedUrl] = useState(null);
  const showImage = Boolean(thumbUrl) && failedUrl !== thumbUrl;
  const unavailable = mediaState === MEDIA_STATE.UNAVAILABLE;

  return (
    <div className={`relative flex aspect-video w-full items-center justify-center overflow-hidden bg-surface-sunken ${className}`}>
      {showImage ? (
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          onError={() => setFailedUrl(thumbUrl)}
          className={`absolute inset-0 size-full object-cover ${unavailable ? 'opacity-40' : ''}`}
        />
      ) : null}

      <span className="relative flex flex-col items-center gap-2.5 text-fg-subtle">
        {!showImage && mediaState !== MEDIA_STATE.AVAILABLE && (
          <Film className="size-9 text-border-strong" aria-hidden="true" strokeWidth={1.5} />
        )}
        {mediaState === MEDIA_STATE.AVAILABLE && (
          <span className="flex size-11 items-center justify-center rounded-full border border-accent/40 bg-background/70 text-accent transition-transform group-hover:scale-105">
            <Play className="ml-0.5 size-4" fill="currentColor" aria-hidden="true" />
          </span>
        )}
        {mediaState === MEDIA_STATE.CHECKING && (
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Checking file…
          </span>
        )}
        {unavailable && (
          <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-background/85 px-2.5 py-1 text-xs font-medium text-warning">
            <FileX className="size-3.5" aria-hidden="true" /> Video unavailable
          </span>
        )}
      </span>
    </div>
  );
};

export default RecordingThumb;
