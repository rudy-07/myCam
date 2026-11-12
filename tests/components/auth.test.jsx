import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../../src/components/auth/Login';
import Register from '../../src/components/auth/Register';
import ForgotPassword from '../../src/components/auth/ForgotPassword';
import ResetPassword from '../../src/components/auth/ResetPassword';
import { installFetch, jsonResponse, textResponse, parseBody } from '../helpers/fetch';

// Backend password policy (server/auth.cjs): 8-128 chars, upper, lower, digit, special.
const meetsBackendPolicy = (pw) =>
  typeof pw === 'string' && pw.length >= 8 && pw.length <= 128 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);

const $ = (container, sel) => container.querySelector(sel);

/* Server-failure shapes every auth form must survive */
const FAILURES = [
  ['an HTML 502 gateway page', () => textResponse('<!doctype html><html><body>Bad Gateway</body></html>', 502)],
  ['an HTML 200 page (SPA fallback)', () => textResponse('<!doctype html><html><body>app</body></html>', 200)],
  ['invalid JSON with a JSON content-type', () => new Response('{"oops":', { status: 500, headers: { 'content-type': 'application/json' } })],
  ['an empty 500 body', () => new Response('', { status: 500 })],
  ['an empty 200 body', () => new Response('', { status: 200 })],
];
const ugly = /Unexpected token|Unexpected end of JSON|is not valid JSON|JSON\.parse|<!doctype/i;

/* ---------------- Login ---------------- */
describe('Login', () => {
  const setup = (props = {}) => {
    const onLoginSuccess = vi.fn();
    const utils = render(<Login onLoginSuccess={onLoginSuccess} onBack={() => {}} onRegisterClick={() => {}} onForgotClick={() => {}} {...props} />);
    return { onLoginSuccess, ...utils };
  };
  const fill = async (user, { container }, name = 'rudy', pw = 'Secret#123') => {
    await user.type($(container, '#login-username'), name);
    await user.type($(container, '#login-password'), pw);
    await user.click(screen.getByRole('button', { name: /sign in to mycam/i }));
  };

  it('requires both fields and sends no request when empty', async () => {
    const f = installFetch(() => jsonResponse({}));
    const user = userEvent.setup(); const s = setup();
    await user.click(screen.getByRole('button', { name: /sign in to mycam/i }));
    expect(await screen.findByText(/enter your username and password/i)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    expect(s.onLoginSuccess).not.toHaveBeenCalled();
  });

  it('posts the exact existing contract, stores the token and reports the user', async () => {
    const f = installFetch(() => jsonResponse({ token: 'jwt.token.here', user: { id: 3, username: 'rudy' } }));
    const user = userEvent.setup(); const s = setup();
    await fill(user, s, '  rudy  ');
    await waitFor(() => expect(s.onLoginSuccess).toHaveBeenCalledWith({ id: 3, username: 'rudy' }));
    expect(f.calls[0].url).toBe('/api/login');
    expect(f.calls[0].method).toBe('POST');
    expect(parseBody(f.calls[0])).toEqual({ username: 'rudy', password: 'Secret#123' });
    expect(localStorage.getItem('mycam_token')).toBe('jwt.token.here');
  });

  it('shows the server message for rejected credentials and stores nothing', async () => {
    installFetch(() => jsonResponse({ message: 'Invalid credentials' }, 401));
    const user = userEvent.setup(); const s = setup();
    await fill(user, s);
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(localStorage.getItem('mycam_token')).toBeNull();
    expect(s.onLoginSuccess).not.toHaveBeenCalled();
  });

  it.each(FAILURES)('survives %s without leaking parser errors or logging in', async (_l, make) => {
    installFetch(make);
    const user = userEvent.setup(); const s = setup();
    await fill(user, s);
    const banner = await waitFor(() => { const el = document.querySelector('.auth-message--error'); expect(el).toBeTruthy(); return el; });
    expect(banner.textContent).not.toMatch(ugly);
    expect(s.onLoginSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem('mycam_token')).toBeNull();
  });

  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup(); const s = setup();
    await fill(user, s);
    expect(await screen.findByText(/could not reach mycam/i)).toBeInTheDocument();
  });
});

