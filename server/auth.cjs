const crypto = require('crypto');
const db = require('./db.cjs');
const { v4: uuidv4 } = require('uuid');

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
  if (hashString === password) return true;
  if (!hashString.includes('$')) return false;

  const parts = hashString.split('$');
  const header = parts[0];

  if (header.startsWith('pbkdf2:sha256')) {
    const methodParts = header.split(':');
    const iterations = parseInt(methodParts[2] || 260000, 10);
    const salt = parts[1];
    const originalHash = parts[2];

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
    return derivedKey.toString('hex') === originalHash;
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
    return derivedKey.toString('hex') === originalHash;
  }
  
  return false;
}

const registerUser = async (name, username, email, password) => {
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
            // Try inserting with is_verified = 1; fallback if column doesn't exist
            let sql = 'INSERT INTO users (username, email, password, name, is_verified, created_at) VALUES (?, ?, ?, ?, 1, NOW())';
            try {
              const [result] = await db.execute(sql, [username, email, hashedPassword, name]);
              resolve(result.insertId);
            } catch (colErr) {
              sql = 'INSERT INTO users (username, email, password, name, created_at) VALUES (?, ?, ?, ?, NOW())';
              const [result] = await db.execute(sql, [username, email, hashedPassword, name]);
              resolve(result.insertId);
            }
        } catch (dbErr) {
            reject(dbErr);
        }
      });
  });
};

const createPasswordResetToken = async (email) => {
  // Check if user exists first
  const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
  if (users.length === 0) throw new Error('User not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 3600000); // 1 hour

  const sql = 'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?';
  await db.execute(sql, [email, token, expiry, token, expiry]);
  
  return token;
};

const resetPassword = async (token, newPassword) => {
    // Find token
    const [tokens] = await db.execute('SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW()', [token]);
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

module.exports = { verifyPassword, registerUser, createPasswordResetToken, resetPassword };
