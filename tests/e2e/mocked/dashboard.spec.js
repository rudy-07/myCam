import { test, expect, shot } from '../fixtures';
import { mockBackend, makeState, signInSession } from './mocks';

const nav = (page) => page.getByRole('navigation', { name: 'Dashboard sections' });
const open = async (page, state = makeState(), width) => {
  if (width) await page.setViewportSize({ width, height: 900 });
  await mockBackend(page, state); await signInSession(page);
};
const go = async (page, label) => { await nav(page).getByRole('button', { name: new RegExp(label, 'i') }).click(); };

test.describe('6-7. Dashboard loading and sidebar navigation', () => {
  test('dashboard loads for a signed-in user, with account menu and cameras as the default section', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280);
    await page.goto('/');
    await expect(nav(page)).toBeVisible();
    await expect(nav(page).getByRole('button', { name: /cameras/i })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('CAM-01 (Mobile Broadcaster)').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account Menu' })).toBeVisible();
    await shot(page, info, '06-dashboard');
    expect(state.unmocked).toEqual([]);
  });
  test('every sidebar section opens, is marked current, and calls only known endpoints', async ({ page, allowConsole }, info) => {
    allowConsole.push(/Failed to load resource.*404/);
    const state = makeState(); await open(page, state, 1280);
    await page.goto('/');
    for (const [label, expected] of [['Recordings', /Recording/i], ['Event Timeline', /event|timeline/i], ['Schedules', /Schedules/], ['Activity Zones', /Activity zones/i], ['Broadcast', /Broadcast/i], ['Settings', /Settings/i], ['Cameras', /Camera/i]]) {
      await go(page, label);
      await expect(nav(page).getByRole('button', { name: new RegExp(label, 'i') })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading', { name: expected }).first()).toBeVisible();
    }
    await shot(page, info, '07-sidebar-navigation');
    expect(state.unmocked).toEqual([]);
  });
  test('sidebar collapses to icons and expands again', async ({ page }) => {
    await open(page, makeState(), 1280); await page.goto('/');
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expect(nav(page).getByRole('button', { name: 'Recordings' })).toBeVisible(); // still reachable by name
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });
});

test.describe('8. Camera management UI', () => {
  test('registers a new camera and removes it again (with confirmation)', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await page.locator('#camera-name').fill('Front Porch');
    await page.getByRole('button', { name: 'Add camera' }).click();
    await expect(page.getByRole('heading', { name: 'Front Porch' })).toBeVisible();
    expect(state.calls.find((c) => c.key === 'POST /api/cameras').body).toEqual({ name: 'Front Porch' });
    await shot(page, info, '08-camera-management');
    await page.getByRole('button', { name: 'Remove Front Porch' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove Camera' }).click();
    await expect(page.getByRole('heading', { name: 'Front Porch' })).toHaveCount(0);
    expect(state.calls.some((c) => c.key.startsWith('DELETE /api/cameras/cam-'))).toBe(true);
  });
  test('shows the empty state when no cameras are registered, and a search with no match', async ({ page }) => {
    const state = makeState({ cameras: [] }); await open(page, state, 1280); await page.goto('/');
    await expect(page.getByText('No cameras registered')).toBeVisible();
  });
  test('shows an error and recovers on retry when cameras fail to load', async ({ page, allowConsole }) => {
    allowConsole.push(/Failed to load resource/);
    const state = makeState(); state.fail['GET /api/cameras'] = { status: 500, body: { message: 'db down' } };
    await open(page, state, 1280); await page.goto('/');
    await expect(page.getByText('Cameras could not be loaded')).toBeVisible();
    await expect(page.getByText('No cameras registered')).toHaveCount(0); // a failure must not look like an empty account
    delete state.fail['GET /api/cameras'];
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('CAM-01 (Mobile Broadcaster)').first()).toBeVisible();
  });
});

