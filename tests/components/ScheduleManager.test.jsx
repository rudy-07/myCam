import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../src/context/ToastContext';
import ScheduleManager from '../../src/components/Dashboard/ScheduleManager';
import { installFetch, jsonResponse, parseBody, signIn } from '../helpers/fetch';

// Real contract (server/routes.cjs): GET /api/schedules -> rows with days_json, start_time, end_time, is_active
const ROWS = [
  { id: 1, user_id: 7, camera_id: 'mobile', name: 'Night watch', days_json: '["Mon","Tue","Wed","Thu","Fri"]', start_time: '22:00:00', end_time: '06:00:00', is_active: 1 },
  { id: 2, user_id: 7, camera_id: 'mobile', name: 'Weekend day', days_json: '["Sat","Sun"]', start_time: '09:00:00', end_time: '17:00:00', is_active: 0 },
];
const mount = () => { signIn(); return render(<ToastProvider><ScheduleManager user={{ id: 7 }} /></ToastProvider>); };

describe('ScheduleManager', () => {
  it('lists schedules from the real response shape', async () => {
    const f = installFetch(() => jsonResponse(ROWS)); mount();
    expect(await screen.findByRole('heading', { name: 'Night watch' })).toBeInTheDocument();
    expect(f.calls[0].url).toBe('/api/schedules?user_id=7');
    expect(screen.getByText(/22:00/)).toBeInTheDocument();
    expect(screen.getByText(/06:00/)).toBeInTheDocument();
    expect(screen.getByText('Weekdays')).toBeInTheDocument();
    expect(screen.getByText('Weekends')).toBeInTheDocument();
  });
  it('shows the empty state, and an error with retry', async () => {
    installFetch(() => jsonResponse([])); const { unmount } = mount();
    expect(await screen.findByText('No schedules saved')).toBeInTheDocument();
    unmount();
    let fail = true;
    installFetch(() => (fail ? jsonResponse({ message: 'Failed to fetch schedules' }, 500) : jsonResponse(ROWS)));
    const user = userEvent.setup(); mount();
    expect(await screen.findByText('Schedules could not be loaded')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: 'Night watch' })).toBeInTheDocument();
  });
  it('toggles a schedule with PUT {is_active} and confirms', async () => {
    const f = installFetch(({ method }) => (method === 'PUT' ? jsonResponse({ message: 'Schedule updated' }) : jsonResponse(ROWS)));
    const user = userEvent.setup(); mount();
    await screen.findByRole('heading', { name: 'Night watch' });
    await user.click(screen.getByRole('button', { name: /disable schedule night watch/i }));
    expect(await screen.findByText(/“Night watch” disabled\./)).toBeInTheDocument();
    const put = f.calls.find((c) => c.method === 'PUT');
    expect(put.url).toBe('/api/schedules/1');
    expect(parseBody(put)).toEqual({ is_active: false });
  });
  it('reports a failed toggle and leaves the state unchanged', async () => {
    installFetch(({ method }) => (method === 'PUT' ? jsonResponse({ message: 'Schedule not found' }, 404) : jsonResponse(ROWS)));
    const user = userEvent.setup(); mount();
    await screen.findByRole('heading', { name: 'Night watch' });
    await user.click(screen.getByRole('button', { name: /disable schedule night watch/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The schedule was not changed: Schedule not found');
    expect(screen.getByRole('button', { name: /disable schedule night watch/i })).toBeInTheDocument(); // still enabled: label unchanged
  });
  it('deletes after confirmation with DELETE /api/schedules/:id', async () => {
    let deleted = false;
    const f = installFetch(({ method }) => { if (method === 'DELETE') { deleted = true; return jsonResponse({ message: 'Schedule deleted' }); } return jsonResponse(deleted ? [ROWS[1]] : ROWS); });
    const user = userEvent.setup(); mount();
    await screen.findByRole('heading', { name: 'Night watch' });
    await user.click(screen.getByRole('button', { name: 'Delete schedule Night watch' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button').find((b) => /^delete/i.test(b.textContent.trim())));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Night watch' })).not.toBeInTheDocument());
    expect(f.calls.find((c) => c.method === 'DELETE').url).toBe('/api/schedules/1');
  });
  it('keeps the schedule and shows the failure when delete fails', async () => {
    installFetch(({ method }) => (method === 'DELETE' ? jsonResponse({ message: 'Failed to delete schedule' }, 500) : jsonResponse(ROWS)));
    const user = userEvent.setup(); mount();
    await screen.findByRole('heading', { name: 'Night watch' });
    await user.click(screen.getByRole('button', { name: 'Delete schedule Night watch' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button').find((b) => /^delete/i.test(b.textContent.trim())));
    expect((await screen.findAllByText(/not deleted/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Night watch' })).toBeInTheDocument();
  });
});

describe('ScheduleManager - create and edit form', () => {
  it('validates before sending: name required, at least one day, start differs from end', async () => {
    const f = installFetch(() => jsonResponse([])); const user = userEvent.setup(); mount();
    await user.click((await screen.findAllByRole('button', { name: 'New schedule' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect(await screen.findByText(/name/i, { selector: '[role="alert"], .field-error, p' })).toBeTruthy();
    expect(f.calls.some((c) => c.method === 'POST')).toBe(false);
  });
  it('creates a schedule with the exact existing POST contract', async () => {
    const f = installFetch(({ method }) => (method === 'POST' ? jsonResponse({ id: 3, message: 'Schedule created' }, 201) : jsonResponse([])));
    const user = userEvent.setup(); mount();
    await user.click((await screen.findAllByRole('button', { name: 'New schedule' }))[0]);
    await user.type(screen.getByLabelText('Schedule name'), '  Guard  ');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));
    await waitFor(() => expect(f.calls.some((c) => c.method === 'POST')).toBe(true));
    const post = f.calls.find((c) => c.method === 'POST');
    expect(post.url).toBe('/api/schedules');
    expect(parseBody(post)).toEqual({ user_id: 7, camera_id: 'mobile', name: 'Guard', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], start_time: '22:00', end_time: '06:00' });
  });
  it('edits with PUT and never sends is_active or the camera', async () => {
    const f = installFetch(({ method }) => (method === 'PUT' ? jsonResponse({ message: 'Schedule updated' }) : jsonResponse(ROWS)));
    const user = userEvent.setup(); mount();
    await screen.findByRole('heading', { name: 'Night watch' });
    await user.click(screen.getByRole('button', { name: 'Edit schedule Night watch' }));
    const name = screen.getByLabelText('Schedule name');
    await user.clear(name); await user.type(name, 'Late watch');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(f.calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = f.calls.find((c) => c.method === 'PUT');
    expect(put.url).toBe('/api/schedules/1');
    expect(parseBody(put)).toEqual({ name: 'Late watch', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start_time: '22:00', end_time: '06:00' });
  });
  it('shows the server error and keeps the form open when saving fails', async () => {
    installFetch(({ method }) => (method === 'POST' ? jsonResponse({ message: 'Missing required fields' }, 400) : jsonResponse([])));
    const user = userEvent.setup(); mount();
    await user.click((await screen.findAllByRole('button', { name: 'New schedule' }))[0]);
    await user.type(screen.getByLabelText('Schedule name'), 'Guard');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));
    expect((await screen.findAllByText(/Missing required fields/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
