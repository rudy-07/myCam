import { useEffect, useState, useCallback } from 'react';
import { readErrorMessage, describeFailure, authFetch } from '../lib/api';

/**
 * GET a JSON resource with honest states.
 *
 *  - `loading`    : first request in flight (no data yet)
 *  - `refreshing` : a later request is in flight; the previous data stays visible
 *  - `error`      : the LAST request failed. `data` still holds the last good value
 *                   (if any), so a failed refresh never turns into an empty screen.
 *
 * `validate(json)` must return the value to store or throw to reject the response.
 * Results are keyed by request, so "loading" is derived rather than set inside the
 * effect, and a response for an old URL/retry can never overwrite a newer one.
 */
const useApiResource = (url, validate) => {
  const [token, setToken] = useState(0);
  const requestKey = url ? `${url}#${token}` : null;
  const [state, setState] = useState({ url: null, key: null, data: null, error: '' });

  useEffect(() => {
    if (!url) return undefined;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await authFetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        let json;
        try { json = await res.json(); } catch { throw new Error('The server sent a response that is not valid data.'); }
        const data = validate(json);
        setState({ url, key: requestKey, data, error: '' });
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setState((prev) => ({
          url, key: requestKey, error: describeFailure(err),
          data: prev.url === url ? prev.data : null,
        }));
      }
    })();
    return () => controller.abort();
  // `validate` is expected to be a stable module-level function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, requestKey]);

  const sameResource = state.url === url;
  const data = sameResource ? state.data : null;
  const settled = state.key === requestKey;

  const reload = useCallback(() => setToken((t) => t + 1), []);
  /** Patch the held data after a mutation the server confirmed. */
  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);

  return {
    data,
    loading: !settled && data === null,
    refreshing: !settled && data !== null,
    error: settled ? state.error : '',
    reload,
    setData,
  };
};

export const requireArray = (json) => {
  if (!Array.isArray(json)) throw new Error('The server sent a response that is not a list.');
  return json;
};

export default useApiResource;
