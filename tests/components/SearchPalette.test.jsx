import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchPalette from '../../src/components/Dashboard/SearchPalette';
import { installFetch, jsonResponse, signIn } from '../helpers/fetch';

/*
 * Response bodies below follow the REAL backend contract (server/routes.cjs):
 *  GET /api/cameras    -> { id, name, source_label, is_enabled, created_at }   (no online flag)
 *  GET /api/recordings -> SELECT * : { id, filename, camera_id, duration:"MM:SS", file_size, created_at }
 *  GET /api/schedules  -> SELECT * : { id, name, camera_id, days_json, start_time, end_time, is_active }
 *  GET /api/zones?user_id=<id> -> { id, user_id, camera_id, name, coordinates_json, created_at }; 400 if user_id missing
 *  GET /api/alerts     -> { id, cameraId, type, message, timestamp, isRead }
 */
const CAMERAS = [
  { id: 'cam-a', name: 'Front Door', source_label: 'Phone', is_enabled: 1, created_at: '2026-01-01T00:00:00Z' },
  { id: 'cam-b', name: 'Garage', source_label: 'Laptop', is_enabled: 0, created_at: '2026-01-02T00:00:00Z' },
];
const RECORDINGS = [{ id: 11, filename: 'garage_clip.webm', camera_id: 'cam-b', duration: '02:15', file_size: 2048, created_at: '2026-03-04T10:00:00Z' }];
const SCHEDULES = [
  { id: 1, name: 'Night watch', camera_id: 'cam-a', days_json: '["Mon","Tue"]', start_time: '22:00:00', end_time: '06:00:00', is_active: 0 },
  { id: 2, name: 'Office hours', camera_id: 'cam-a', days_json: '["Wed"]', start_time: '09:00:00', end_time: '17:00:00', is_active: 1 },
];
// MySQL 8 returns the JSON column parsed; MariaDB returns it as a string. The UI must accept both.
const ZONES = [
  { id: 5, user_id: 7, camera_id: 'cam-a', name: 'Driveway', coordinates_json: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }], created_at: '2026-03-01T00:00:00Z' },
  { id: 6, user_id: 7, camera_id: 'cam-b', name: 'Back gate', coordinates_json: '[{"x":0.2,"y":0.2},{"x":0.8,"y":0.2},{"x":0.8,"y":0.8},{"x":0.2,"y":0.8}]', created_at: '2026-03-02T00:00:00Z' },
  { id: 7, user_id: 7, camera_id: 'cam-a', name: 'Corrupt zone', coordinates_json: 'not json', created_at: '2026-03-03T00:00:00Z' },
];

function backend({ zones = () => jsonResponse(ZONES) } = {}) {
  return installFetch(({ url }) => {
    if (url.includes('/api/cameras')) return jsonResponse(CAMERAS);
    if (url.includes('/api/recordings')) return jsonResponse(RECORDINGS);
    if (url.includes('/api/alerts')) return jsonResponse([]);
    if (url.includes('/api/schedules')) return jsonResponse(SCHEDULES);
    if (url.includes('/api/zones')) return zones(url);
    return undefined;
  });
}

function Harness({ initial = '' }) {
  const [q, setQ] = useState(initial);
  return <SearchPalette searchQuery={q} onSearch={setQ} onNavigate={() => {}} userId={7} currentTheme="dark" onToggleTheme={() => {}} />;
}

async function openPalette() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Comprehensive Global Search'));
  return user;
}