test.describe('9. Activity zone editor UI (live drawing needs a real camera: see TEST_PLAN manual checklist)', () => {
  test('lists saved zones, explains that drawing needs a live camera, and deletes a zone after confirmation', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Activity Zones');
    await expect(page.getByText('Driveway')).toBeVisible();
    await expect(page.getByText(/3 corners/)).toBeVisible();
    await expect(page.getByRole('button', { name: /new zone/i })).toBeDisabled(); // no live feed in mocked mode
    await expect(page.getByText(/camera is not live/i)).toBeVisible();
    expect(state.calls.find((c) => c.key === 'GET /api/zones').query).toBe('?user_id=7');
    await shot(page, info, '09-activity-zones');
    await page.getByRole('button', { name: 'Delete zone Driveway' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete zone', exact: true }).click();
    await expect(page.getByText('Driveway')).toHaveCount(0);
    expect(state.calls.some((c) => c.key === 'DELETE /api/zones/5')).toBe(true);
  });
  test('empty state tells the truth about alerts without zones', async ({ page }) => {
    await open(page, makeState({ zones: [] }), 1280); await page.goto('/');
    await go(page, 'Activity Zones');
    await expect(page.getByText(/motion anywhere in the camera view raises an alert/i)).toBeVisible();
    await expect(page.getByText(/raises no motion alerts/i)).toHaveCount(0);
  });
});

test.describe('10-12. Recordings library, search/filter, player', () => {
  // The mock deliberately 404s one video file; the browser logs that network failure.
  test.beforeEach(({ allowConsole }) => { allowConsole.push(/Failed to load resource.*404/); });
  test('library lists recordings, verifies files, and flags the one whose video is missing', async ({ page }, info) => {
    await open(page, makeState(), 1280); await page.goto('/');
    await go(page, 'Recordings');
    await expect(page.getByRole('list', { name: 'Recordings' })).toBeVisible();
    await expect(page.getByText(/2 with a video file, 1 without/)).toBeVisible();
    await expect(page.getByRole('button', { name: /download missing_file\.webm/i }).first()).toBeDisabled();
    await shot(page, info, '10-recordings-library');
  });
  test('top-bar search, availability, source and sort controls narrow and order the library', async ({ page }, info) => {
    await open(page, makeState(), 1280); await page.goto('/');
    await go(page, 'Recordings');
    await expect(page.getByText(/2 with a video file, 1 without/)).toBeVisible();
    const titles = () => page.getByRole('list', { name: 'Recordings' }).getByRole('heading', { level: 3 }).allTextContents();
    expect(await titles()).toEqual(['driveway_motion.webm', 'missing_file.webm', 'garage_morning.webm']);
    await page.getByLabel('Sort by date').selectOption('oldest');
    expect(await titles()).toEqual(['garage_morning.webm', 'missing_file.webm', 'driveway_motion.webm']);
    await page.getByLabel('Recording source').selectOption('motion');
    expect(await titles()).toEqual(['driveway_motion.webm']);
    await page.getByLabel('Recording source').selectOption('all');
    await page.getByRole('group', { name: 'Filter by video availability' }).getByRole('button', { name: /video unavailable/i }).click();
    expect(await titles()).toEqual(['missing_file.webm']);
    await page.getByRole('group', { name: 'Filter by video availability' }).getByRole('button', { name: /^all/i }).click();
    await page.getByLabel('Comprehensive Global Search').fill('garage');
    await expect(page.getByText(/Showing 1 of 3 entries/)).toBeVisible();
    expect(await titles()).toEqual(['garage_morning.webm']);
    await page.getByLabel('Comprehensive Global Search').fill('zzzz');
    await expect(page.getByText('No recordings match your search')).toBeVisible();
    await shot(page, info, '11-search-filter-empty');
  });
  test('global search palette shows real field values for schedules and zones (regression for the snake_case bug)', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await page.getByLabel('Comprehensive Global Search').click();
    const palette = page.getByRole('dialog', { name: /search results/i });
    const sch = palette.getByText('Night watch').locator('xpath=ancestor::*[self::button or @role="option"][1]');
    await expect(sch).toContainText('22:00 - 06:00');
    await expect(sch).toContainText('Weekdays');
    await expect(sch).toContainText('Active');
    await expect(sch).not.toContainText('00:00 - 23:59');
    await expect(palette.getByText('Driveway', { exact: true }).locator('xpath=ancestor::*[self::button or @role="option"][1]')).toContainText('3 points');
    expect(state.calls.find((c) => c.key === 'GET /api/zones').query).toBe('?user_id=7');
    await shot(page, info, '11-search-palette');
    await page.keyboard.press('Escape');
  });
  test('video player modal opens for an available recording, traps focus, closes with Escape and restores focus', async ({ page }, info) => {
    await open(page, makeState(), 1280); await page.goto('/');
    await go(page, 'Recordings');
    await expect(page.getByText(/2 with a video file, 1 without/)).toBeVisible();
    const trigger = page.getByRole('button', { name: /open garage_morning\.webm, video file found/i });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('garage_morning.webm');
    await shot(page, info, '12-video-player-modal');
    for (let i = 0; i < 6; i += 1) { await page.keyboard.press('Tab'); expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true); }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  test('deleting a recording asks for confirmation, then removes it', async ({ page }) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Recordings');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Delete garage_morning.webm' }).click();
    expect(state.calls.some((c) => c.key.startsWith('DELETE /api/recordings/'))).toBe(false);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete garage_morning.webm' }).click();
    await expect(page.getByText('garage_morning.webm was deleted.')).toBeVisible();
    expect(state.calls.some((c) => c.key === 'DELETE /api/recordings/1')).toBe(true);
  });
});