/* ---------------- Register ---------------- */
describe('Register', () => {
  const setup = () => {
    const onRegisterSuccess = vi.fn();
    const utils = render(<Register onRegisterSuccess={onRegisterSuccess} onBack={() => {}} onLoginClick={() => {}} onTermsClick={() => {}} onPrivacyClick={() => {}} />);
    return { onRegisterSuccess, ...utils };
  };
  const fill = async (user, { container }, v = {}) => {
    const d = { name: 'Rudy Cam', username: 'rudy.cam', email: 'rudy@example.com', password: 'Str0ng!Pass', ...v };
    await user.type($(container, '#reg-name'), d.name);
    await user.type($(container, '#reg-username'), d.username);
    await user.type($(container, '#reg-email'), d.email);
    await user.type($(container, '#reg-password'), d.password);
    await user.type($(container, '#reg-confirm'), v.confirm ?? d.password);
    await user.click($(container, '#reg-terms-checkbox'));
    await user.click(screen.getByRole('button', { name: /create mycam account/i }));
  };

  describe('password generation (regression: Math.random was used)', () => {
    it('produces a policy-compliant password without Math.random', async () => {
      const s = setup(); const user = userEvent.setup();
      const rand = vi.spyOn(Math, 'random');
      rand.mockClear();
      await user.click(screen.getByRole('button', { name: /generate strong password/i }));
      const pw = $(s.container, '#reg-password').value;
      expect(meetsBackendPolicy(pw)).toBe(true);
      expect(pw).toBe($(s.container, '#reg-confirm').value);
      expect(rand).not.toHaveBeenCalled();
    });
    it('draws its randomness from crypto.getRandomValues', async () => {
      const s = setup(); const user = userEvent.setup();
      const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
      await user.click(screen.getByRole('button', { name: /generate strong password/i }));
      expect(spy).toHaveBeenCalled();
      expect(meetsBackendPolicy($(s.container, '#reg-password').value)).toBe(true);
    });
    it('generates different passwords on repeated clicks', async () => {
      const s = setup(); const user = userEvent.setup();
      const seen = new Set();
      for (let i = 0; i < 5; i += 1) {
        await user.click(screen.getByRole('button', { name: /generate strong password/i }));
        seen.add($(s.container, '#reg-password').value);
      }
      expect(seen.size).toBe(5);
    });
  });

  describe('client validation mirrors the backend policy (regression: only length was checked)', () => {
    it.each([
      ['no uppercase letter', { password: 'str0ng!pass' }, /uppercase/i],
      ['no lowercase letter', { password: 'STR0NG!PASS' }, /lowercase/i],
      ['no number', { password: 'Strong!Pass' }, /number/i],
      ['no special character', { password: 'Str0ngPass1' }, /special/i],
      ['fewer than 8 characters', { password: 'S0!a' }, /8/],
      ['more than 128 characters', { password: `Aa1!${'x'.repeat(130)}` }, /128/],
    ])('blocks a password with %s before any request', async (_l, v, msg) => {
      const f = installFetch(() => jsonResponse({}, 201));
      const user = userEvent.setup(); const s = setup();
      await fill(user, s, v);
      const banner = await waitFor(() => { const el = document.querySelector('.auth-message--error'); expect(el).toBeTruthy(); return el; });
      expect(banner.textContent).toMatch(msg);
      expect(f).not.toHaveBeenCalled();
      expect(s.onRegisterSuccess).not.toHaveBeenCalled();
    });
    it.each([
      ['a too-short username', { username: 'ab' }],
      ['a username with spaces', { username: 'bad name' }],
      ['a username with symbols', { username: 'bad@name' }],
      ['a username over 40 characters', { username: 'u'.repeat(41) }],
      ['an email without a domain', { email: 'rudy@' }],
      ['an email with spaces', { email: 'ru dy@example.com' }],
    ])('blocks %s before any request', async (_l, v) => {
      const f = installFetch(() => jsonResponse({}, 201));
      const user = userEvent.setup(); const s = setup();
      await fill(user, s, v);
      await waitFor(() => expect(document.querySelector('.auth-message--error')).toBeTruthy());
      expect(f).not.toHaveBeenCalled();
    });
    it('blocks mismatched confirmation and missing terms consent', async () => {
      const f = installFetch(() => jsonResponse({}, 201));
      const user = userEvent.setup(); const s = setup();
      await fill(user, s, { confirm: 'Different1!' });
      expect((await screen.findAllByText(/do not match/i)).length).toBeGreaterThan(0);
      expect(f).not.toHaveBeenCalled();
    });
    it('accepts exactly the backend limits (username 3 and 40 chars, password 128 chars)', async () => {
      const f = installFetch(() => jsonResponse({ message: 'ok' }, 201));
      const user = userEvent.setup(); const s = setup();
      await fill(user, s, { username: 'a_.-'.repeat(10), password: `Aa1!${'x'.repeat(124)}` });
      await waitFor(() => expect(s.onRegisterSuccess).toHaveBeenCalled());
      expect(f).toHaveBeenCalledTimes(1);
    });
  });

  it('posts the exact existing contract and reports success', async () => {
    const f = installFetch(() => jsonResponse({ message: 'User registered successfully' }, 201));
    const user = userEvent.setup(); const s = setup();
    await fill(user, s, { name: '  Rudy Cam ', email: ' rudy@example.com ' });
    await waitFor(() => expect(s.onRegisterSuccess).toHaveBeenCalledTimes(1));
    expect(f.calls[0].url).toBe('/api/register');
    expect(parseBody(f.calls[0])).toEqual({ name: 'Rudy Cam', username: 'rudy.cam', email: 'rudy@example.com', password: 'Str0ng!Pass' });
  });

  it('shows the server message when the account already exists', async () => {
    installFetch(() => jsonResponse({ message: 'Username or email already exists' }, 400));
    const user = userEvent.setup(); const s = setup();
    await fill(user, s);
    expect(await screen.findByText('Username or email already exists')).toBeInTheDocument();
    expect(s.onRegisterSuccess).not.toHaveBeenCalled();
  });

  it.each(FAILURES.filter(([l]) => !/200/.test(l)))('survives %s', async (_l, make) => {
    installFetch(make);
    const user = userEvent.setup(); const s = setup();
    await fill(user, s);
    const banner = await waitFor(() => { const el = document.querySelector('.auth-message--error'); expect(el).toBeTruthy(); return el; });
    expect(banner.textContent).not.toMatch(ugly);
    expect(s.onRegisterSuccess).not.toHaveBeenCalled();
  });

  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup(); const s = setup();
    await fill(user, s);
    expect(await screen.findByText(/could not reach mycam/i)).toBeInTheDocument();
  });
});

