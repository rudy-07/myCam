import { test, expect, shot } from '../fixtures';
import { mockBackend, makeState, signInSession, USER, PASSWORD } from './mocks';

const consent = (page) => page.addInitScript(() => localStorage.setItem('mycam_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() })));

test.describe('1-2. Landing page and navbar', () => {
  test('landing page loads with its hero, calls to action and footer', async ({ page }, info) => {
    await mockBackend(page); await consent(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/myCam/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Real-Time Security');
    await expect(page.getByRole('button', { name: 'Login' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' }).first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await shot(page, info, '01-landing');
  });

  test('navbar: section links scroll, Login and Get Started open their forms, browser Back returns', async ({ page }, info) => {
    await mockBackend(page); await consent(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByText('Features', { exact: true }).first().click();
    await expect(page.locator('#features')).toBeInViewport({ timeout: 5000 });
    await page.getByRole('button', { name: 'Login' }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /sign in to mycam/i })).toBeVisible();
    await shot(page, info, '02-navbar-login');
    await page.goBack();
    await expect(page).not.toHaveURL(/\/login/);
    await page.getByRole('button', { name: 'Get Started' }).first().click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#reg-name')).toBeVisible();
  });

  test('legal pages open from the footer and can return', async ({ page }) => {
    await mockBackend(page); await consent(page);
    await page.goto('/');
    for (const [label, heading] of [['Privacy Policy', /privacy/i], ['Terms of Service', /terms/i], ['Cookie Policy', /cookie/i]]) {
      await page.getByRole('contentinfo').getByText(label, { exact: true }).first().click();
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.locator('body')).toContainText(heading);
      await page.goto('/');
    }
  });

  test('theme toggle switches the document theme', async ({ page }) => {
    await mockBackend(page); await consent(page);
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.getByRole('button', { name: 'Toggle theme' }).first().click();
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(after).not.toBe(before);
  });
});

test.describe('3. Registration form validation', () => {
  const fill = async (page, v = {}) => {
    const d = { name: 'Rudy Cam', username: 'rudy.cam', email: 'rudy@example.com', password: 'Str0ng!Pass', ...v };
    await page.locator('#reg-name').fill(d.name); await page.locator('#reg-username').fill(d.username);
    await page.locator('#reg-email').fill(d.email); await page.locator('#reg-password').fill(d.password);
    await page.locator('#reg-confirm').fill(v.confirm ?? d.password);
    if (v.terms !== false) await page.locator('#reg-terms-checkbox').check();
  };
  test('blocks weak passwords, bad usernames and mismatches WITHOUT calling the server', async ({ page }, info) => {
    const state = await mockBackend(page); await consent(page);
    await page.goto('/register');
    for (const [override, message] of [
      [{ password: 'str0ng!pass' }, /uppercase/i], [{ password: 'Strong!Pass' }, /number/i], [{ password: 'Str0ngPass1' }, /special/i],
      [{ username: 'a b' }, /username/i], [{ email: 'nope' }, /email/i], [{ confirm: 'Different1!' }, /do not match/i],
    ]) {
      await fill(page, override);
      await page.getByRole('button', { name: /create mycam account/i }).click();
      await expect(page.locator('.auth-message--error')).toContainText(message);
    }
    expect(state.calls.some((c) => c.key === 'POST /api/register')).toBe(false);
    await shot(page, info, '03-register-validation');
  });
  test('the strong-password generator fills both fields with a policy-compliant value', async ({ page }) => {
    await mockBackend(page); await consent(page);
    await page.goto('/register');
    await page.getByRole('button', { name: /generate strong password/i }).click();
    const pw = await page.locator('#reg-password').inputValue();
    expect(pw).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/);
    expect(await page.locator('#reg-confirm').inputValue()).toBe(pw);
  });
  test('a valid registration posts the contract and moves on; a taken username shows the server message', async ({ page, allowConsole }) => {
    allowConsole.push(/Failed to load resource/);
    const state = await mockBackend(page); await consent(page);
    await page.goto('/register');
    await fill(page, { username: 'taken' });
    await page.getByRole('button', { name: /create mycam account/i }).click();
    await expect(page.locator('.auth-message--error')).toContainText('Username or email already exists');
    await fill(page);
    await page.getByRole('button', { name: /create mycam account/i }).click();
    await expect(page).toHaveURL(/\/login/);
    const call = state.calls.filter((c) => c.key === 'POST /api/register').pop();
    expect(call.body).toEqual({ name: 'Rudy Cam', username: 'rudy.cam', email: 'rudy@example.com', password: 'Str0ng!Pass' });
  });
  test.describe('server failures never leak parser errors', () => {
    test.beforeEach(({ allowConsole }) => { allowConsole.push(/Failed to load resource/); });
    test('HTML gateway error page', async ({ page }) => {
      const state = await mockBackend(page); await consent(page);
      state.fail['POST /api/register'] = { status: 502, body: '<!doctype html><html>Bad Gateway</html>', type: 'text/html' };
      await page.goto('/register'); await fill(page);
      await page.getByRole('button', { name: /create mycam account/i }).click();
      const banner = page.locator('.auth-message--error');
      await expect(banner).toBeVisible();
      await expect(banner).not.toContainText(/Unexpected token|<!doctype|JSON/i);
    });
  });
});

test.describe('4. Login and logout', () => {
  test('logs in, lands on the dashboard, survives a reload, then logs out and clears the session', async ({ page }, info) => {
    await mockBackend(page); await consent(page);
    await page.goto('/login');
    await page.locator('#login-username').fill(USER.username);
    await page.locator('#login-password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in to mycam/i }).click();
    await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('mycam_token'))).toBe('e2e.jwt.token');
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toBeVisible(); // session restored
    await shot(page, info, '04-dashboard-after-login');
    await page.getByRole('button', { name: /sign out|log ?out/i }).click();
    await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toHaveCount(0);
    expect(await page.evaluate(() => [localStorage.getItem('mycam_token'), localStorage.getItem('mycam_user')])).toEqual([null, null]);
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toHaveCount(0); // stays signed out
  });
  test('wrong credentials show the server message and stay signed out', async ({ page, allowConsole }) => {
    allowConsole.push(/Failed to load resource/);
    await mockBackend(page); await consent(page);
    await page.goto('/login');
    await page.locator('#login-username').fill('rudy'); await page.locator('#login-password').fill('wrong');
    await page.getByRole('button', { name: /sign in to mycam/i }).click();
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashboard sections' })).toHaveCount(0);
  });
  test('an HTML 502 from the gateway shows a friendly message, not a parser error', async ({ page, allowConsole }) => {
    allowConsole.push(/Failed to load resource/);
    const state = await mockBackend(page); await consent(page);
    state.fail['POST /api/login'] = { status: 502, body: '<html>Bad Gateway</html>', type: 'text/html' };
    await page.goto('/login');
    await page.locator('#login-username').fill('rudy'); await page.locator('#login-password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in to mycam/i }).click();
    await expect(page.locator('.auth-message--error')).toContainText('Request failed (502)');
  });
  test('corrupt stored session data is ignored (no crash, signed out)', async ({ page }) => {
    await mockBackend(page); await consent(page);
    await page.addInitScript(() => localStorage.setItem('mycam_user', '{broken'));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('5. Forgot and reset password', () => {
  test('forgot password: validation, neutral confirmation, and rate-limit message', async ({ page, allowConsole }, info) => {
    allowConsole.push(/Failed to load resource/);
    const state = await mockBackend(page); await consent(page);
    await page.goto('/forgot-password');
    await page.getByRole('button', { name: /send password reset link/i }).click();
    await expect(page.getByText(/enter your email/i)).toBeVisible();
    state.fail['POST /api/forgot-password'] = { status: 429, body: { message: 'Too many attempts. Please wait a little and try again.' } };
    await page.locator('#forgot-email').fill('rudy@example.com');
    await page.getByRole('button', { name: /send password reset link/i }).click();
    await expect(page.getByText(/too many attempts/i)).toBeVisible();
    delete state.fail['POST /api/forgot-password'];
    await page.getByRole('button', { name: /send password reset link/i }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
    await shot(page, info, '05-forgot-password');
  });
  test('reset password via emailed link: token comes from the URL, weak password is blocked, success is shown', async ({ page }, info) => {
    const state = await mockBackend(page); await consent(page);
    await page.goto('/?token=good-token');
    await expect(page.getByRole('heading', { name: /set new password/i })).toBeVisible();
    await expect(page.locator('#reset-token')).toHaveCount(0);
    await page.locator('#reset-password').fill('weakpass');
    await page.locator('#reset-confirm').fill('weakpass');
    await expect(page.getByRole('button', { name: /update password/i })).toBeDisabled();
    await page.getByRole('button', { name: /generate strong password/i }).click();
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText('Password reset successfully')).toBeVisible();
    expect(state.calls.find((c) => c.key === 'POST /api/reset-password').body.token).toBe('good-token');
    await shot(page, info, '05-reset-password');
  });
  test('reset without a link: the token can be typed by hand in full (regression)', async ({ page }) => {
    const state = await mockBackend(page); await consent(page);
    await page.goto('/reset-password');
    await page.locator('#reset-token').pressSequentially('good-token');
    await expect(page.locator('#reset-token')).toHaveValue('good-token');
    await page.getByRole('button', { name: /generate strong password/i }).click();
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText('Password reset successfully')).toBeVisible();
    expect(state.calls.find((c) => c.key === 'POST /api/reset-password').body.token).toBe('good-token');
  });
});
void signInSession; void makeState;
