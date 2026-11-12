// REAL-BACKEND E2E: real browser -> Vite proxy -> real Express/Socket.IO backend -> real database (throwaway test DB).
// The "camera" is Chromium's SYNTHETIC test device (--use-fake-device-for-media-stream). It exercises the real
// getUserMedia / WebRTC / MediaRecorder code paths but is NOT a physical camera: physical hardware stays a manual check.
import crypto from 'node:crypto';
import { test, expect, shot } from '../fixtures';
import { api, db, closeDb, seedUser, removeUsers, backendReachable, mintToken } from '../../real/helpers';

const users = [];
let reachable = false;
test.beforeAll(async () => { reachable = await backendReachable(); });
test.afterAll(async () => { await removeUsers(users); await closeDb(); });
test.beforeEach(() => { test.skip(!reachable, 'Real backend (:3000) is not reachable - these tests need it. See TEST_PLAN.md.'); });

const consent = (page) => page.addInitScript(() => localStorage.setItem('mycam_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() })));
const nav = (page) => page.getByRole('navigation', { name: 'Dashboard sections' });
const sessionFor = (page, u) => page.addInitScript(([user, token]) => {
  localStorage.setItem('mycam_token', token);
  localStorage.setItem('mycam_user', JSON.stringify({ id: user.id, username: user.username, name: `QA ${user.username}`, email: user.email }));
}, [u, mintToken(u)]);
const fresh = async (prefix) => { const u = await seedUser(prefix); users.push(u); return u; };
const SQUARE = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];
const webm = () => { const f = new FormData(); f.append('camera_id', 'mobile'); f.append('duration', '00:07'); f.append('trigger_type', 'manual'); f.append('video', new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(2048).fill(7)])], { type: 'video/webm' }), `e2e-${Date.now()}.webm`); return f; };

test.describe('REAL: authentication through the UI', () => {
  test('login with real credentials, reload keeps the session, logout clears it', async ({ page }, info) => {
    const u = await fresh('e2elogin'); await consent(page);
    await page.goto('/login');
    await page.locator('#login-username').fill(u.username);
    await page.locator('#login-password').fill(u.password);
    await page.getByRole('button', { name: /sign in to mycam/i }).click();
    await expect(nav(page)).toBeVisible();
    await page.reload();
    await expect(nav(page)).toBeVisible();
    await shot(page, info, 'R1-real-login');
    await page.getByRole('button', { name: /sign out|log ?out/i }).click();
    await expect(nav(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('mycam_token'))).toBeNull();
  });
  test('wrong password shows the real server message', async ({ page, allowConsole }) => {
    allowConsole.push(/Failed to load resource/);
    const u = await fresh('e2ebad'); await consent(page);
    await page.goto('/login');
    await page.locator('#login-username').fill(u.username);
    await page.locator('#login-password').fill('Wrong!Pass123');
    await page.getByRole('button', { name: /sign in to mycam/i }).click();
    await expect(page.locator('.auth-message--error')).toContainText(/invalid|incorrect|credentials/i);
    await expect(nav(page)).toHaveCount(0);
  });
  test('register through the UI creates a real account that can then log in', async ({ page }, info) => {
    await consent(page);
    const tag = `e2ereg_${crypto.randomBytes(3).toString('hex')}`;
    const email = `${tag}@example.test`;
    await page.goto('/register');
    await page.locator('#reg-name').fill('E2E Register'); await page.locator('#reg-username').fill(tag);
    await page.locator('#reg-email').fill(email);
    await page.getByRole('button', { name: /generate strong password/i }).click();
    const password = await page.locator('#reg-password').inputValue();
    await page.locator('#reg-terms-checkbox').check();
    await page.getByRole('button', { name: /create mycam account/i }).click();
    await expect(page).toHaveURL(/\/login/);
    const [rows] = await db().execute('SELECT id FROM users WHERE username = ?', [tag]);
    expect(rows).toHaveLength(1);
    users.push({ id: rows[0].id, email });
    await page.locator('#login-username').fill(tag);
    await page.locator('#login-password').fill(password); // the generated password really satisfies the real server
    await page.getByRole('button', { name: /sign in to mycam/i }).click();
    await expect(nav(page)).toBeVisible();
    await shot(page, info, 'R2-real-register-then-login');
  });
  test('forgot password shows the neutral confirmation from the real server', async ({ page }) => {
    const u = await fresh('e2eforgot'); await consent(page);
    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill(u.email);
    await page.getByRole('button', { name: /send password reset link/i }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
  });
  test('reset password via the emailed-link URL changes the real password', async ({ page }, info) => {
    const u = await fresh('e2ereset'); await consent(page);
    const token = crypto.randomBytes(24).toString('hex'); // email delivery is not testable here; harness stores a known token hash
    await db().execute('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR)) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)', [u.email, crypto.createHash('sha256').update(token).digest('hex')]);
    await page.goto(`/?token=${token}`);
    await page.getByRole('button', { name: /generate strong password/i }).click();
    const pw = await page.locator('#reset-password').inputValue();
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText('Password reset successfully')).toBeVisible();
    await shot(page, info, 'R3-real-reset-password');
    expect((await api('/api/login', { method: 'POST', body: { username: u.username, password: pw } })).status).toBe(200);
    expect((await api('/api/login', { method: 'POST', body: { username: u.username, password: u.password } })).status).toBe(401);
  });
});

