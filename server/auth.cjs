const crypto = require('crypto');
const db = require('./db.cjs');
const { v4: uuidv4 } = require('uuid');

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const sessionSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be set to a random value of at least 32 characters in production.');
  return 'mycam-development-only-secret-change-before-deployment';
};

function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: String(user.id), iat: now, exp: now + SESSION_TTL_SECONDS });
  const signature = crypto.createHmac('sha256', sessionSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const [header, payload, signature] = parts;
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const userId = Number(claims.sub);
    if (parsedHeader.alg !== 'HS256' || !/^\d+$/.test(String(claims.sub)) || !Number.isSafeInteger(userId) || userId < 1 || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    const expected = crypto.createHmac('sha256', sessionSecret()).update(`${header}.${payload}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    return { id: userId, expiresAt: claims.exp };
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const user = verifySessionToken(token);
  if (!user) return res.status(401).json({ message: 'Your session is missing or expired. Please sign in again.' });
  req.user = user;
  const suppliedIds = [req.query.user_id, req.body?.user_id, req.body?.id].filter((value) => value !== undefined && value !== null && value !== '');
  if (suppliedIds.some((value) => String(value) !== String(user.id))) {
    return res.status(403).json({ message: 'You cannot access another account’s data.' });
  }
  next();
}


/**
 * Verifies a password against a Werkzeug-compatible hash.
 * Werkzeug format: method$salt$hash
 * Supports: pbkdf2:sha256:iterations$salt$hash and scrypt:salt$hash
 */
/**
 * Verifies a password against a Werkzeug-compatible or scrypt hash.
 * Formats supported:
 * - pbkdf2:sha256:iterations$salt$hash
 * - scrypt:salt$hash OR scrypt$salt$hash
 * - plaintext fallback for legacy test accounts
 */
function verifyPassword(password, hashString) {
  if (!hashString) return false;
  // Plaintext legacy passwords are intentionally rejected; migrate old accounts through reset.
  if (hashString === password) return false;
  if (!hashString.includes('$')) return false;

  const parts = hashString.split('$');
  const header = parts[0];

  if (header.startsWith('pbkdf2:sha256')) {
    const methodParts = header.split(':');
    const iterations = parseInt(methodParts[2] || 260000, 10);
    const salt = parts[1];
    const originalHash = parts[2];

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
    const actual = Buffer.from(derivedKey.toString('hex'), 'hex');
    const expected = Buffer.from(originalHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } 

  if (header.startsWith('scrypt')) {
    let salt, originalHash;
    if (parts.length >= 3) {
      salt = parts[1];
      originalHash = parts[2];
    } else {
      const headerParts = header.split(':');
      salt = headerParts[1];
      originalHash = parts[1];
    }

    if (!salt || !originalHash) return false;

    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const actual = Buffer.from(derivedKey.toString('hex'), 'hex');
    const expected = Buffer.from(originalHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }
  
  return false;
}

const registerUser = async (name, username, email, password) => {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Password must be 8-128 characters and include uppercase, lowercase, number, and special character.');
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,40}$/.test(username) || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid name, username, and email address.');
  }
  // Check if user exists
  const [existingUsers] = await db.execute('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existingUsers.length > 0) {
    throw new Error('Username or email already exists');
  }

  // Hash password (scrypt default for new users)
  return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, async (err, derivedKey) => {
        if (err) return reject(err);
        
        const hashedPassword = `scrypt$${salt}$${derivedKey.toString('hex')}`;
        
        try {
            let newUserId;
            let sql = 'INSERT INTO users (username, email, password, name, is_verified, created_at) VALUES (?, ?, ?, ?, 1, NOW())';
            try {
              const [result] = await db.execute(sql, [username, email, hashedPassword, name]);
              newUserId = result.insertId;
            } catch (colErr) {
              sql = 'INSERT INTO users (username, email, password, name, created_at) VALUES (?, ?, ?, ?, NOW())';
              const [result] = await db.execute(sql, [username, email, hashedPassword, name]);
              newUserId = result.insertId;
            }
            try {
              await db.execute(
                `INSERT IGNORE INTO camera_devices (id, user_id, name, source_label, is_enabled) VALUES ('mobile', ?, 'CAM-01 (Mobile Broadcaster)', 'Browser broadcaster', 1)`,
                [newUserId]
              );
            } catch (_) {}
            resolve(newUserId);
        } catch (dbErr) {
            reject(dbErr);
        }
      });
  });
};

const createPasswordResetToken = async (email) => {
  const cleanEmail = (typeof email === 'string' ? email.trim() : '');
  // Check if user exists first (case-insensitive)
  const [users] = await db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [cleanEmail]);
  if (users.length === 0) throw new Error('User not found');
  const targetEmail = users[0].email || cleanEmail;

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 3600000); // 1 hour
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const sql = 'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?';
  await db.execute(sql, [targetEmail, tokenHash, expiry, tokenHash, expiry]);
  
  return token;
};

const resetPassword = async (token, newPassword) => {
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      throw new Error('Password must be 8-128 characters and include uppercase, lowercase, number, and special character.');
    }
    // Find token
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const [tokens] = await db.execute('SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()', [tokenHash]);
    if (tokens.length === 0) throw new Error('Invalid or expired token');

    const email = tokens[0].email;

    // Hash new password
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(newPassword, salt, 64, async (err, derivedKey) => {
            if (err) return reject(err);
            
            const method = 'scrypt';
            const hashedPassword = `${method}:${salt}$${derivedKey.toString('hex')}`;
            
            try {
                // Update user password
                await db.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
                // Delete token
                await db.execute('DELETE FROM password_resets WHERE email = ?', [email]);
                resolve(true);
            } catch (updateErr) {
                reject(updateErr);
            }
        });
    });
};

module.exports = { verifyPassword, registerUser, createPasswordResetToken, resetPassword, createSessionToken, verifySessionToken, requireAuth };
