// In-browser mock of the myCam backend CONTRACT (shapes copied from server/routes.cjs).
// Nothing here proves the real server works; the real project and tests/real do that.
export const USER = { id: 7, username: 'rudy', name: 'Rudy Cam', email: 'rudy@example.com' };
export const PASSWORD = 'Secret#123';
export const VIDEO_BYTES = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(512).fill(0)]);

export const makeState = (over = {}) => ({
  cameras: [{ id: 'mobile', name: 'CAM-01 (Mobile Broadcaster)', source_label: 'Browser broadcaster', is_enabled: 1, created_at: '2026-01-01T00:00:00Z' }],
  recordings: [
    { id: 1, filename: 'garage_morning.webm', camera_id: 'mobile', duration: '02:15', file_size_bytes: 2097152, storage_target: 'local', trigger_type: 'manual', created_at: '2026-03-01T08:00:00Z' },
    { id: 2, filename: 'driveway_motion.webm', camera_id: 'mobile', duration: '00:30', file_size_bytes: 1048576, storage_target: 'local', trigger_type: 'motion', created_at: '2026-03-03T08:00:00Z' },
    { id: 3, filename: 'missing_file.webm', camera_id: 'mobile', duration: '01:00', file_size_bytes: 512, storage_target: 'local', trigger_type: 'scheduled', created_at: '2026-03-02T08:00:00Z' },
  ],
  schedules: [{ id: 1, user_id: 7, camera_id: 'mobile', name: 'Night watch', days_json: '["Mon","Tue","Wed","Thu","Fri"]', start_time: '22:00:00', end_time: '06:00:00', is_active: 1 }],
  zones: [{ id: 5, user_id: 7, camera_id: 'mobile', name: 'Driveway', coordinates_json: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.9 }], created_at: '2026-03-01T00:00:00Z' }],
  alerts: [
    { id: '1', type: 'motion', message: 'Motion detected on CAM-01', cameraId: 'mobile', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), isRead: false },
    { id: '2', type: 'activity', message: 'Security test alert', cameraId: 'system', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), isRead: true },
  ],
  prefs: { motionAlerts: true, dashboardToasts: true, browserNotifications: false },
  fail: {}, // e.g. { 'POST /api/login': { status: 502, body: '<html>Bad Gateway</html>', type: 'text/html' } }
  unmocked: [], calls: [], nextId: 100,
  ...over,
});

