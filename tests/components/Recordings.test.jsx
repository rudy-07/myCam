import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../src/context/ToastContext';
import Recordings from '../../src/components/Dashboard/Recordings';
import { installFetch, jsonResponse, signIn } from '../helpers/fetch';

// Real contract: GET /api/recordings -> [{ id, filename, camera_id, duration, file_size_bytes, storage_target, trigger_type, created_at }]
const REC = [
  { id: 1, filename: 'garage_morning.webm', camera_id: 'mobile', duration: '02:15', file_size_bytes: 2097152, storage_target: 'local', trigger_type: 'manual', created_at: '2026-03-01T08:00:00Z' },
  { id: 2, filename: 'driveway_motion.webm', camera_id: 'cam-2', duration: '00:30', file_size_bytes: 1048576, storage_target: 'local', trigger_type: 'motion', created_at: '2026-03-03T08:00:00Z' },
  { id: 3, filename: 'missing_file.webm', camera_id: 'mobile', duration: '01:00', file_size_bytes: 512, storage_target: 'local', trigger_type: 'scheduled', created_at: '2026-03-02T08:00:00Z' },
];

function backend({ list = () => jsonResponse(REC), del } = {}) {
  return installFetch(({ url, method }) => {
    if (url.startsWith('/api/videos/')) return url.includes('missing_file') ? new Response(null, { status: 404 }) : new Response(null, { status: 200, headers: { 'content-type': 'video/webm' } });
    if (url.startsWith('/api/recordings/') && method === 'DELETE') return del ? del(url) : jsonResponse({ message: 'Recording deleted' });
    if (url.startsWith('/api/recordings')) return list();
    return undefined;
  });
}
function Harness({ initialQuery = '', onClear = () => {} }) {
  const [q, setQ] = useState(initialQuery);
  return <Recordings user={{ id: 7 }} searchQuery={q} onClearSearch={() => { setQ(''); onClear(); }} />;
}
const mount = (props) => { signIn(); return render(<ToastProvider><Harness {...props} /></ToastProvider>); };
const titles = () => within(screen.getByRole('list', { name: 'Recordings' })).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const waitProbed = () => screen.findByText(/2 with a video file, 1 without/);

describe('Recordings library - loading and states', () => {
  it('shows entries newest first with real metadata, after verifying the video files', async () => {
    const f = backend(); mount();
    await waitProbed();
    expect(titles()).toEqual(['driveway_motion.webm', 'missing_file.webm', 'garage_morning.webm']);
    expect(screen.getByText(/3 entries returned by the server/)).toBeInTheDocument();
    expect(f.calls[0].url).toBe('/api/recordings?user_id=7');
    expect(screen.getByText('02:15')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });
  it('shows the empty state when there are no recordings', async () => {
    backend({ list: () => jsonResponse([]) }); mount();
    expect(await screen.findByText('No recordings yet')).toBeInTheDocument();
  });
  it('shows an error with a working retry', async () => {
    let fail = true;
    backend({ list: () => (fail ? jsonResponse({ message: 'db down' }, 500) : jsonResponse(REC)) });
    const user = userEvent.setup(); mount();
    expect(await screen.findByText('Recordings could not be loaded')).toBeInTheDocument();
    expect(screen.getByText(/The server responded with 500/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitProbed();
  });
  it('rejects a non-list response instead of crashing', async () => {
    backend({ list: () => jsonResponse({ rows: [] }) }); mount();
    expect(await screen.findByText(/not a recording list/)).toBeInTheDocument();
  });
  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x'))); mount();
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
  });
  it('flags entries whose video file the server cannot supply and disables download for them', async () => {
    backend(); mount();
    await waitProbed();
    expect(screen.getByText(/cannot supply a video file for 1 of 3 entries/i)).toBeInTheDocument();
    const dl = screen.getAllByRole('button', { name: /download missing_file\.webm/i });
    expect(dl[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: /download garage_morning\.webm/i })).not.toBeDisabled();
  });
});

