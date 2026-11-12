import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoPlayerModal from '../../src/components/Dashboard/VideoPlayerModal';
import { MEDIA_STATE } from '../../src/lib/recordingMedia';
import { installFetch, jsonResponse, signIn } from '../helpers/fetch';

/*
 * Regression: the backend only accepts "Authorization: Bearer ..." (server/auth.cjs requireAuth). A <video src="/api/videos/x">
 * cannot send that header, so playback answered 401 against the real backend. The player must fetch with the token and play a blob: URL.
 */
const REC = { id: 1, filename: 'rec-123-abc.webm', camera_id: 'mobile', duration: '00:07', file_size_bytes: 2048, created_at: '2026-03-01T08:00:00Z' };
const URL_ = '/api/videos/rec-123-abc.webm';
let created; let revoked;
beforeEach(() => {
  created = []; revoked = [];
  URL.createObjectURL = vi.fn((blob) => { const u = `blob:test/${created.length}`; created.push([u, blob]); return u; });
  URL.revokeObjectURL = vi.fn((u) => revoked.push(u));
  signIn();
});
const bytes = () => new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'video/webm' } });
const authed = (handler) => installFetch((c) => (c.headers.Authorization === 'Bearer tok.en.value' ? handler(c) : jsonResponse({ message: 'Your session is missing or expired.' }, 401)));
const ui = (props = {}) => render(<VideoPlayerModal recording={REC} url={URL_} mediaState={MEDIA_STATE.AVAILABLE} onClose={() => {}} onDownload={() => {}} onShare={() => {}} onVerify={() => {}} {...props} />);
const video = () => document.querySelector('video');

describe('VideoPlayerModal - authenticated playback', () => {
  it('requests the file WITH the bearer token and plays a blob: URL, never the raw API URL', async () => {
    const f = authed(() => bytes());
    ui();
    await waitFor(() => expect(video()).toBeTruthy());
    expect(video().getAttribute('src')).toMatch(/^blob:/);
    expect(video().getAttribute('src')).not.toContain('/api/videos');
    expect(f.calls[0].url).toBe(URL_);
    expect(f.calls[0].headers.Authorization).toBe('Bearer tok.en.value');
  });
  it('shows a loading notice until the file arrives', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    authed(async () => { await gate; return bytes(); });
    ui();
    expect(await screen.findByText('Loading recording')).toBeInTheDocument();
    expect(video()).toBeNull();
    release();
    await waitFor(() => expect(video()).toBeTruthy());
  });
  it.each([
    ['an auth failure', () => jsonResponse({ message: 'Your session is missing or expired.' }, 401), /session|401/i],
    ['a server error', () => jsonResponse({ message: 'Recording file not found' }, 404), /not found|404/i],
  ])('shows "Playback failed" with a retry for %s, and retry fetches again', async (_l, make, pattern) => {
    let fail = true;
    const f = authed(() => (fail ? make() : bytes()));
    const user = userEvent.setup(); ui();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Playback failed');
    expect(alert).toHaveTextContent(pattern);
    fail = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(video()).toBeTruthy());
    expect(f.calls.length).toBe(2);
  });
  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
    ui();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });
  it('releases the blob URL shortly after closing (no memory leak) - but not before the <video> element has detached', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      authed(() => bytes());
      const { unmount } = ui();
      await waitFor(() => expect(video()).toBeTruthy());
      unmount();
      expect(revoked).toEqual([]); // revoking immediately makes Chromium log ERR_FILE_NOT_FOUND for the still-loading element
      await vi.advanceTimersByTimeAsync(2500);
      expect(revoked).toEqual([created[0][0]]);
    } finally { vi.useRealTimers(); }
  });
  it('aborts the download when closed early', async () => {
    let signal;
    authed(({ signal: s }) => { signal = s; return new Promise(() => {}); });
    const { unmount } = ui();
    await waitFor(() => expect(signal).toBeTruthy());
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it.each([[MEDIA_STATE.CHECKING], [MEDIA_STATE.UNAVAILABLE]])('makes no request while the file state is %s', async (state) => {
    const f = authed(() => bytes());
    ui({ mediaState: state });
    await new Promise((r) => setTimeout(r, 30));
    expect(f).not.toHaveBeenCalled();
    expect(video()).toBeNull();
  });
});