test.describe('REAL: data screens against the live API', () => {
  test('search palette shows the REAL schedule window/state and zone details (end-to-end regression)', async ({ page }, info) => {
    const u = await fresh('e2esearch'); const token = mintToken(u);
    await api('/api/schedules', { method: 'POST', token, body: { user_id: u.id, camera_id: 'mobile', name: 'E2E night', days: ['Mon', 'Tue'], start_time: '22:00', end_time: '06:00' } });
    await api('/api/zones', { method: 'POST', token, body: { user_id: u.id, camera_id: 'mobile', name: 'E2E gate', coordinates: SQUARE } });
    await consent(page); await sessionFor(page, u); await page.goto('/');
    await page.getByLabel('Comprehensive Global Search').click();
    const palette = page.getByRole('dialog', { name: /search results/i });
    const row = (text) => palette.getByText(text, { exact: true }).locator('xpath=ancestor::*[self::button or @role="option"][1]');
    await expect(row('E2E night')).toContainText('22:00 - 06:00');
    await expect(row('E2E night')).toContainText('Mon, Tue');
    await expect(row('E2E night')).toContainText('Active');
    await expect(row('E2E night')).not.toContainText('00:00 - 23:59');
    await expect(row('E2E gate')).toContainText('4 points');
    await expect(row('E2E gate')).toContainText('CAM-01');
    await shot(page, info, 'R4-real-search-palette');
  });
  test('recordings: an uploaded file is verified and playable-listed, then deleted from UI and database', async ({ page }, info) => {
    const u = await fresh('e2erec'); const token = mintToken(u);
    expect((await api('/api/recordings', { method: 'POST', token, form: webm(), headers: { 'Idempotency-Key': `e2e-${Date.now()}-abc` } })).status).toBeLessThan(300);
    await consent(page); await sessionFor(page, u); await page.goto('/');
    await nav(page).getByRole('button', { name: /recordings/i }).click();
    await expect(page.getByText(/1 with a video file, 0 without/)).toBeVisible();
    await shot(page, info, 'R5-real-recordings');
    const [rows] = await db().execute('SELECT filename FROM recordings WHERE user_id = ?', [u.id]);
    const name = rows[0].filename;
    await page.getByRole('button', { name: new RegExp(`open ${name.replace('.', '\\.')}`, 'i') }).click();
    await expect(page.getByRole('dialog')).toContainText(name);
    await page.keyboard.press('Escape');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await expect(page.getByText(`${name} was deleted.`)).toBeVisible();
    const [after] = await db().execute('SELECT id FROM recordings WHERE user_id = ?', [u.id]);
    expect(after).toHaveLength(0);
  });
  test('schedules: creating one in the UI stores it in the database', async ({ page }) => {
    const u = await fresh('e2esch'); await consent(page); await sessionFor(page, u); await page.goto('/');
    await nav(page).getByRole('button', { name: /schedules/i }).click();
    await page.getByRole('button', { name: 'New schedule' }).first().click();
    await page.getByLabel('Schedule name').fill('E2E weekend');
    await page.getByRole('button', { name: 'Weekends' }).click();
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(page.getByRole('heading', { name: 'E2E weekend' })).toBeVisible();
    const [rows] = await db().execute('SELECT name, days_json, is_active FROM recording_schedules WHERE user_id = ?', [u.id]);
    expect(rows[0].name).toBe('E2E weekend');
    expect(JSON.parse(rows[0].days_json)).toEqual(['Sat', 'Sun']);
  });
  test('settings: "Send Test Notification" stores a real alert and confirms to the user', async ({ page }, info) => {
    const u = await fresh('e2enotif'); await consent(page); await sessionFor(page, u); await page.goto('/');
    await nav(page).getByRole('button', { name: /settings/i }).click();
    await page.getByRole('button', { name: /send test notification/i }).click();
    await expect(page.getByText(/test notification sent/i)).toBeVisible();
    const [rows] = await db().execute('SELECT message FROM alert_events WHERE user_id = ?', [u.id]);
    expect(rows.some((r) => /Security test alert/.test(r.message))).toBe(true);
    await shot(page, info, 'R6-real-test-notification');
  });
  test('activity zones page lists a zone created through the real API and deletes it via the UI', async ({ page }) => {
    const u = await fresh('e2ezone'); const token = mintToken(u);
    await api('/api/zones', { method: 'POST', token, body: { user_id: u.id, camera_id: 'mobile', name: 'Real zone', coordinates: SQUARE } });
    await consent(page); await sessionFor(page, u); await page.goto('/');
    await nav(page).getByRole('button', { name: /activity zones/i }).click();
    await expect(page.getByText('Real zone')).toBeVisible();
    await expect(page.getByText(/4 corners/)).toBeVisible();
    await page.getByRole('button', { name: 'Delete zone Real zone' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete zone', exact: true }).click();
    await expect(page.getByText('Real zone')).toHaveCount(0);
    const [rows] = await db().execute('SELECT id FROM activity_zones WHERE user_id = ?', [u.id]);
    expect(rows).toHaveLength(0);
  });
});

test.describe('REAL signalling + WebRTC with a SYNTHETIC camera (not a physical camera)', () => {
  test('a broadcaster page and a viewer page connect through the real Socket.IO server and the viewer receives video frames', async ({ browser }, info) => {
    test.setTimeout(90_000);
    const u = await fresh('e2ertc');
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ['camera', 'microphone'] });
    await ctx.addInitScript(([user, token]) => {
      localStorage.setItem('mycam_token', token);
      localStorage.setItem('mycam_user', JSON.stringify({ id: user.id, username: user.username, name: 'QA', email: user.email }));
      localStorage.setItem('mycam_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() }));
    }, [u, mintToken(u)]);
    const errors = [];
    const watch = (p) => p.on('pageerror', (e) => errors.push(e.message));
    const broadcaster = await ctx.newPage(); watch(broadcaster);
    await broadcaster.goto('/');
    await broadcaster.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: /^broadcast/i }).click();
    await expect(broadcaster.getByText(/Broadcasting \(/)).toBeVisible({ timeout: 20_000 });
    const viewer = await ctx.newPage(); watch(viewer);
    await viewer.goto('/');
    await expect(viewer.getByRole('button', { name: /Status: live/i }).first()).toBeVisible({ timeout: 40_000 });
    const frames = await viewer.waitForFunction(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0 && v.readyState >= 2 ? v.videoWidth : false; }, null, { timeout: 40_000 });
    expect(await frames.jsonValue()).toBeGreaterThan(0);
    await shot(viewer, info, 'R7-real-webrtc-viewer-synthetic-camera');
    await shot(broadcaster, info, 'R7-real-webrtc-broadcaster');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('recording from the live synthetic stream uses MediaRecorder and uploads a real file to the real backend', async ({ browser }, info) => {
    test.setTimeout(120_000);
    const u = await fresh('e2erecord');
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ['camera', 'microphone'] });
    await ctx.addInitScript(([user, token]) => {
      localStorage.setItem('mycam_token', token);
      localStorage.setItem('mycam_user', JSON.stringify({ id: user.id, username: user.username, name: 'QA', email: user.email }));
      localStorage.setItem('mycam_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() }));
    }, [u, mintToken(u)]);
    const broadcaster = await ctx.newPage();
    await broadcaster.goto('/');
    await broadcaster.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: /^broadcast/i }).click();
    await expect(broadcaster.getByText(/Broadcasting \(/)).toBeVisible({ timeout: 20_000 });
    const viewer = await ctx.newPage();
    await viewer.goto('/');
    const card = viewer.getByRole('button', { name: /Status: live/i }).first();
    await expect(card).toBeVisible({ timeout: 40_000 });
    await card.click();
    const modal = viewer.getByRole('dialog').or(viewer.locator('[aria-label^="Live View"]')).first();
    await expect(modal).toBeVisible();
    await viewer.getByRole('button', { name: /Record Stream/ }).click();
    await expect(viewer.getByText(/REC \d\d:\d\d/)).toBeVisible();
    await viewer.waitForTimeout(3500);
    await shot(viewer, info, 'R8-real-recording-in-progress');
    await viewer.getByRole('button', { name: /Stop Recording/ }).click();
    await expect.poll(async () => (await db().execute('SELECT COUNT(*) AS n FROM recordings WHERE user_id = ?', [u.id]))[0][0].n, { timeout: 30_000 }).toBe(1);
    const [rows] = await db().execute('SELECT camera_id, file_size_bytes, trigger_type FROM recordings WHERE user_id = ?', [u.id]);
    expect(rows[0].camera_id).toBe('mobile');
    expect(Number(rows[0].file_size_bytes)).toBeGreaterThan(1000);
    await ctx.close();
  });
});
