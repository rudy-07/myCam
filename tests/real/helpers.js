// Helpers for tests that talk to the REAL backend (http://127.0.0.1:3000) and a REAL database.
// The harness may seed/read the throwaway TEST database directly; it never modifies backend source.
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

export const BASE = process.env.MYCAM_API || 'http://127.0.0.1:3000';
const DB = {
  host: process.env.TEST_DB_HOST || '127.0.0.1',
  user: process.env.TEST_DB_USER || 'mycam_test',
  password: process.env.TEST_DB_PASSWORD || 'mycam_test_pw',
  database: process.env.TEST_DB_NAME || 'mycam_test',
};
// Safety: refuse to run seeding against anything that does not look like a throwaway test database.
if (!/test/i.test(DB.database)) throw new Error(`Refusing to run: database name "${DB.database}" does not look like a test database.`);

let pool;
export const db = () => (pool ||= mysql.createPool({ ...DB, connectionLimit: 3 }));
export const closeDb = async () => { if (pool) await pool.end(); pool = undefined; };

export const uid = () => crypto.randomBytes(4).toString('hex');

/** Insert a user exactly as the backend would store one (scrypt hash) plus its default camera. */
export async function seedUser(prefix = 'qa') {
  const tag = `${prefix}_${uid()}`;
  const password = `Qa!${uid()}Zz9`;
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  const [r] = await db().execute('INSERT INTO users (username, email, password, name) VALUES (?, ?, ?, ?)', [tag, `${tag}@example.test`, `scrypt:${salt}$${hash}`, `QA ${tag}`]);
  // camera_devices.id is the table's ONLY primary key, and the backend creates the default camera with INSERT IGNORE, so in a real
  // deployment only the FIRST account ever owns 'mobile' (see BK-02 in BUG_AUDIT.md). Tests run one at a time, so the current test
  // user is handed the row, as the first user of a fresh system would own it.
  await db().execute("INSERT INTO camera_devices (id, user_id, name, source_label, is_enabled) VALUES ('mobile', ?, 'CAM-01 (Mobile Broadcaster)', 'Browser broadcaster', 1) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)", [r.insertId]);
  return { id: r.insertId, username: tag, email: `${tag}@example.test`, password };
}

export async function removeUsers(users) {
  for (const u of users) {
    for (const t of ['activity_zones', 'recordings', 'recording_schedules', 'alert_events', 'alert_preferences', 'camera_devices', 'storage_configs']) {
      try { await db().execute(`DELETE FROM ${t} WHERE user_id = ?`, [u.id]); } catch { /* table may not have user_id */ }
    }
    try { await db().execute('DELETE FROM password_resets WHERE email = ?', [u.email]); } catch { /* ignore */ }
    await db().execute('DELETE FROM users WHERE id = ?', [u.id]);
  }
}

export async function api(path, { method = 'GET', token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form; else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, ok: res.ok, json, text, headers: res.headers };
}

export async function login(user) {
  const r = await api('/api/login', { method: 'POST', body: { username: user.username, password: user.password } });
  if (r.status !== 200) throw new Error(`login failed (${r.status}): ${r.text}`);
  return { token: r.json.token, user: r.json.user };
}

export async function backendReachable() {
  try { const r = await fetch(`${BASE}/readyz`); return r.ok; } catch { return false; }
}

/**
 * Mint a session token for a seeded user with the same HS256 scheme the backend verifies (server/auth.cjs).
 * Used where a test is not ABOUT logging in, so the backend's login rate limit (10 / 15 min) is not exhausted.
 * The secret is the throwaway test secret the test backend is started with.
 */
export function mintToken(user, secret = process.env.AUTH_SECRET || 'test-secret-test-secret-test-secret-1234') {
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = enc({ alg: 'HS256', typ: 'JWT' });
  const body = enc({ sub: String(user.id), iat: now, exp: now + 3600 });
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