export async function mockBackend(page, state = makeState()) {
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/socket.io/**', (route) => route.fulfill({ status: 400, contentType: 'text/plain', body: 'signalling not available in mocked mode' }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const key = `${req.method()} ${p}`;
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { body = {}; }
    state.calls.push({ key, query: url.search, body });
    const forced = state.fail[key];
    if (forced) return route.fulfill({ status: forced.status, contentType: forced.type || 'application/json', body: typeof forced.body === 'string' ? forced.body : JSON.stringify(forced.body ?? { message: 'forced failure' }) });
    const m = req.method();
    const id = p.split('/').pop();

    if (key === 'POST /api/login') return body.username === USER.username && body.password === PASSWORD ? json(route, 200, { token: 'e2e.jwt.token', user: USER }) : json(route, 401, { message: 'Invalid credentials' });
    if (key === 'POST /api/register') return body.username === 'taken' ? json(route, 400, { message: 'Username or email already exists' }) : json(route, 201, { message: 'User registered successfully' });
    if (key === 'POST /api/forgot-password') return json(route, 200, { message: 'If an account exists, a reset link has been requested.' });
    if (key === 'POST /api/reset-password') return body.token === 'good-token' ? json(route, 200, { message: 'Password has been reset successfully' }) : json(route, 400, { message: 'Invalid or expired token' });
    if (key === 'PUT /api/user/profile') return json(route, 200, { message: 'Profile updated', user: { ...USER, name: body.name, email: body.email } });

    if (key === 'GET /api/cameras') return json(route, 200, state.cameras);
    if (key === 'POST /api/cameras') { const cam = { id: `cam-${state.nextId++}`, name: body.name, source_label: 'Browser broadcaster', is_enabled: 1 }; state.cameras.push(cam); return json(route, 201, cam); }
    if (m === 'DELETE' && p.startsWith('/api/cameras/')) { state.cameras = state.cameras.filter((c) => c.id !== decodeURIComponent(id)); return json(route, 200, { message: 'Camera removed' }); }

    if (key === 'GET /api/alerts') return json(route, 200, state.alerts);
    if (key === 'POST /api/alerts') { const a = { id: String(state.nextId++), type: body.type, message: body.message, cameraId: body.cameraId, timestamp: new Date().toISOString(), isRead: false }; state.alerts.unshift(a); return json(route, 201, a); }
    if (key === 'PATCH /api/alerts/read') { state.alerts.forEach((a) => { if ((body.ids || []).includes(a.id)) a.isRead = true; }); return json(route, 200, { message: 'Alerts marked as read' }); }
    if (key === 'DELETE /api/alerts') { state.alerts = []; return json(route, 200, { message: 'Alerts cleared' }); }
    if (key === 'GET /api/alert-preferences') return json(route, 200, state.prefs);
    if (key === 'PUT /api/alert-preferences') { state.prefs = { ...state.prefs, ...body }; return json(route, 200, state.prefs); }
    if (key === 'GET /api/rtc-config') return json(route, 200, { iceServers: [] });

    if (key === 'GET /api/recordings') return json(route, 200, state.recordings);
    if (key === 'GET /api/recordings/retention-preview') return json(route, 200, { candidates: [], total: 0, truncated: false });
    if (m === 'DELETE' && p.startsWith('/api/recordings/')) { state.recordings = state.recordings.filter((r) => String(r.id) !== id); return json(route, 200, { message: 'Recording deleted' }); }
    if (p.startsWith('/api/videos/')) return decodeURIComponent(id).startsWith('missing_file') ? route.fulfill({ status: 404, body: 'gone' }) : route.fulfill({ status: 200, contentType: 'video/webm', body: VIDEO_BYTES });

    if (key === 'GET /api/zones') return json(route, 200, state.zones);
    if (key === 'POST /api/zones') { state.zones.push({ id: state.nextId++, user_id: 7, camera_id: body.camera_id, name: body.name, coordinates_json: body.coordinates }); return json(route, 201, { message: 'Zone created' }); }
    if (m === 'DELETE' && p.startsWith('/api/zones/')) { state.zones = state.zones.filter((z) => String(z.id) !== id); return json(route, 200, { message: 'Zone deleted' }); }

    if (key === 'GET /api/schedules') return json(route, 200, state.schedules);
    if (key === 'POST /api/schedules') { state.schedules.push({ id: state.nextId++, user_id: 7, camera_id: body.camera_id, name: body.name, days_json: JSON.stringify(body.days), start_time: `${body.start_time}:00`, end_time: `${body.end_time}:00`, is_active: 1 }); return json(route, 201, { message: 'Schedule created' }); }
    if (m === 'PUT' && p.startsWith('/api/schedules/')) { const s = state.schedules.find((x) => String(x.id) === id); if (s && 'is_active' in body) s.is_active = body.is_active ? 1 : 0; if (s && body.name) Object.assign(s, { name: body.name }); return json(route, 200, { message: 'Schedule updated' }); }
    if (m === 'DELETE' && p.startsWith('/api/schedules/')) { state.schedules = state.schedules.filter((x) => String(x.id) !== id); return json(route, 200, { message: 'Schedule deleted' }); }

    if (key === 'GET /api/storage/provider-status') return json(route, 200, { provider: 's3-compatible', configured: false, connected: false, message: 'Cloud storage is not configured; local storage remains available.' });
    if (key === 'GET /api/storage/status') return json(route, 200, {
      config: { mode: 'local', local_target: 'both_failover', internal_quota_mb: 1200, sdcard_quota_mb: 3000, cloud_quota_mb: 5000 },
      used_mb: { internal: 3, sdcard: 0, cloud: 0 }, usage: { internal: { used_bytes: 3145728, quota_bytes: 1258291200, percent: 0, alert: { level: 'ok' } } }, active_target: 'internal',
    });
    if (key === 'GET /api/storage/upload-diagnostics') return json(route, 200, { generated_at: new Date().toISOString(), stale_processing_after_minutes: 15, uploads: {}, recent: [], reservations: {} });
    if (key === 'GET /api/storage/config') return json(route, 200, { mode: 'local' });
    if (key === 'POST /api/storage/config') return json(route, 200, { message: 'Storage configuration saved' });

    state.unmocked.push(key);
    return json(route, 404, { message: `unmocked in E2E: ${key}` });
  });
  return state;
}

export async function signInSession(page, user = USER) {
  await page.addInitScript(([u]) => { localStorage.setItem('mycam_token', 'e2e.jwt.token'); localStorage.setItem('mycam_user', JSON.stringify(u)); localStorage.setItem('mycam_cookie_consent', JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() })); }, [user]);
}
