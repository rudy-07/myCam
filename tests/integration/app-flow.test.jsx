import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFetch, jsonResponse } from '../helpers/fetch';
import { createFakeSocket } from '../helpers/fakeSocket';

// Only the Socket.IO transport is replaced. All application code runs for real.
vi.mock('socket.io-client', () => ({ default: vi.fn(() => globalThis.__fakeSocket), io: vi.fn(() => globalThis.__fakeSocket) }));

import App from '../../src/App';

const USER = { id: 7, username: 'rudy', name: 'Rudy Cam', email: 'rudy@example.com' };
const desktop = () => { window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: /min-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })); };

function backend(over = {}) {
  return installFetch(({ url, method }) => {
    if (over[`${method} ${url.split('?')[0]}`]) return over[`${method} ${url.split('?')[0]}`](url);
    if (url.startsWith('/api/login') && method === 'POST') return jsonResponse({ token: 'jwt.abc', user: USER });
    if (url.startsWith('/api/alert-preferences')) return jsonResponse({ motionAlerts: true, dashboardToasts: true, browserNotifications: false });
    if (url.startsWith('/api/storage/config')) return jsonResponse({ storage_target: 'local' });
    if (url.startsWith('/api/')) return jsonResponse([]);
    return undefined;
  });
}
const goto = (path) => window.history.replaceState({}, '', path);
const nav = () => within(screen.getByRole('navigation', { name: 'Dashboard sections' }));

beforeEach(() => { globalThis.__fakeSocket = createFakeSocket(); desktop(); goto('/'); });

describe('App - session handling', () => {
  it('shows the public landing page when signed out', async () => {
    backend(); render(<App />);
    expect(await screen.findAllByText(/mycam/i)).not.toHaveLength(0);
    expect(screen.queryByRole('navigation', { name: 'Dashboard sections' })).not.toBeInTheDocument();
  });
  it('restores a stored session straight into the dashboard', async () => {
    localStorage.setItem('mycam_token', 'jwt.abc'); localStorage.setItem('mycam_user', JSON.stringify(USER));
    backend(); render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Dashboard sections' })).toBeInTheDocument();
  });
  it.each([['invalid JSON', '{broken'], ['a JSON null', 'null'], ['a primitive', '42'], ['an empty object', '{}']])('treats %s in mycam_user as signed out without crashing', async (_l, raw) => {
    localStorage.setItem('mycam_user', raw); backend(); render(<App />);
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Dashboard sections' })).not.toBeInTheDocument());
  });
});

describe('App - login, navigation and logout', () => {
  it('logs in from /login, stores the session, lands on the dashboard, then logs out and clears storage', async () => {
    const f = backend(); const user = userEvent.setup(); goto('/login');
    const { container } = render(<App />);
    await user.type(container.querySelector('#login-username'), 'rudy');
    await user.type(container.querySelector('#login-password'), 'Secret#123');
    await user.click(screen.getByRole('button', { name: /sign in to mycam/i }));
    expect(await screen.findByRole('navigation', { name: 'Dashboard sections' })).toBeInTheDocument();
    expect(localStorage.getItem('mycam_token')).toBe('jwt.abc');
    expect(JSON.parse(localStorage.getItem('mycam_user'))).toMatchObject({ id: 7, username: 'rudy' });
    expect(f.calls.some((c) => c.headers.Authorization === 'Bearer jwt.abc')).toBe(true); // later requests are authenticated
    await user.click(screen.getByRole('button', { name: /sign out|log ?out/i }));
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Dashboard sections' })).not.toBeInTheDocument());
    expect(localStorage.getItem('mycam_token')).toBeNull();
    expect(localStorage.getItem('mycam_user')).toBeNull();
  });
  it('stays on the login form after a rejected login', async () => {
    backend({ 'POST /api/login': () => jsonResponse({ message: 'Invalid credentials' }, 401) });
    const user = userEvent.setup(); goto('/login'); const { container } = render(<App />);
    await user.type(container.querySelector('#login-username'), 'rudy');
    await user.type(container.querySelector('#login-password'), 'bad');
    await user.click(screen.getByRole('button', { name: /sign in to mycam/i }));
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Dashboard sections' })).not.toBeInTheDocument();
    expect(localStorage.getItem('mycam_user')).toBeNull();
  });
  it('loads each dashboard section through the sidebar using the existing endpoints', async () => {
    localStorage.setItem('mycam_token', 'jwt.abc'); localStorage.setItem('mycam_user', JSON.stringify(USER));
    const f = backend(); const user = userEvent.setup(); render(<App />);
    await screen.findByRole('navigation', { name: 'Dashboard sections' });
    const hit = (frag) => f.calls.some((c) => c.url.includes(frag));
    await user.click(nav().getByRole('button', { name: /recordings/i }));
    await waitFor(() => expect(hit('/api/recordings?user_id=7')).toBe(true));
    await user.click(nav().getByRole('button', { name: /schedules/i }));
    await waitFor(() => expect(hit('/api/schedules?user_id=7')).toBe(true));
    await user.click(nav().getByRole('button', { name: /activity zones/i }));
    await waitFor(() => expect(hit('/api/zones?user_id=7')).toBe(true));
    await user.click(nav().getByRole('button', { name: /settings/i }));
    await waitFor(() => expect(hit('/api/storage/status?user_id=7')).toBe(true));
    expect(nav().getByRole('button', { name: /settings/i })).toHaveAttribute('aria-current', 'page');
  });
});

describe('App - password reset link', () => {
  it('opens the reset form for /?token=..., uses the token from the link and hides the manual field', async () => {
    const f = backend({ 'POST /api/reset-password': () => jsonResponse({ message: 'Password updated successfully' }) });
    const user = userEvent.setup(); goto('/?token=link-token-123'); const { container } = render(<App />);
    expect(await screen.findByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    expect(container.querySelector('#reset-token')).toBeNull();
    await user.type(container.querySelector('#reset-password'), 'N3w!Passw0rd');
    await user.type(container.querySelector('#reset-confirm'), 'N3w!Passw0rd');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Password reset successfully')).toBeInTheDocument();
    expect(JSON.parse(f.calls.find((c) => c.url === '/api/reset-password').body)).toEqual({ token: 'link-token-123', newPassword: 'N3w!Passw0rd' });
  });
});