/* ---------------- Forgot password ---------------- */
describe('ForgotPassword', () => {
  const setup = () => render(<ForgotPassword onBack={() => {}} onLoginClick={() => {}} />);
  const submit = async (user, c, email = 'rudy@example.com') => {
    await user.type($(c, '#forgot-email'), email);
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));
  };
  it('requires an email', async () => {
    const f = installFetch(() => jsonResponse({}));
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));
    expect(await screen.findByText(/enter your email/i)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });
  it('posts the exact contract and shows the neutral confirmation', async () => {
    const f = installFetch(() => jsonResponse({ message: 'If that email is registered, a reset link has been sent.' }));
    const user = userEvent.setup(); const { container } = setup();
    await submit(user, container, ' rudy@example.com ');
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(f.calls[0].url).toBe('/api/forgot-password');
    expect(parseBody(f.calls[0])).toEqual({ email: 'rudy@example.com' });
  });
  it.each(FAILURES.filter(([l]) => !/200/.test(l)))('survives %s', async (_l, make) => {
    installFetch(make);
    const user = userEvent.setup(); const { container } = setup();
    await submit(user, container);
    const banner = await waitFor(() => { const el = document.querySelector('.auth-message--error'); expect(el).toBeTruthy(); return el; });
    expect(banner.textContent).not.toMatch(ugly);
    expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  });
  it('shows the server rate-limit message', async () => {
    installFetch(() => jsonResponse({ message: 'Too many attempts. Try again later.' }, 429));
    const user = userEvent.setup(); const { container } = setup();
    await submit(user, container);
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });
});

/* ---------------- Reset password ---------------- */
describe('ResetPassword', () => {
  const setup = () => render(<ResetPassword onBack={() => {}} onLoginClick={() => {}} />);
  const fill = async (user, c, pw = 'N3w!Passw0rd') => {
    await user.type($(c, '#reset-token'), 'abc123token');
    await user.type($(c, '#reset-password'), pw);
    await user.type($(c, '#reset-confirm'), pw);
  };
  describe('password generation (regression: Math.random was used)', () => {
    it('produces a policy-compliant password without Math.random', async () => {
      const { container } = setup(); const user = userEvent.setup();
      const rand = vi.spyOn(Math, 'random'); rand.mockClear();
      await user.click(screen.getByRole('button', { name: /generate strong password/i }));
      expect(meetsBackendPolicy($(container, '#reset-password').value)).toBe(true);
      expect($(container, '#reset-password').value).toBe($(container, '#reset-confirm').value);
      expect(rand).not.toHaveBeenCalled();
    });
    it('draws its randomness from crypto.getRandomValues', async () => {
      setup(); const user = userEvent.setup();
      const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
      await user.click(screen.getByRole('button', { name: /generate strong password/i }));
      expect(spy).toHaveBeenCalled();
    });
  });
  it('keeps the submit button disabled for a weak password', async () => {
    const { container } = setup(); const user = userEvent.setup();
    await fill(user, container, 'weakpass');
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });
  it('posts the exact contract and shows success', async () => {
    const f = installFetch(() => jsonResponse({ message: 'Password updated successfully' }));
    const { container } = setup(); const user = userEvent.setup();
    await fill(user, container);
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Password reset successfully')).toBeInTheDocument();
    expect(f.calls[0].url).toBe('/api/reset-password');
    expect(parseBody(f.calls[0])).toEqual({ token: 'abc123token', newPassword: 'N3w!Passw0rd' });
  });
  it('shows the server message for an expired token', async () => {
    installFetch(() => jsonResponse({ message: 'Invalid or expired token' }, 400));
    const { container } = setup(); const user = userEvent.setup();
    await fill(user, container);
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Invalid or expired token')).toBeInTheDocument();
  });
  it.each(FAILURES.filter(([l]) => !/200/.test(l)))('survives %s', async (_l, make) => {
    installFetch(make);
    const { container } = setup(); const user = userEvent.setup();
    await fill(user, container);
    await user.click(screen.getByRole('button', { name: /update password/i }));
    const banner = await waitFor(() => { const el = document.querySelector('.auth-message--error'); expect(el).toBeTruthy(); return el; });
    expect(banner.textContent).not.toMatch(ugly);
    expect(screen.queryByText('Password reset successfully')).not.toBeInTheDocument();
  });
});
