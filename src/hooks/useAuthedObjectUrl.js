import { useEffect, useState } from 'react';
import { authFetch, readErrorMessage, describeFailure } from '../lib/api';

/**
 * Loads a protected file with the session token and exposes it as a blob: URL.
 *
 * Why: the backend only accepts "Authorization: Bearer ..." headers (server/auth.cjs), and a <video src="/api/videos/x">
 * element cannot send headers, so direct playback is answered with 401. Fetching with authFetch and playing the Blob works
 * with the existing API unchanged. The object URL is revoked on cleanup and the request aborted when the player closes.
 *
 * `attempt` lets callers force a re-download (retry). State is tagged with the request key so a stale result
 * is never shown for a different file.
 */
const REVOKE_DELAY_MS = 2000;

export default function useAuthedObjectUrl(url, enabled, attempt = 0) {
  const key = enabled && url ? `${url}#${attempt}` : null;
  const [result, setResult] = useState({ key: null, objectUrl: '', error: '' });

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    let objectUrl = '';
    (async () => {
      try {
        const res = await authFetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        if (!blob.size) throw new Error('The server sent an empty file.');
        objectUrl = URL.createObjectURL(blob);
        setResult({ key, objectUrl, error: '' });
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        setResult({ key, objectUrl: '', error: describeFailure(err) });
      }
    })();
    return () => {
      controller.abort();
      // Revoke after the <video> element has detached; revoking at once makes browsers log a failed blob load.
      if (objectUrl) { const stale = objectUrl; setTimeout(() => URL.revokeObjectURL(stale), REVOKE_DELAY_MS); }
    };
  }, [key, url]);

  const current = result.key === key;
  return {
    objectUrl: current ? result.objectUrl : '',
    error: current ? result.error : '',
    loading: Boolean(key) && !(current && (result.objectUrl || result.error)),
  };
}
