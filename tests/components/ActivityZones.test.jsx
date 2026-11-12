import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../src/context/ToastContext';
import ActivityZones from '../../src/components/Dashboard/ActivityZones';
import { installFetch, jsonResponse, parseBody, signIn } from '../helpers/fetch';

/*
 * ZoneStage (live WebRTC video + canvas) is replaced by a stub. This isolates the form, validation and API logic.
 * It does NOT test drawing on a real camera feed. Pointer->coordinate maths is unit-tested in tests/unit/zones.test.js;
 * the live drawing itself requires manual verification with a real camera.
 */
vi.mock('../../src/components/Dashboard/ZoneStage', async () => {
  const React = await import('react');
  const CORNERS = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.2, y: 0.8 }];
  return {
    default: function ZoneStageStub({ drawing, points, onAddPoint, onStatusChange }) {
      React.useEffect(() => { onStatusChange(globalThis.__zoneStatus || 'live'); }, [onStatusChange]);
      return (
        <div data-testid="zone-stage">
          {drawing && <button type="button" onClick={() => onAddPoint(CORNERS[points.length % CORNERS.length])}>stub: place corner</button>}
        </div>
      );
    },
  };
});

const ZONES = [
  { id: 5, user_id: 7, camera_id: 'mobile', name: 'Driveway', coordinates_json: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }], created_at: '2026-03-01T10:00:00Z' },
  { id: 6, user_id: 7, camera_id: 'mobile', name: 'Broken', coordinates_json: 'not json', created_at: '2026-03-02T10:00:00Z' },
];

const mount = (props = {}) => { signIn(); return render(<ToastProvider><ActivityZones user={{ id: 7 }} onNavigate={() => {}} {...props} /></ToastProvider>); };
const newZone = async (user) => { await waitFor(() => expect(screen.getByRole('button', { name: /new zone/i })).not.toBeDisabled()); await user.click(screen.getByRole('button', { name: /new zone/i })); };
const place = async (user, n) => { for (let i = 0; i < n; i += 1) await user.click(screen.getByRole('button', { name: /stub: place corner/i })); };

beforeEach(() => { globalThis.__zoneStatus = 'live'; });

describe('ActivityZones - empty state copy (regression: contradicted the real behaviour)', () => {
  it('says motion anywhere raises alerts until a zone limits them', async () => {
    installFetch(() => jsonResponse([]));
    mount();
    const note = await screen.findByText(/no zones saved yet/i);
    const text = note.parentElement.textContent;
    expect(text).not.toMatch(/raises no motion alerts/i);
    expect(text).toMatch(/anywhere in the camera (view|picture)/i);
    expect(text).toMatch(/limit/i);
  });
});

