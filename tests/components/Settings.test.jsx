import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../src/context/ToastContext';
import { NotificationProvider } from '../../src/context/NotificationContext';
import Settings from '../../src/components/Dashboard/Settings';
import { installFetch, jsonResponse, parseBody, signIn } from '../helpers/fetch';

// Storage and profile sections have their own tests; here only the alerts section is under test.
vi.mock('../../src/components/Dashboard/StorageSettings', () => ({ default: () => <div data-testid="storage-stub" /> }));
vi.mock('../../src/components/Dashboard/ProfileSettings', () => ({ default: () => <div data-testid="profile-stub" /> }));

const PREFS = { motionAlerts: true, dashboardToasts: true, browserNotifications: false };
const CREATED = { id: '9', type: 'activity', message: 'Security test alert: myCam alert notification system is operational!', cameraId: 'system', timestamp: '2026-11-05T10:00:00.000Z' };

function backend({ post = () => jsonResponse(CREATED, 201), put } = {}) {
  return installFetch(({ url, method }) => {
    if (url.includes('/api/alert-preferences')) return method === 'PUT' ? put(url) : jsonResponse(PREFS);
    if (url.includes('/api/alerts') && method === 'POST') return post();
    if (url.includes('/api/alerts')) return jsonResponse([]);
    return undefined;
  });
}
const mount = () => {
  signIn();
  return render(<ToastProvider><NotificationProvider><Settings user={{ id: 7 }} onUserUpdate={() => {}} /></NotificationProvider></ToastProvider>);
};
const sendTest = async (user) => {
  await waitFor(() => expect(screen.getByLabelText('Motion alerts')).not.toBeDisabled());
  await user.click(screen.getByRole('button', { name: /send test notification/i }));
};

describe('Settings - Send Test Notification (regression: failures were silent)', () => {
  it('posts the existing alert contract and confirms success to the user', async () => {
    const f = backend(); const user = userEvent.setup(); mount();
    await sendTest(user);
    const toast = await screen.findByText(/test notification sent/i);
    expect(toast.closest('[role="status"]')).toBeTruthy();
    const post = f.calls.find((c) => c.method === 'POST' && c.url.includes('/api/alerts'));
    expect(parseBody(post)).toEqual({ type: 'activity', message: CREATED.message, cameraId: 'system' });
  });

  it.each([
    ['a server error', () => jsonResponse({ message: 'Could not store alert' }, 500)],
    ['an auth failure', () => jsonResponse({ message: 'Unauthorized' }, 401)],
    ['a network failure', () => { throw new TypeError('Failed to fetch'); }],
  ])('tells the user when the request fails with %s', async (_l, post) => {
    backend({ post }); const user = userEvent.setup(); mount();
    await sendTest(user);
    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert).toHaveTextContent(/could not send the test notification/i);
    expect(screen.queryByText(/test notification sent/i)).not.toBeInTheDocument();
  });

  it('disables the button while the request is in flight (no duplicate sends)', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const f = backend({ post: async () => { await gate; return jsonResponse(CREATED, 201); } });
    const user = userEvent.setup(); mount();
    await sendTest(user);
    const btn = screen.getByRole('button', { name: /sending|send test notification/i });
    expect(btn).toBeDisabled();
    await user.click(btn);
    release();
    await screen.findByText(/test notification sent/i);
    expect(f.calls.filter((c) => c.method === 'POST' && c.url.includes('/api/alerts'))).toHaveLength(1);
    expect(screen.getByRole('button', { name: /send test notification/i })).not.toBeDisabled();
  });
});

describe('Settings - alert preferences', () => {
  it('loads saved preferences into the switches', async () => {
    backend(); mount();
    await waitFor(() => expect(screen.getByLabelText('Motion alerts')).not.toBeDisabled());
    expect(screen.getByLabelText('Motion alerts')).toBeChecked();
    expect(screen.getByLabelText('Dashboard toast messages')).toBeChecked();
    expect(screen.getByLabelText('Browser notifications')).not.toBeChecked();
  });

  it('saves a changed preference with the existing PUT contract', async () => {
    const f = backend({ put: () => jsonResponse({ ...PREFS, motionAlerts: false }) });
    const user = userEvent.setup(); mount();
    await waitFor(() => expect(screen.getByLabelText('Motion alerts')).not.toBeDisabled());
    await user.click(screen.getByLabelText('Motion alerts'));
    await waitFor(() => expect(screen.getByLabelText('Motion alerts')).not.toBeChecked());
    const put = f.calls.find((c) => c.method === 'PUT');
    expect(put.url).toBe('/api/alert-preferences');
    expect(parseBody(put)).toEqual({ ...PREFS, motionAlerts: false });
  });

  it('reverts the switch and shows an error when saving fails', async () => {
    backend({ put: () => jsonResponse({ message: 'nope' }, 500) });
    const user = userEvent.setup(); mount();
    await waitFor(() => expect(screen.getByLabelText('Motion alerts')).not.toBeDisabled());
    await user.click(screen.getByLabelText('Motion alerts'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.getByLabelText('Motion alerts')).toBeChecked();
  });

  it('does not enable browser notifications when permission is denied', async () => {
    const f = backend({ put: () => jsonResponse(PREFS) });
    class FakeNotification { static permission = 'default'; static requestPermission = vi.fn().mockResolvedValue('denied'); }
    vi.stubGlobal('Notification', FakeNotification);
    window.Notification = FakeNotification;
    const user = userEvent.setup(); mount();
    await waitFor(() => expect(screen.getByLabelText('Browser notifications')).not.toBeDisabled());
    await user.click(screen.getByLabelText('Browser notifications'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not permitted/i);
    expect(f.calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(screen.getByLabelText('Browser notifications')).not.toBeChecked();
  });
});
