import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { api, db, closeDb, seedUser, removeUsers, login, uid, backendReachable, mintToken } from './helpers';
import { validateRegistration, generateStrongPassword } from '../../src/lib/authRequest';

const created = [];
let reachable = false;
beforeAll(async () => {
  reachable = await backendReachable();
  if (!reachable) throw new Error('Real backend is not reachable on :3000 - see TEST_PLAN.md');
  await db().execute("DELETE FROM camera_devices WHERE id = 'mobile'"); // throwaway test DB: start from a clean slate for the default-camera tests
});
afterAll(async () => { await removeUsers(created); await closeDb(); });

describe('REAL backend - registration (frontend validation must agree with the server)', () => {
  it('accepts a frontend-valid registration and creates the default camera', async () => {
    const tag = `reg_${uid()}`;
    const body = { name: 'Reg Test', username: tag, email: `${tag}@example.test`, password: generateStrongPassword(16) };
    expect(validateRegistration(body)).toBe('');
    const r = await api('/api/register', { method: 'POST', body });
    expect(r.status).toBe(201);
    const [rows] = await db().execute('SELECT id FROM users WHERE username = ?', [tag]);
    created.push({ id: rows[0].id, email: body.email });
    const [cams] = await db().execute('SELECT id FROM camera_devices WHERE user_id = ?', [rows[0].id]);
    expect(cams.map((c) => c.id)).toContain('mobile');
    const stored = (await db().execute('SELECT password FROM users WHERE id = ?', [rows[0].id]))[0][0].password;
    expect(stored).not.toContain(body.password); // never stored in plain text
    expect(stored.startsWith('scrypt')).toBe(true);
  });
  it('KNOWN BACKEND ISSUE BK-02 (not fixable here): only the FIRST account ever gets the default "mobile" camera', async () => {
    // camera_devices.id is the only primary key and registration uses INSERT IGNORE, so a second real registration gets no camera.
    const tag = `bk2_${uid()}`;
    const body = { name: 'BK2', username: tag, email: `${tag}@example.test`, password: generateStrongPassword(16) };
    expect((await api('/api/register', { method: 'POST', body })).status).toBe(201);
    const [rows] = await db().execute('SELECT id FROM users WHERE username = ?', [tag]);
    created.push({ id: rows[0].id, email: body.email });
    const second = await api('/api/cameras', { token: mintToken({ id: rows[0].id }) });
    expect(second.status).toBe(200);
    expect(second.json).toEqual([]); // the second account has no camera at all
    const [owners] = await db().execute("SELECT user_id FROM camera_devices WHERE id = 'mobile'");
    expect(owners).toHaveLength(1); // exactly one owner exists, and it is not this account
    expect(owners[0].user_id).not.toBe(rows[0].id);
  });
  it.each([
    ['no uppercase', 'str0ng!pass'], ['no special character', 'Str0ngPass1'],
  ])('server and frontend both reject a password with %s', async (_l, pw) => {
    const body = { name: 'X', username: `rej_${uid()}`, email: `rej_${uid()}@example.test`, password: pw };
    expect(validateRegistration(body)).not.toBe('');
    const r = await api('/api/register', { method: 'POST', body });
    expect(r.status).toBe(400);
    expect(r.json.message).toBeTruthy();
  });
  it('rejects a duplicate username/email', async () => {
    const u = await seedUser('dup'); created.push(u);
    const r = await api('/api/register', { method: 'POST', body: { name: 'D', username: u.username, email: `other_${uid()}@example.test`, password: generateStrongPassword(16) } });
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/already exists/i);
  });
});

