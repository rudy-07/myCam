import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getRecordingUrl, getShareUrl, parseTimestamp, formatDateTime, formatDuration, formatFileSize, getThumbnailUrl,
  sortRecordings, matchesQuery, probeMedia, probeRecordings, downloadRecording, shareLink, MEDIA_STATE,
} from '../../src/lib/recordingMedia';
import { installFetch } from '../helpers/fetch';

const head = (status, type) => new Response(null, { status, headers: type ? { 'content-type': type } : {} });

describe('getRecordingUrl / getShareUrl / getThumbnailUrl', () => {
  it('builds the existing /api/videos/<filename> URL and encodes the name', () => {
    expect(getRecordingUrl({ filename: 'a b#1.webm' })).toBe('/api/videos/a%20b%231.webm');
  });
  it('returns null without a filename', () => {
    expect(getRecordingUrl({})).toBeNull();
    expect(getRecordingUrl(null)).toBeNull();
  });
  it('only returns a share URL the backend supplied', () => {
    expect(getShareUrl({ share_url: 'https://x/s/1' })).toBe('https://x/s/1');
    expect(getShareUrl({ shareUrl: 'https://x/s/2' })).toBe('https://x/s/2');
    expect(getShareUrl({})).toBeNull();
  });
  it('accepts http(s) and root-relative thumbnails only', () => {
    expect(getThumbnailUrl({ thumbnail_url: 'https://cdn/x.jpg' })).toBe('https://cdn/x.jpg');
    expect(getThumbnailUrl({ thumbnail_url: '/uploads/x.jpg' })).toBe('/uploads/x.jpg');
    expect(getThumbnailUrl({ thumbnail_url: '//evil.example/x.jpg' })).toBeNull();
    expect(getThumbnailUrl({ thumbnail_url: 'javascript:alert(1)' })).toBeNull();
    expect(getThumbnailUrl({ thumbnail_url: '  ' })).toBeNull();
    expect(getThumbnailUrl({})).toBeNull();
  });
});

describe('metadata formatters never invent values', () => {
  it('parseTimestamp', () => {
    expect(parseTimestamp('2026-01-02T03:04:05Z')).toBe(Date.parse('2026-01-02T03:04:05Z'));
    expect(parseTimestamp(new Date(5))).toBe(5);
    expect(parseTimestamp('nope')).toBeNull();
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
  });
  it('formatDateTime returns null for invalid dates and text for valid ones', () => {
    expect(formatDateTime('garbage')).toBeNull();
    expect(typeof formatDateTime('2026-01-02T03:04:05Z')).toBe('string');
  });
  it.each([
    ['02:15', '02:15'], ['  02:15 ', '02:15'], [75, '01:15'], [3725, '1:02:05'], [59.6, '01:00'],
    [0, null], [-5, null], [NaN, null], ['', null], ['   ', null], [null, null], [undefined, null],
  ])('formatDuration(%j) -> %j', (input, out) => expect(formatDuration(input)).toBe(out));
  it.each([
    [512, '512 B'], [1536, '1.5 KB'], [1048576, '1.0 MB'], [150 * 1048576, '150 MB'], [5 * 1024 ** 3, '5.0 GB'],
    [0, null], [-1, null], ['abc', null], ['', null], [null, null], [undefined, null], ['2048', '2.0 KB'],
  ])('formatFileSize(%j) -> %j', (input, out) => expect(formatFileSize(input)).toBe(out));
});

describe('sortRecordings', () => {
  const list = [
    { id: 'old', created_at: '2026-01-01T00:00:00Z' },
    { id: 'bad', created_at: 'not a date' },
    { id: 'new', created_at: '2026-03-01T00:00:00Z' },
    { id: 'none' },
    { id: 'mid', created_at: '2026-02-01T00:00:00Z' },
  ];
  it('puts newest first and invalid dates last', () => expect(sortRecordings(list).map((r) => r.id).slice(0, 3)).toEqual(['new', 'mid', 'old']));
  it('puts oldest first and still keeps invalid dates last', () => {
    const ids = sortRecordings(list, false).map((r) => r.id);
    expect(ids.slice(0, 3)).toEqual(['old', 'mid', 'new']);
    expect(ids.slice(3).sort()).toEqual(['bad', 'none']);
  });
  it('does not mutate its input', () => {
    const copy = JSON.stringify(list);
    sortRecordings(list);
    expect(JSON.stringify(list)).toBe(copy);
  });
  it('handles an empty list', () => expect(sortRecordings([])).toEqual([]));
});

describe('matchesQuery', () => {
  const rec = { filename: 'Garage_2026.webm', camera_id: 'mobile' };
  it('matches everything for an empty query', () => { expect(matchesQuery(rec, '')).toBe(true); expect(matchesQuery(rec, '   ')).toBe(true); expect(matchesQuery(rec, undefined)).toBe(true); });
  it('is case-insensitive on filename and camera id', () => {
    expect(matchesQuery(rec, 'GARAGE')).toBe(true);
    expect(matchesQuery(rec, 'MOB')).toBe(true);
  });
  it('rejects non-matches and tolerates missing fields', () => {
    expect(matchesQuery(rec, 'kitchen')).toBe(false);
    expect(matchesQuery({}, 'x')).toBe(false);
  });
  it('treats regex characters literally', () => expect(matchesQuery(rec, '.*')).toBe(false));
});

