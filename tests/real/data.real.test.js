import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, closeDb, seedUser, removeUsers, mintToken, backendReachable } from './helpers';
import { buildCameraNameMap, describeCamera, describeRecording, describeSchedule, describeZone } from '../../src/lib/searchResults';
import { parseCoordinates, validateDraft } from '../../src/lib/zones';
import { isWindowOpenNow, parseDays, toHHMM } from '../../src/lib/schedule';
import { getRecordingUrl, formatDuration, formatFileSize, sortRecordings } from '../../src/lib/recordingMedia';

const users = []; let A; let B; let ta; let tb;
beforeAll(async () => {
  if (!(await backendReachable())) throw new Error('Real backend is not reachable on :3000 - see TEST_PLAN.md');
  B = await seedUser('dataB'); A = await seedUser('dataA'); users.push(A, B); // A is seeded last so it owns the 'mobile' camera (see helpers.seedUser)
  ta = mintToken(A); tb = mintToken(B);
});
afterAll(async () => { await removeUsers(users); await closeDb(); });

const SQUARE = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];
// Smallest valid WebM-like payload; the backend filters on MIME type only.
const webmForm = (extra = {}) => {
  const f = new FormData();
  f.append('camera_id', 'mobile'); f.append('duration', '00:07'); f.append('trigger_type', extra.trigger || 'manual');
  f.append('video', new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(2048).fill(7)])], { type: 'video/webm' }), extra.name || `recording-${Date.now()}.webm`);
  return f;
};

describe('REAL backend - cameras', () => {
  it('returns the default mobile camera with the fields the UI relies on (and no online flag)', async () => {
    const r = await api('/api/cameras', { token: ta });
    expect(r.status).toBe(200);
    const cam = r.json.find((c) => c.id === 'mobile');
    expect(cam).toMatchObject({ id: 'mobile', name: expect.any(String) });
    expect(Object.keys(cam)).toEqual(expect.arrayContaining(['id', 'name', 'source_label', 'is_enabled']));
    expect(Object.keys(cam)).not.toContain('isOnline'); // the field SearchPalette used to read does not exist
    expect(describeCamera(cam).badge).toBe('Enabled');
  });
});

describe('REAL backend - activity zones', () => {
  it('ROOT CAUSE of the fixed SearchPalette bug: GET /api/zones without user_id is a 400', async () => {
    const r = await api('/api/zones', { token: ta });
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/user id/i);
  });
  it('rejects another user\'s id with 403 and unauthenticated calls with 401', async () => {
    expect((await api(`/api/zones?user_id=${B.id}`, { token: ta })).status).toBe(403);
    expect((await api(`/api/zones?user_id=${A.id}`)).status).toBe(401);
  });
  it('creates, lists (coordinates_json), maps through the UI helpers, and deletes a zone using the exact frontend contract', async () => {
    expect(validateDraft({ name: 'Driveway', points: SQUARE })).toEqual({});
    const create = await api('/api/zones', { method: 'POST', token: ta, body: { user_id: A.id, camera_id: 'mobile', name: 'Driveway', coordinates: SQUARE } });
    expect(create.status).toBe(201);
    const list = await api(`/api/zones?user_id=${A.id}`, { token: ta });
    expect(list.status).toBe(200);
    const zone = list.json.find((z) => z.name === 'Driveway');
    expect(zone).toBeTruthy();
    expect(Object.keys(zone)).toContain('coordinates_json'); // column name, not "coordinates"
    expect(parseCoordinates(zone.coordinates_json)).toEqual(SQUARE); // works whether the driver parses JSON or not
    const names = buildCameraNameMap((await api('/api/cameras', { token: ta })).json);
    expect(describeZone(zone, names)).toMatchObject({ title: 'Driveway', badge: '4 points', camera: 'CAM-01 (Mobile Broadcaster)' });
    expect((await api(`/api/zones/${zone.id}`, { method: 'DELETE', token: ta })).status).toBe(200);
    expect((await api(`/api/zones?user_id=${A.id}`, { token: ta })).json.find((z) => z.id === zone.id)).toBeUndefined();
  });
  it('isolates zones between accounts (B cannot see or delete A\'s zone)', async () => {
    const c = await api('/api/zones', { method: 'POST', token: ta, body: { user_id: A.id, camera_id: 'mobile', name: 'Private', coordinates: SQUARE } });
    expect(c.status).toBe(201);
    const aZone = (await api(`/api/zones?user_id=${A.id}`, { token: ta })).json.find((z) => z.name === 'Private');
    expect((await api(`/api/zones?user_id=${B.id}`, { token: tb })).json.find((z) => z.name === 'Private')).toBeUndefined();
    // BK-01 (backend, not fixable here): the route answers 200 "Zone deleted" even when it deleted nothing. The data stays safe:
    const del = await api(`/api/zones/${aZone.id}`, { method: 'DELETE', token: tb });
    expect(del.status).toBe(200);
    expect((await api(`/api/zones?user_id=${A.id}`, { token: ta })).json.some((z) => z.id === aZone.id)).toBe(true);
    await api(`/api/zones/${aZone.id}`, { method: 'DELETE', token: ta });
  });
  it('requires camera, name and coordinates', async () => {
    expect((await api('/api/zones', { method: 'POST', token: ta, body: { user_id: A.id, name: 'x' } })).status).toBe(400);
  });
});