describe('SearchPalette uses the real API field names', () => {
  it('shows the real time window, days and enabled state for schedules', async () => {
    signIn(); backend();
    render(<Harness />);
    await openPalette();
    const night = await screen.findByText('Night watch');
    const row = night.closest('button, li, div[role="option"], [role="option"]') || night.parentElement.parentElement;
    expect(row.textContent).toContain('22:00 - 06:00');
    expect(row.textContent).toContain('Mon, Tue');
    expect(row.textContent).toContain('Disabled');
    expect(row.textContent).not.toContain('00:00 - 23:59');
    const office = (await screen.findByText('Office hours')).closest('button, li, [role="option"]') || (await screen.findByText('Office hours')).parentElement.parentElement;
    expect(office.textContent).toContain('09:00 - 17:00');
    expect(office.textContent).toContain('Active');
  });

  it('does not claim a camera is Offline when the API provides no online state', async () => {
    signIn(); backend();
    render(<Harness />);
    await openPalette();
    const front = await screen.findByText('Front Door');
    const garage = await screen.findByText('Garage');
    const rowOf = (el) => el.closest('button, li, [role="option"]') || el.parentElement.parentElement;
    expect(rowOf(front).textContent).not.toContain('Offline');
    expect(rowOf(front).textContent).toContain('Enabled');
    expect(rowOf(garage).textContent).toContain('Disabled');
  });

  it('shows the real recording duration (no stray "s") and its camera', async () => {
    signIn(); backend();
    render(<Harness />);
    await openPalette();
    const rec = await screen.findByText('garage_clip.webm');
    const row = rec.closest('button, li, [role="option"]') || rec.parentElement.parentElement;
    expect(row.textContent).toContain('02:15');
    expect(row.textContent).not.toContain('02:15s');
    expect(row.textContent).toContain('Garage'); // camera name resolved from camera_id
  });

  it('finds a recording by its camera id', async () => {
    signIn(); backend();
    render(<Harness initial="cam-b" />);
    await openPalette();
    expect(await screen.findByText('garage_clip.webm')).toBeInTheDocument();
  });
});

describe('SearchPalette activity zones', () => {
  it('sends user_id with the zones request (the backend answers 400 without it)', async () => {
    signIn(); const f = backend();
    render(<Harness />);
    await openPalette();
    await screen.findByText('Night watch');
    const zoneCall = f.calls.find((c) => c.url.includes('/api/zones'));
    expect(zoneCall, 'zones were never requested').toBeTruthy();
    expect(zoneCall.url).toMatch(/[?&]user_id=7(&|$)/);
  });

  it('lists a zone with its name and camera and never prints "Default%"', async () => {
    signIn(); backend();
    render(<Harness />);
    await openPalette();
    const zone = await screen.findByText('Driveway');
    const row = zone.closest('button, li, [role="option"]') || zone.parentElement.parentElement;
    expect(row.textContent).toContain('Front Door');
    expect(row.textContent).not.toMatch(/Default%|undefined|NaN/);
  });

  it('keeps every other result when the zones request fails', async () => {
    signIn(); backend({ zones: () => jsonResponse({ message: 'User ID required' }, 400) });
    render(<Harness />);
    await openPalette();
    expect(await screen.findByText('Night watch')).toBeInTheDocument();
    expect(screen.getByText('Front Door')).toBeInTheDocument();
    expect(screen.queryByText('Driveway')).not.toBeInTheDocument();
  });

  it('survives a zones network error', async () => {
    signIn();
    installFetch(({ url }) => {
      if (url.includes('/api/zones')) throw new TypeError('offline');
      if (url.includes('/api/cameras')) return jsonResponse(CAMERAS);
      return jsonResponse([]);
    });
    render(<Harness />);
    await openPalette();
    expect(await screen.findByText('Front Door')).toBeInTheDocument();
  });

  it('does not request zones without a signed-in user id', async () => {
    const f = backend();
    render(<SearchPalette searchQuery="" onSearch={() => {}} onNavigate={() => {}} currentTheme="dark" onToggleTheme={() => {}} />);
    await userEvent.setup().click(screen.getByLabelText('Comprehensive Global Search'));
    await waitFor(() => expect(f.calls.some((c) => c.url.includes('/api/cameras'))).toBe(true));
    expect(f.calls.some((c) => c.url.includes('/api/zones'))).toBe(false);
  });
});

describe('SearchPalette zone details', () => {
  it('reports the real number of corners for array and string coordinates, and no number when unreadable', async () => {
    signIn(); backend();
    render(<Harness />);
    await openPalette();
    const rowOf = async (name) => { const el = await screen.findByText(name); return el.closest('button, li, [role="option"]') || el.parentElement.parentElement; };
    expect((await rowOf('Driveway')).textContent).toContain('3 points');
    expect((await rowOf('Back gate')).textContent).toContain('4 points');
    expect((await rowOf('Corrupt zone')).textContent).not.toMatch(/points/);
  });
});
