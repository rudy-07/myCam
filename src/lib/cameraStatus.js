/**
 * Camera connection states. A camera is only "live" once the WebRTC peer
 * connection is connected AND a video track has been received.
 */
export const CAMERA_STATUS = {
  CONNECTING: 'connecting',
  LIVE: 'live',
  OFFLINE: 'offline',
  ERROR: 'error',
};

/** Summarise an array of status strings into counts + a neutral sentence. */
export const summarizeStatuses = (statuses) => {
  const counts = { live: 0, connecting: 0, offline: 0, error: 0 };
  statuses.forEach((s) => { if (counts[s] !== undefined) counts[s] += 1; });
  const total = statuses.length;
  let text;
  if (total === 0) text = 'No cameras to report on';
  else if (counts.live === total) text = `${counts.live} of ${total} camera${total > 1 ? 's' : ''} live`;
  else {
    const parts = [];
    if (counts.live) parts.push(`${counts.live} live`);
    if (counts.connecting) parts.push(`${counts.connecting} connecting`);
    if (counts.offline) parts.push(`${counts.offline} offline`);
    if (counts.error) parts.push(`${counts.error} with errors`);
    text = parts.join(' · ');
  }
  return { counts, total, text };
};