describe('REAL backend - schedules (and the SearchPalette mapping with real rows)', () => {
  it('creates, lists, toggles, edits and deletes with the exact frontend contract', async () => {
    const body = { user_id: A.id, camera_id: 'mobile', name: 'Night watch', days: ['Mon', 'Tue'], start_time: '22:00', end_time: '06:00' };
    expect((await api('/api/schedules', { method: 'POST', token: ta, body })).status).toBe(201);
    let rows = (await api(`/api/schedules?user_id=${A.id}`, { token: ta })).json;
    const sch = rows.find((s) => s.name === 'Night watch');
    expect(Object.keys(sch)).toEqual(expect.arrayContaining(['days_json', 'start_time', 'end_time', 'is_active']));
    expect(parseDays(sch.days_json).days).toEqual(['Mon', 'Tue']);
    expect(toHHMM(sch.start_time)).toBe('22:00');
    const names = buildCameraNameMap((await api('/api/cameras', { token: ta })).json);
    // This is the data SearchPalette used to render as "00:00 - 23:59 (Weekly) / Active":
    expect(describeSchedule(sch, names)).toMatchObject({ subtitle: 'Schedules · 22:00 - 06:00 (Mon, Tue)', badge: 'Active' });
    expect((await api(`/api/schedules/${sch.id}`, { method: 'PUT', token: ta, body: { is_active: false } })).status).toBe(200);
    rows = (await api(`/api/schedules?user_id=${A.id}`, { token: ta })).json;
    const off = rows.find((s) => s.id === sch.id);
    expect(describeSchedule(off, names).badge).toBe('Disabled');
    expect(isWindowOpenNow(off, new Date(2026, 10, 2, 23, 0))).toBe(false); // disabled never opens
    expect((await api(`/api/schedules/${sch.id}`, { method: 'PUT', token: ta, body: { name: 'Late watch', days: ['Wed'], start_time: '01:00', end_time: '02:00' } })).status).toBe(200);
    expect((await api(`/api/schedules?user_id=${A.id}`, { token: ta })).json.find((s) => s.id === sch.id)).toMatchObject({ name: 'Late watch' });
    expect((await api(`/api/schedules/${sch.id}`, { method: 'DELETE', token: ta })).status).toBe(200);
  });
  it('does not let another account change or delete the schedule (data stays intact)', async () => {
    await api('/api/schedules', { method: 'POST', token: ta, body: { user_id: A.id, camera_id: 'mobile', name: 'Mine', days: ['Mon'], start_time: '09:00', end_time: '10:00' } });
    const mine = (await api(`/api/schedules?user_id=${A.id}`, { token: ta })).json.find((s) => s.name === 'Mine');
    expect((await api(`/api/schedules/${mine.id}`, { method: 'DELETE', token: tb })).status).toBe(200); // BK-01: misleading success, nothing deleted
    expect((await api(`/api/schedules/${mine.id}`, { method: 'PUT', token: tb, body: { is_active: false } })).status).toBe(404);
    expect((await api(`/api/schedules?user_id=${A.id}`, { token: ta })).json.some((s) => s.id === mine.id)).toBe(true);
    await api(`/api/schedules/${mine.id}`, { method: 'DELETE', token: ta });
  });
});