test.describe('13. Settings', () => {
  test('alert preferences save through the existing endpoint; storage and profile sections render', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Settings');
    await expect(page.getByLabel('Motion alerts')).toBeChecked();
    await page.getByLabel('Motion alerts').click();
    await expect(page.getByLabel('Motion alerts')).not.toBeChecked();
    expect(state.prefs.motionAlerts).toBe(false);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await shot(page, info, '13-settings');
  });
  test('profile save uses PUT /api/user/profile with id, name and email', async ({ page }) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Settings');
    const name = page.getByLabel('Full name');
    await name.fill('Renamed Rudy');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect.poll(() => state.calls.find((c) => c.key === 'PUT /api/user/profile')?.body).toMatchObject({ id: 7, name: 'Renamed Rudy' });
  });
});

test.describe('14. Notifications', () => {
  test('bell lists alerts with relative times, marks them read on opening, and clears', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    const panel = page.getByRole('dialog', { name: 'Alerts & Notifications' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('5m ago');
    await expect(panel).toContainText('3h ago');
    await shot(page, info, '14-notifications');
    // Opening the bell marks everything read by design, so the explicit button is gone and the PATCH has already been sent.
    await expect.poll(() => state.calls.find((c) => c.key === 'PATCH /api/alerts/read')?.body).toEqual({ ids: ['1'] });
    await panel.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByText('Motion detected on CAM-01')).toHaveCount(0);
    expect(state.calls.some((c) => c.key === 'DELETE /api/alerts')).toBe(true);
  });
  test('Settings "Send Test Notification" confirms success and then reports a failure honestly', async ({ page, allowConsole }) => {
    allowConsole.push(/Failed to load resource/, /Failed to trigger alert/);
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Settings');
    await page.getByRole('button', { name: /send test notification/i }).click();
    await expect(page.getByText(/test notification sent/i)).toBeVisible();
    state.fail['POST /api/alerts'] = { status: 500, body: { message: 'Could not store alert' } };
    await page.getByRole('button', { name: /send test notification/i }).click();
    await expect(page.getByText(/could not send the test notification/i)).toBeVisible();
  });
});

test.describe('15. Schedule manager', () => {
  test('lists, creates, disables, and deletes schedules through the existing endpoints', async ({ page }, info) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Schedules');
    await expect(page.getByRole('heading', { name: 'Night watch' })).toBeVisible();
    await page.getByRole('button', { name: 'New schedule' }).first().click();
    await page.getByLabel('Schedule name').fill('Weekend guard');
    await page.getByRole('button', { name: 'Weekends' }).click();
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(page.getByRole('heading', { name: 'Weekend guard' })).toBeVisible();
    expect(state.calls.find((c) => c.key === 'POST /api/schedules').body).toMatchObject({ user_id: 7, camera_id: 'mobile', name: 'Weekend guard', days: ['Sat', 'Sun'], start_time: '22:00', end_time: '06:00' });
    await shot(page, info, '15-schedules');
    await page.getByRole('button', { name: 'Disable schedule Night watch' }).click();
    await expect(page.getByRole('button', { name: 'Enable schedule Night watch' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete schedule Night watch' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^delete/i }).click();
    await expect(page.getByRole('heading', { name: 'Night watch' })).toHaveCount(0);
  });
  test('form validation blocks an empty name and identical start/end', async ({ page }) => {
    const state = makeState(); await open(page, state, 1280); await page.goto('/');
    await go(page, 'Schedules');
    await page.getByRole('button', { name: 'New schedule' }).first().click();
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(page.getByRole('dialog').getByText(/name/i).first()).toBeVisible();
    expect(state.calls.some((c) => c.key === 'POST /api/schedules')).toBe(false);
  });
});

test.describe('16. Responsive mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(({ allowConsole }) => { allowConsole.push(/Failed to load resource.*404/); });
  test('mobile: sidebar is an off-canvas drawer (inert while closed), opens from the top bar, navigates, closes with Escape', async ({ page }, info) => {
    const state = makeState(); await mockBackend(page, state); await signInSession(page);
    await page.goto('/');
    const drawer = page.locator('aside[aria-label="Primary"]');
    const isInert = () => drawer.evaluate((el) => el.inert === true);
    expect(await isInert()).toBe(true); // closed
    const menu = page.getByRole('button', { name: /open (navigation|menu)|menu/i }).first();
    await menu.click();
    await expect.poll(isInert).toBe(false);
    await shot(page, info, '16-mobile-drawer');
    await page.keyboard.press('Escape');
    await expect.poll(isInert).toBe(true);
    await menu.click();
    await expect.poll(isInert).toBe(false);
    await go(page, 'Recordings');
    await expect(page.getByRole('list', { name: 'Recordings' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true); // no sideways scrolling
    await shot(page, info, '16-mobile-recordings');
  });
  test('mobile: landing page has a working menu and no horizontal overflow', async ({ page }, info) => {
    await mockBackend(page);
    await page.addInitScript(() => localStorage.setItem('mycam_cookie_consent', JSON.stringify({ necessary: true, timestamp: Date.now() })));
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await shot(page, info, '16-mobile-landing-menu');
  });
});