describe('Recordings library - search, filters and sorting', () => {
  it('filters by file name from the search box', async () => {
    backend(); mount({ initialQuery: 'garage' });
    await screen.findByText(/Showing 1 of 3 entries/);
    expect(titles()).toEqual(['garage_morning.webm']);
  });
  it('filters by camera id (case-insensitive)', async () => {
    backend(); mount({ initialQuery: 'CAM-2' });
    await screen.findByText(/Showing 1 of 3 entries/);
    expect(titles()).toEqual(['driveway_motion.webm']);
  });
  it('explains a search with no matches and clears it', async () => {
    backend(); const onClear = vi.fn(); const user = userEvent.setup(); mount({ initialQuery: 'zzz', onClear });
    expect(await screen.findByText('No recordings match your search')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));
    expect(onClear).toHaveBeenCalled();
    await waitFor(() => expect(titles()).toHaveLength(3));
  });
  it('treats regex characters in the search literally', async () => {
    backend(); mount({ initialQuery: '.*' });
    expect(await screen.findByText('No recordings match your search')).toBeInTheDocument();
  });
  it('filters by video availability', async () => {
    backend(); const user = userEvent.setup(); mount();
    await waitProbed();
    const group = screen.getByRole('group', { name: 'Filter by video availability' });
    await user.click(within(group).getByRole('button', { name: /video unavailable/i }));
    expect(titles()).toEqual(['missing_file.webm']);
    await user.click(within(group).getByRole('button', { name: /video found/i }));
    expect(titles()).toEqual(['driveway_motion.webm', 'garage_morning.webm']);
    expect(within(group).getByRole('button', { name: /video found/i })).toHaveAttribute('aria-pressed', 'true');
  });
  it('filters by recording source', async () => {
    backend(); const user = userEvent.setup(); mount();
    await waitProbed();
    await user.selectOptions(screen.getByLabelText('Recording source'), 'motion');
    expect(titles()).toEqual(['driveway_motion.webm']);
    await user.selectOptions(screen.getByLabelText('Recording source'), 'scheduled');
    expect(titles()).toEqual(['missing_file.webm']);
  });
  it('sorts oldest first', async () => {
    backend(); const user = userEvent.setup(); mount();
    await waitProbed();
    await user.selectOptions(screen.getByLabelText('Sort by date'), 'oldest');
    expect(titles()).toEqual(['garage_morning.webm', 'missing_file.webm', 'driveway_motion.webm']);
  });
  it('combines search and a filter, and shows a filter-specific empty state', async () => {
    backend(); const user = userEvent.setup(); mount({ initialQuery: 'garage' });
    await screen.findByText(/Showing 1 of 3 entries/);
    await user.selectOptions(screen.getByLabelText('Recording source'), 'motion');
    expect(await screen.findByText('No recordings match your search')).toBeInTheDocument();
    expect(screen.getByText(/with the selected filter/)).toBeInTheDocument();
  });
});

describe('Recordings library - delete', () => {
  it('does nothing when the confirmation is declined', async () => {
    const f = backend(); vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup(); mount();
    await waitProbed();
    await user.click(screen.getByRole('button', { name: 'Delete garage_morning.webm' }));
    expect(f.calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
  it('deletes with the existing endpoint, confirms and reloads', async () => {
    let deleted = false;
    const f = backend({ list: () => jsonResponse(deleted ? REC.filter((r) => r.id !== 1) : REC), del: () => { deleted = true; return jsonResponse({ message: 'Recording deleted' }); } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup(); mount();
    await waitProbed();
    await user.click(screen.getByRole('button', { name: 'Delete garage_morning.webm' }));
    expect(confirm.mock.calls[0][0]).toMatch(/permanently removes/);
    expect(await screen.findByText('garage_morning.webm was deleted.')).toBeInTheDocument();
    expect(f.calls.find((c) => c.method === 'DELETE').url).toBe('/api/recordings/1');
    await waitFor(() => expect(titles()).not.toContain('garage_morning.webm'));
  });
  it('keeps the entry and shows the server message when deletion fails', async () => {
    backend({ del: () => jsonResponse({ message: 'Recording not found' }, 404) });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup(); mount();
    await waitProbed();
    await user.click(screen.getByRole('button', { name: 'Delete garage_morning.webm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete garage_morning.webm: Recording not found');
    expect(titles()).toContain('garage_morning.webm');
  });
});

describe('Recordings library - player', () => {
  it('opens the player dialog for an available recording and closes with Escape', async () => {
    backend(); const user = userEvent.setup(); mount();
    await waitProbed();
    await user.click(screen.getByRole('button', { name: /open garage_morning\.webm, video file found/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('garage_morning.webm');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
