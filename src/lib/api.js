/**
 * Small helpers shared by the management screens. They never invent data:
 * a failure is reported as a failure, with a message a person can act on.
 */

export const getAuthToken = () => {
  try {
    const directToken = localStorage.getItem('mycam_token');
    if (directToken && typeof directToken === 'string' && directToken.trim()) {
      return directToken.trim();
    }
    const stored = JSON.parse(localStorage.getItem('mycam_user') || 'null');
    return typeof stored?.token === 'string' ? stored.token.trim() : '';
  } catch {
    // mycam_user was unreadable; apply the same trimming rules to the direct token.
    try { return (localStorage.getItem('mycam_token') || '').trim(); } catch { return ''; }
  }
};

export const authHeaders = (headers = {}) => {
  const token = getAuthToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
};

export const authFetch = (url, options = {}) => fetch(url, {
  ...options,
  headers: authHeaders(options.headers || {}),
});

/** Friendly text for a failed fetch (network error vs server response). */
export const describeFailure = (err) => {
  if (err?.name === 'TypeError') return 'Could not reach the server.';
  return err?.message || 'Something went wrong.';
};

/** Read `{ message }` from an error response without throwing on non-JSON bodies. */
export const readErrorMessage = async (res) => {
  let reason = `The server responded with ${res.status}.`;
  try {
    const body = await res.json();
    if (body?.message) reason = body.message;
  } catch { /* non-JSON body */ }
  return reason;
};

/**
 * Send a JSON request. Resolves with the parsed body (or null if there is none)
 * only for a 2xx response; otherwise throws an Error whose message is shown to the user.
 */
export const sendJson = async (url, method, body) => {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server.');
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));
  try { return await res.json(); } catch { return null; }
};

/** Upload a FormData payload with authenticated headers and upload progress reporting. */
export const authUpload = (url, formData, headers = {}, onProgress = () => {}) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  const token = getAuthToken();
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
  });
  xhr.addEventListener('load', () => {
    let body = {};
    try { body = JSON.parse(xhr.responseText || '{}'); } catch { body = {}; }
    resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body, headers: { get: (name) => xhr.getResponseHeader(name) } });
  });
  xhr.addEventListener('error', () => reject(new TypeError('Could not reach the server.')));
  xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled.')));
  xhr.send(formData);
});