describe('REAL backend - login', () => {
  let user;
  beforeAll(async () => { user = await seedUser('login'); created.push(user); });
  it('returns a token and user for correct credentials, without the password hash', async () => {
    const r = await api('/api/login', { method: 'POST', body: { username: user.username, password: user.password } });
    expect(r.status).toBe(200);
    expect(r.json.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(r.json.user).toMatchObject({ id: user.id, username: user.username });
    expect(JSON.stringify(r.json)).not.toMatch(/scrypt|\$/);
  });
  it('rejects a wrong password with 401 and a JSON message', async () => {
    const r = await api('/api/login', { method: 'POST', body: { username: user.username, password: 'Wrong!Pass1' } });
    expect(r.status).toBe(401);
    expect(r.json.message).toBeTruthy();
  });
  it('rejects empty fields with 400', async () => {
    expect((await api('/api/login', { method: 'POST', body: { username: '', password: '' } })).status).toBe(400);
  });
  it('DOCUMENTED CREDENTIALS DO NOT WORK: TESTING_GUIDE says rudy / password', async () => {
    const r = await api('/api/login', { method: 'POST', body: { username: 'rudy', password: 'password' } });
    expect(r.status).toBe(401); // no such account is seeded by this repository
    // ...and "password" can never be registered: the policy (mirrored by the frontend) rejects it.
    expect(validateRegistration({ name: 'R', username: 'rudy', email: 'rudy@example.test', password: 'password' })).not.toBe('');
  });
  it('protected endpoints return 401 without a token and with a forged token', async () => {
    expect((await api('/api/cameras')).status).toBe(401);
    expect((await api('/api/cameras', { token: 'a.b.c' })).status).toBe(401);
    expect((await api('/api/recordings')).status).toBe(401);
  });
});

describe('REAL backend - forgot / reset password', () => {
  it('answers identically for unknown and known emails (no account enumeration)', async () => {
    const u = await seedUser('forgot'); created.push(u);
    const unknown = await api('/api/forgot-password', { method: 'POST', body: { email: `nobody_${uid()}@example.test` } });
    const known = await api('/api/forgot-password', { method: 'POST', body: { email: u.email } });
    expect(unknown.status).toBe(200); expect(known.status).toBe(200);
    expect(unknown.json).toEqual(known.json);
  });
  it('requires an email', async () => expect((await api('/api/forgot-password', { method: 'POST', body: {} })).status).toBe(400));
  it('resets the password with a valid token, invalidating the old password and the token', async () => {
    const u = await seedUser('reset'); created.push(u);
    // The email cannot be delivered in a test, so the harness stores a known token hash (same hashing the backend uses).
    const token = crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await db().execute('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR)) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)', [u.email, hash]);
    const newPw = generateStrongPassword(16);
    const r = await api('/api/reset-password', { method: 'POST', body: { token, newPassword: newPw } });
    expect(r.status).toBe(200);
    expect((await api('/api/login', { method: 'POST', body: { username: u.username, password: u.password } })).status).toBe(401);
    expect((await api('/api/login', { method: 'POST', body: { username: u.username, password: newPw } })).status).toBe(200);
    const again = await api('/api/reset-password', { method: 'POST', body: { token, newPassword: generateStrongPassword(16) } });
    expect(again.status).toBe(400); // single use
  });
  it('rejects an unknown token and a weak new password', async () => {
    expect((await api('/api/reset-password', { method: 'POST', body: { token: 'nope', newPassword: generateStrongPassword(16) } })).status).toBe(400);
    expect((await api('/api/reset-password', { method: 'POST', body: { token: 'nope' } })).status).toBe(400);
  });
  it('rejects an expired token', async () => {
    const u = await seedUser('expired'); created.push(u);
    const token = crypto.randomBytes(24).toString('hex');
    await db().execute('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 1 HOUR)) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)', [u.email, crypto.createHash('sha256').update(token).digest('hex')]);
    expect((await api('/api/reset-password', { method: 'POST', body: { token, newPassword: generateStrongPassword(16) } })).status).toBe(400);
  });
});

describe('REAL backend - user profile', () => {
  it('updates name/email with the existing PUT contract and ignores newPassword', async () => {
    const u = await seedUser('prof'); created.push(u);
    const { token } = await login(u);
    const r = await api('/api/user/profile', { method: 'PUT', token, body: { id: u.id, name: 'Renamed User', email: u.email, newPassword: 'Zz!9newpassword' } });
    expect(r.status).toBe(200);
    const [rows] = await db().execute('SELECT name FROM users WHERE id = ?', [u.id]);
    expect(rows[0].name).toBe('Renamed User');
    // Documented backend behaviour: password changes are NOT applied by this endpoint.
    expect((await api('/api/login', { method: 'POST', body: { username: u.username, password: u.password } })).status).toBe(200);
  });
  it('requires authentication', async () => expect((await api('/api/user/profile', { method: 'PUT', body: { id: 1, name: 'x' } })).status).toBe(401));
  it('rejects a body id that belongs to another account with 403 and changes nothing (auth.requireAuth)', async () => {
    const a = await seedUser('profA'); const b = await seedUser('profB'); created.push(a, b);
    const { token } = await login(a);
    const r = await api('/api/user/profile', { method: 'PUT', token, body: { id: b.id, name: 'Hijacked', email: a.email } });
    expect(r.status).toBe(403);
    expect(r.json.message).toMatch(/another account/i);
    const [rows] = await db().execute('SELECT name FROM users WHERE id = ?', [b.id]);
    expect(rows[0].name).not.toBe('Hijacked');
  });
});