describe('ActivityZones - loading and listing', () => {
  it('requests zones with the signed-in user id and lists them', async () => {
    const f = installFetch(() => jsonResponse(ZONES));
    mount();
    expect(await screen.findByText('Driveway')).toBeInTheDocument();
    expect(f.calls[0].url).toBe('/api/zones?user_id=7');
    expect(screen.getByText(/3 corners/)).toBeInTheDocument();
    expect(screen.getByText(/shape unreadable/i)).toBeInTheDocument();
  });

  it('shows an error with a working retry when loading fails', async () => {
    let fail = true;
    installFetch(() => (fail ? jsonResponse({ message: 'Failed to fetch zones' }, 500) : jsonResponse(ZONES)));
    const user = userEvent.setup(); mount();
    expect(await screen.findByText(/zones could not be loaded/i)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Driveway')).toBeInTheDocument();
  });

  it('does not request zones without a signed-in user', async () => {
    const f = installFetch(() => jsonResponse([]));
    render(<ToastProvider><ActivityZones user={null} /></ToastProvider>);
    await new Promise((r) => setTimeout(r, 30));
    expect(f).not.toHaveBeenCalled();
  });
});

describe('ActivityZones - camera must be live to draw', () => {
  it('disables New zone and explains why when the camera is not live', async () => {
    globalThis.__zoneStatus = 'offline';
    installFetch(() => jsonResponse([]));
    mount();
    await screen.findByText(/no zones saved yet/i);
    expect(screen.getByRole('button', { name: /new zone/i })).toBeDisabled();
    expect(screen.getByRole('status', { name: '' , hidden: false })).toBeTruthy();
    expect(screen.getByText(/camera is not live/i)).toBeInTheDocument();
  });
});

describe('ActivityZones - creating a zone', () => {
  it('validates the name and corner count before sending anything', async () => {
    const f = installFetch(() => jsonResponse([]));
    const user = userEvent.setup(); mount();
    await newZone(user);
    await user.click(screen.getByRole('button', { name: /save zone/i }));
    expect(await screen.findByText(/name/i, { selector: '.field-error, [role="alert"], p' })).toBeTruthy();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(f.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('posts the exact existing contract, confirms, and reloads the list', async () => {
    let created = false;
    const f = installFetch(({ method }) => {
      if (method === 'POST') { created = true; return jsonResponse({ id: 9, message: 'Zone created' }, 201); }
      return jsonResponse(created ? [{ ...ZONES[0], id: 9, name: 'Front door' }] : []);
    });
    const user = userEvent.setup(); mount();
    await newZone(user);
    await user.type(screen.getByPlaceholderText(/front door/i), '  Front door  ');
    await place(user, 3);
    await user.click(screen.getByRole('button', { name: /save zone/i }));
    expect(await screen.findByText('Zone saved.')).toBeInTheDocument();
    const post = f.calls.find((c) => c.method === 'POST');
    expect(post.url).toBe('/api/zones');
    expect(parseBody(post)).toEqual({ user_id: 7, camera_id: 'mobile', name: 'Front door', coordinates: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }] });
    expect(await screen.findByText('Front door')).toBeInTheDocument();
  });

  it('keeps the drawing and shows the error when saving fails', async () => {
    installFetch(({ method }) => (method === 'POST' ? jsonResponse({ message: 'Failed to create zone' }, 500) : jsonResponse([])));
    const user = userEvent.setup(); mount();
    await newZone(user);
    await user.type(screen.getByPlaceholderText(/front door/i), 'Gate');
    await place(user, 3);
    await user.click(screen.getByRole('button', { name: /save zone/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => /your drawing is still here/i.test(a.textContent))).toBe(true);
    expect(screen.getByText(/corners placed/i).textContent).toContain('3');
  });

  it('sends only one request when save is clicked twice quickly', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const f = installFetch(async ({ method }) => { if (method === 'POST') { await gate; return jsonResponse({ id: 1 }, 201); } return jsonResponse([]); });
    const user = userEvent.setup(); mount();
    await newZone(user);
    await user.type(screen.getByPlaceholderText(/front door/i), 'Gate');
    await place(user, 3);
    const save = screen.getByRole('button', { name: /save zone/i });
    await user.click(save); await user.click(save);
    release();
    await screen.findByText('Zone saved.');
    expect(f.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('undo removes the last corner and cancel discards the draft', async () => {
    installFetch(() => jsonResponse([]));
    const user = userEvent.setup(); mount();
    await newZone(user);
    await place(user, 3);
    await user.click(screen.getByRole('button', { name: /undo corner/i }));
    expect(screen.getByText(/corners placed/i).textContent).toContain('2');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/corners placed/i)).not.toBeInTheDocument();
  });
});

describe('ActivityZones - deleting a zone', () => {
  it('asks for confirmation, calls DELETE /api/zones/:id and removes the zone', async () => {
    let deleted = false;
    const f = installFetch(({ method }) => {
      if (method === 'DELETE') { deleted = true; return jsonResponse({ message: 'Zone deleted' }); }
      return jsonResponse(deleted ? [ZONES[1]] : ZONES);
    });
    const user = userEvent.setup(); mount();
    await screen.findByText('Driveway');
    await user.click(screen.getByRole('button', { name: 'Delete zone Driveway' }));
    expect(screen.getByText(/delete zone “driveway”\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete zone' }));
    await waitFor(() => expect(screen.queryByText('Driveway')).not.toBeInTheDocument());
    expect(f.calls.find((c) => c.method === 'DELETE').url).toBe('/api/zones/5');
  });

  it('keeps the zone and reports the failure when deletion fails', async () => {
    installFetch(({ method }) => (method === 'DELETE' ? jsonResponse({ message: 'Failed to delete zone' }, 500) : jsonResponse(ZONES)));
    const user = userEvent.setup(); mount();
    await screen.findByText('Driveway');
    await user.click(screen.getByRole('button', { name: 'Delete zone Driveway' }));
    await user.click(screen.getByRole('button', { name: 'Delete zone' }));
    expect((await screen.findAllByText(/was not deleted/i)).length).toBeGreaterThan(0);
    expect(screen.getByText('Driveway')).toBeInTheDocument();
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const f = installFetch(() => jsonResponse(ZONES));
    const user = userEvent.setup(); mount();
    await screen.findByText('Driveway');
    await user.click(screen.getByRole('button', { name: 'Delete zone Driveway' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /cancel/i }).pop()); // footer button
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(f.calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Driveway')).toBeInTheDocument();
  });
});