describe('REAL backend - recordings (upload, list, stream, delete)', () => {
  it('uploads a recording with the frontend\'s multipart contract, lists it, streams it and deletes it', async () => {
    const up = await api('/api/recordings', { method: 'POST', token: ta, form: webmForm({ trigger: 'motion' }), headers: { 'Idempotency-Key': `qa-${Date.now()}-key` } });
    expect(up.status).toBeLessThan(300);
    const list = await api(`/api/recordings?user_id=${A.id}`, { token: ta });
    expect(list.status).toBe(200);
    const rec = list.json[0];
    expect(Object.keys(rec)).toEqual(expect.arrayContaining(['id', 'filename', 'camera_id', 'duration', 'file_size_bytes', 'trigger_type', 'created_at']));
    expect(rec).toMatchObject({ camera_id: 'mobile', duration: '00:07', trigger_type: 'motion' });
    expect(formatDuration(rec.duration)).toBe('00:07');
    expect(formatFileSize(rec.file_size_bytes)).toMatch(/KB|B$/);
    const names = buildCameraNameMap((await api('/api/cameras', { token: ta })).json);
    expect(describeRecording(rec, names)).toMatchObject({ badge: '00:07', camera: 'CAM-01 (Mobile Broadcaster)' });
    const video = await api(getRecordingUrl(rec), { token: ta });
    expect(video.status).toBe(200);
    expect(video.headers.get('content-type')).toMatch(/video\//);
    expect((await api(getRecordingUrl(rec))).status).toBe(401); // not public
    expect((await api(getRecordingUrl(rec), { token: tb })).ok).toBe(false); // not another user's
    expect((await api(`/api/recordings/${rec.id}`, { method: 'DELETE', token: tb })).ok).toBe(false);
    expect((await api(`/api/recordings/${rec.id}`, { method: 'DELETE', token: ta })).status).toBe(200);
    expect((await api(`/api/recordings?user_id=${A.id}`, { token: ta })).json.some((r) => r.id === rec.id)).toBe(false);
    expect((await api(getRecordingUrl(rec), { token: ta })).ok).toBe(false); // file really removed
  });
  it('is idempotent: retrying with the same Idempotency-Key does not create a second recording', async () => {
    const key = `qa-${Date.now()}-idem`;
    const first = await api('/api/recordings', { method: 'POST', token: ta, form: webmForm(), headers: { 'Idempotency-Key': key } });
    const second = await api('/api/recordings', { method: 'POST', token: ta, form: webmForm(), headers: { 'Idempotency-Key': key } });
    expect(first.status).toBeLessThan(300);
    expect(second.status).toBe(200);
    expect(second.headers.get('idempotency-replayed')).toBe('true');
    const mine = (await api(`/api/recordings?user_id=${A.id}`, { token: ta })).json;
    expect(mine).toHaveLength(1);
    await api(`/api/recordings/${mine[0].id}`, { method: 'DELETE', token: ta });
  });
  it.each([
    ['a non-video file type', () => { const f = new FormData(); f.append('camera_id', 'mobile'); f.append('video', new Blob(['hello'], { type: 'text/plain' }), 'x.txt'); return f; }, 400],
    ['a missing file', () => { const f = new FormData(); f.append('camera_id', 'mobile'); return f; }, 400],
    ['an invalid trigger_type', () => { const f = webmForm(); f.set('trigger_type', 'bogus'); return f; }, 400],
  ])('rejects %s', async (_l, make, status) => {
    expect((await api('/api/recordings', { method: 'POST', token: ta, form: make() })).status).toBe(status);
  });
  it('rejects unauthenticated uploads', async () => expect((await api('/api/recordings', { method: 'POST', form: webmForm() })).status).toBe(401));
  it('lists in a shape sortRecordings can order (newest first)', async () => {
    await api('/api/recordings', { method: 'POST', token: ta, form: webmForm({ name: 'one.webm' }) });
    await new Promise((r) => setTimeout(r, 1100));
    await api('/api/recordings', { method: 'POST', token: ta, form: webmForm({ name: 'two.webm' }) });
    const list = (await api(`/api/recordings?user_id=${A.id}`, { token: ta })).json;
    expect(list.length).toBeGreaterThanOrEqual(2);
    const sorted = sortRecordings(list, true).map((r) => r.id);
    expect(sorted[0]).toBe(Math.max(...list.map((r) => r.id)));
    for (const r of list) await api(`/api/recordings/${r.id}`, { method: 'DELETE', token: ta });
  });
});

describe('REAL backend - alerts used by the Settings "Send Test Notification" button', () => {
  it('stores and returns the test alert with the exact frontend payload', async () => {
    const r = await api('/api/alerts', { method: 'POST', token: ta, body: { type: 'activity', message: 'Security test alert: myCam alert notification system is operational!', cameraId: 'system' } });
    expect(r.status).toBeLessThan(300);
    expect(r.json).toMatchObject({ type: 'activity', cameraId: 'system' }); // truthy => the new Settings code shows success
    const list = (await api('/api/alerts', { token: ta })).json;
    expect(list.some((a) => a.message.startsWith('Security test alert'))).toBe(true);
    await api('/api/alerts', { method: 'DELETE', token: ta });
  });
  it('marks alerts as read with the exact PATCH contract the notification bell uses', async () => {
    const created = await api('/api/alerts', { method: 'POST', token: ta, body: { type: 'activity', message: 'read-me', cameraId: 'system' } });
    const id = String(created.json.id);
    const r = await api('/api/alerts/read', { method: 'PATCH', token: ta, body: { ids: [id] } });
    expect(r.status).toBe(200);
    const mine = (await api('/api/alerts', { token: ta })).json.find((a) => String(a.id) === id);
    expect(mine.isRead).toBeTruthy();
    expect((await api('/api/alerts/read', { method: 'PATCH', body: { ids: [id] } })).status).toBe(401);
    await api('/api/alerts', { method: 'DELETE', token: ta });
  });
  it('round-trips alert preferences', async () => {
    const prefs = { motionAlerts: false, dashboardToasts: true, browserNotifications: false };
    expect((await api('/api/alert-preferences', { method: 'PUT', token: ta, body: prefs })).status).toBe(200);
    expect((await api('/api/alert-preferences', { token: ta })).json).toMatchObject(prefs);
  });
});
