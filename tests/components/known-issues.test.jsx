import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../src/components/auth/Login';
import { installFetch, jsonResponse } from '../helpers/fetch';

/*
 * KNOWN ISSUES - characterization tests.
 * These assert CURRENT behaviour of defects that are documented but intentionally NOT changed
 * (they need a product decision). They pass today; if someone fixes the behaviour they will fail
 * on purpose, prompting an update. See BUG_AUDIT.md.
 */
describe('KNOWN ISSUE KI-01: "Keep me signed in" has no effect', () => {
  it('is checked by default', () => {
    render(<Login onLoginSuccess={() => {}} onBack={() => {}} onRegisterClick={() => {}} onForgotClick={() => {}} />);
    expect(screen.getByLabelText(/keep me signed in/i)).toBeChecked();
  });
  it('the session is still written to localStorage after the box is unchecked', async () => {
    installFetch(() => jsonResponse({ token: 'jwt.abc', user: { id: 1, username: 'u' } }));
    const onLoginSuccess = vi.fn(); const user = userEvent.setup();
    const { container } = render(<Login onLoginSuccess={onLoginSuccess} onBack={() => {}} onRegisterClick={() => {}} onForgotClick={() => {}} />);
    await user.click(screen.getByLabelText(/keep me signed in/i));
    expect(screen.getByLabelText(/keep me signed in/i)).not.toBeChecked();
    await user.type(container.querySelector('#login-username'), 'u');
    await user.type(container.querySelector('#login-password'), 'Secret#123');
    await user.click(screen.getByRole('button', { name: /sign in to mycam/i }));
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalled());
    expect(localStorage.getItem('mycam_token')).toBe('jwt.abc'); // persists regardless of the checkbox
    expect(sessionStorage.getItem('mycam_token')).toBeNull();
  });
});
