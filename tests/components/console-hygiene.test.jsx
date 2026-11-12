import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../src/components/auth/Login';
import Register from '../../src/components/auth/Register';
import ForgotPassword from '../../src/components/auth/ForgotPassword';
import ResetPassword from '../../src/components/auth/ResetPassword';
import { installFetch, jsonResponse } from '../helpers/fetch';

// Regression: auth screens used HTML-style SVG attributes (stroke-width...) which makes React log
// "Invalid DOM property" errors in the browser console on every render.
const noop = () => {};
const reactWarnings = (spy) => spy.mock.calls.map((c) => String(c[0]) + ' ' + c.slice(1).join(' ')).filter((m) => /Invalid DOM property|Unknown event handler|Warning:/i.test(m));

describe('auth screens render without React console errors', () => {
  it.each([
    ['Login', () => <Login onLoginSuccess={noop} onBack={noop} onRegisterClick={noop} onForgotClick={noop} />],
    ['Register', () => <Register onRegisterSuccess={noop} onBack={noop} onLoginClick={noop} onTermsClick={noop} onPrivacyClick={noop} />],
    ['ForgotPassword', () => <ForgotPassword onBack={noop} onLoginClick={noop} />],
    ['ResetPassword', () => <ResetPassword onBack={noop} onLoginClick={noop} />],
  ])('%s', (_name, make) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(make());
    expect(reactWarnings(spy)).toEqual([]);
  });
  it('ForgotPassword success state (contains an SVG) is also clean', async () => {
    installFetch(() => jsonResponse({ message: 'ok' }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup(); const { container } = render(<ForgotPassword onBack={noop} onLoginClick={noop} />);
    await user.type(container.querySelector('#forgot-email'), 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));
    await screen.findByText('Check your inbox');
    expect(reactWarnings(spy)).toEqual([]);
  });
  it('ResetPassword success state is also clean', async () => {
    installFetch(() => jsonResponse({ message: 'ok' }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup(); const { container } = render(<ResetPassword onBack={noop} onLoginClick={noop} />);
    await user.type(container.querySelector('#reset-token'), 't');
    await user.click(screen.getByRole('button', { name: /generate strong password/i }));
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await screen.findByText('Password reset successfully');
    expect(reactWarnings(spy)).toEqual([]);
  });
});