describe('probeMedia', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is unavailable without a URL and makes no request', async () => {
    const f = installFetch(() => head(200, 'video/webm'));
    expect(await probeMedia(null)).toBe(MEDIA_STATE.UNAVAILABLE);
    expect(f).not.toHaveBeenCalled();
  });
  it('is available for a successful video response', async () => {
    installFetch(() => head(200, 'video/webm'));
    expect(await probeMedia('/api/videos/a.webm')).toBe(MEDIA_STATE.AVAILABLE);
  });
  it.each([[404, 'video/webm'], [500, 'video/webm'], [200, 'text/html'], [200, 'application/json; charset=utf-8']])(
    'is unavailable for status %s / %s', async (status, type) => {
      installFetch(() => head(status, type));
      expect(await probeMedia('/api/videos/a.webm')).toBe(MEDIA_STATE.UNAVAILABLE);
    });
  it('falls back to a 1-byte range GET when HEAD is not allowed', async () => {
    const f = installFetch(({ method }) => (method === 'HEAD' ? head(405) : head(206, 'video/webm')));
    expect(await probeMedia('/api/videos/a.webm')).toBe(MEDIA_STATE.AVAILABLE);
    expect(f.calls[1].method).toBe('GET');
    expect(f.calls[1].headers.Range).toBe('bytes=0-0');
  });
  it('sends the bearer token', async () => {
    localStorage.setItem('mycam_token', 'abc');
    const f = installFetch(() => head(200, 'video/mp4'));
    await probeMedia('/api/videos/a.mp4');
    expect(f.calls[0].headers.Authorization).toBe('Bearer abc');
  });
  it('is unavailable on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await probeMedia('/x')).toBe(MEDIA_STATE.UNAVAILABLE);
  });
  it('re-throws an abort so callers can stop', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    await expect(probeMedia('/x')).rejects.toThrow('aborted');
  });
});

describe('probeRecordings', () => {
  it('reports each recording and never exceeds the concurrency limit', async () => {
    let inFlight = 0; let peak = 0;
    installFetch(async () => {
      inFlight += 1; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return head(200, 'video/webm');
    });
    const list = Array.from({ length: 10 }, (_, i) => ({ id: i, filename: `f${i}.webm` }));
    const seen = [];
    await probeRecordings(list, new AbortController().signal, (rec, state) => seen.push([rec.id, state]), 3);
    expect(seen).toHaveLength(10);
    expect(peak).toBeLessThanOrEqual(3);
    expect(seen.every(([, s]) => s === MEDIA_STATE.AVAILABLE)).toBe(true);
  });
  it('does nothing for an empty list', async () => {
    const f = installFetch(() => head(200, 'video/webm'));
    await probeRecordings([], new AbortController().signal, () => {});
    expect(f).not.toHaveBeenCalled();
  });
  it('stops reporting after abort', async () => {
    const controller = new AbortController();
    installFetch(async () => { controller.abort(); return head(200, 'video/webm'); });
    const seen = [];
    await probeRecordings([{ id: 1, filename: 'a' }, { id: 2, filename: 'b' }], controller.signal, (r) => seen.push(r.id), 1);
    expect(seen).toEqual([]);
  });
});

describe('downloadRecording', () => {
  const stubUrl = () => {
    const create = vi.fn(() => 'blob:fake'); const revoke = vi.fn();
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    return { create, revoke };
  };
  it('throws without a URL', async () => { await expect(downloadRecording(null, 'x')).rejects.toThrow(/no file name/); });
  it('downloads the body through an anchor with the file name', async () => {
    const { create } = stubUrl();
    installFetch(() => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'video/webm' } }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadRecording('/api/videos/a.webm', 'a.webm');
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull(); // anchor is removed again
  });
  it.each([
    ['a non-OK status', () => head(404, 'video/webm'), /responded with 404/],
    ['an HTML error page', () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }), /did not return a video/],
    ['an empty body', () => new Response(new Uint8Array([]), { status: 200, headers: { 'content-type': 'video/webm' } }), /empty/],
  ])('rejects on %s', async (_l, make, message) => {
    stubUrl();
    installFetch(make);
    await expect(downloadRecording('/api/videos/a.webm', 'a.webm')).rejects.toThrow(message);
  });
  it('maps a network failure to a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
    await expect(downloadRecording('/x', 'a')).rejects.toThrow('Could not reach the server.');
  });
});

describe('shareLink', () => {
  const setNav = (nav) => Object.keys(nav).forEach((k) => Object.defineProperty(navigator, k, { value: nav[k], configurable: true }));
  afterEach(() => setNav({ share: undefined, canShare: undefined, clipboard: undefined }));
  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue();
    setNav({ share, canShare: () => true });
    expect(await shareLink('https://x/s/1', 't')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 't', url: 'https://x/s/1' });
  });
  it('reports cancellation as cancelled (not an error)', async () => {
    setNav({ share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    expect(await shareLink('u', 't')).toBe('cancelled');
  });
  it('falls back to the clipboard when sharing fails', async () => {
    const writeText = vi.fn().mockResolvedValue();
    setNav({ share: vi.fn().mockRejectedValue(new Error('nope')), clipboard: { writeText } });
    expect(await shareLink('u', 't')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('u');
  });
  it('throws when neither sharing nor the clipboard exists', async () => {
    setNav({ share: undefined, clipboard: undefined });
    await expect(shareLink('u', 't')).rejects.toThrow(/not available/);
  });
});
