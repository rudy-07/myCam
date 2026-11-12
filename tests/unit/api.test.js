import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAuthToken, authHeaders, authFetch, describeFailure, readErrorMessage, sendJson, authUpload } from '../../src/lib/api';
import { installFetch, jsonResponse, parseBody } from '../helpers/fetch';

describe('getAuthToken / authHeaders', () => {
  it('returns an empty string when signed out', () => expect(getAuthToken()).toBe(''));
  it('reads and trims mycam_token', () => { localStorage.setItem('mycam_token', '  abc  '); expect(getAuthToken()).toBe('abc'); });
  it('falls back to a token inside mycam_user', () => { localStorage.setItem('mycam_user', JSON.stringify({ token: ' xyz ' })); expect(getAuthToken()).toBe('xyz'); });
  it('prefers mycam_token over the user object', () => {
    localStorage.setItem('mycam_token', 'direct'); localStorage.setItem('mycam_user', JSON.stringify({ token: 'embedded' }));
    expect(getAuthToken()).toBe('direct');
  });
  it('ignores a blank token and a corrupt user record without throwing', () => {
    localStorage.setItem('mycam_token', '   '); localStorage.setItem('mycam_user', '{broken');
    expect(getAuthToken()).toBe('');
  });
  it('adds a Bearer header only when a token exists and keeps other headers', () => {
    expect(authHeaders({ A: '1' })).toEqual({ A: '1' });
    localStorage.setItem('mycam_token', 't');
    expect(authHeaders({ A: '1' })).toEqual({ A: '1', Authorization: 'Bearer t' });
  });
});

describe('authFetch', () => {
  it('passes options through and adds the token', async () => {
    localStorage.setItem('mycam_token', 't');
    const f = installFetch(() => jsonResponse([]));
    await authFetch('/api/x', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(f.calls[0]).toMatchObject({ method: 'PUT', url: '/api/x' });
    expect(f.calls[0].headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer t' });
  });
});

describe('describeFailure / readErrorMessage', () => {
  it('distinguishes network from other errors', () => {
    expect(describeFailure(new TypeError('x'))).toBe('Could not reach the server.');
    expect(describeFailure(new Error('Nope'))).toBe('Nope');
    expect(describeFailure(undefined)).toBe('Something went wrong.');
    expect(describeFailure({})).toBe('Something went wrong.');
  });
  it('prefers the server message and falls back to the status', async () => {
    expect(await readErrorMessage(jsonResponse({ message: 'Bad' }, 400))).toBe('Bad');
    expect(await readErrorMessage(new Response('<html>', { status: 502 }))).toBe('The server responded with 502.');
    expect(await readErrorMessage(jsonResponse({}, 500))).toBe('The server responded with 500.');
  });
});

describe('sendJson', () => {
  it('sends a JSON body with the content type and token', async () => {
    localStorage.setItem('mycam_token', 't');
    const f = installFetch(() => jsonResponse({ ok: 1 }));
    expect(await sendJson('/api/x', 'POST', { a: 1 })).toEqual({ ok: 1 });
    expect(f.calls[0].headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer t' });
    expect(parseBody(f.calls[0])).toEqual({ a: 1 });
  });
  it('sends no body or content type when none is given (DELETE)', async () => {
    const f = installFetch(() => jsonResponse({ message: 'deleted' }));
    await sendJson('/api/x/1', 'DELETE');
    expect(f.calls[0].body).toBeUndefined();
    expect(f.calls[0].headers['Content-Type']).toBeUndefined();
  });
  it('resolves null for an empty success body', async () => {
    installFetch(() => new Response(null, { status: 204 }));
    expect(await sendJson('/x', 'DELETE')).toBeNull();
  });
  it('throws the server message for a failed response', async () => {
    installFetch(() => jsonResponse({ message: 'Missing required fields' }, 400));
    await expect(sendJson('/x', 'POST', {})).rejects.toThrow('Missing required fields');
  });
  it('throws a friendly message when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
    await expect(sendJson('/x', 'POST', {})).rejects.toThrow('Could not reach the server.');
  });
});

describe('authUpload (XMLHttpRequest stand-in; the transport is faked, the function logic is real)', () => {
  let instances;
  const FakeXHR = class {
    constructor() { this.headers = {}; this.listeners = {}; this.upload = { listeners: {}, addEventListener: (n, h) => { this.upload.listeners[n] = h; } }; instances.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(n, v) { this.headers[n] = v; }
    addEventListener(n, h) { this.listeners[n] = h; }
    getResponseHeader(n) { return n === 'X-Test' ? 'yes' : null; }
    send(body) { this.body = body; }
  };
  const setup = () => { instances = []; vi.stubGlobal('XMLHttpRequest', FakeXHR); };
  afterEach(() => vi.unstubAllGlobals());

  it('posts with auth and custom headers, reports clamped progress and resolves with the parsed body', async () => {
    setup(); localStorage.setItem('mycam_token', 't');
    const progress = vi.fn(); const fd = new FormData();
    const p = authUpload('/api/upload', fd, { 'X-Custom': '1' }, progress);
    const xhr = instances[0];
    expect(xhr).toMatchObject({ method: 'POST', url: '/api/upload', body: fd });
    expect(xhr.headers).toEqual({ Authorization: 'Bearer t', 'X-Custom': '1' });
    xhr.upload.listeners.progress({ lengthComputable: true, loaded: 50, total: 200 });
    xhr.upload.listeners.progress({ lengthComputable: true, loaded: 999, total: 200 });
    xhr.upload.listeners.progress({ lengthComputable: false, loaded: 1, total: 0 });
    expect(progress.mock.calls.map((c) => c[0])).toEqual([25, 100]);
    xhr.status = 201; xhr.responseText = '{"id":5}'; xhr.listeners.load();
    const res = await p;
    expect(res).toMatchObject({ ok: true, status: 201, body: { id: 5 } });
    expect(res.headers.get('X-Test')).toBe('yes');
  });
  it('reports non-2xx as ok:false and tolerates non-JSON bodies', async () => {
    setup();
    const p = authUpload('/x', new FormData());
    instances[0].status = 413; instances[0].responseText = '<html>'; instances[0].listeners.load();
    expect(await p).toMatchObject({ ok: false, status: 413, body: {} });
  });
  it('rejects on network error and on abort', async () => {
    setup();
    const a = authUpload('/x', new FormData()); instances[0].listeners.error();
    await expect(a).rejects.toThrow('Could not reach the server.');
    const b = authUpload('/x', new FormData()); instances[1].listeners.abort();
    await expect(b).rejects.toThrow('Upload was cancelled.');
  });
  it('sends no Authorization header when signed out', () => {
    setup(); authUpload('/x', new FormData());
    expect(instances[0].headers.Authorization).toBeUndefined();
  });
});
