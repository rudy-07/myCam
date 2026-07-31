const crypto = require('crypto');
const db = require('./db.cjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Verifies a password against a Werkzeug-compatible hash.
 * Werkzeug format: method$salt$hash
 * Supports: pbkdf2:sha256:iterations$salt$hash and scrypt:salt$hash
 */
function verifyPassword(password, hashString) {
  if (!hashString || !hashString.includes('$')) {
    return false;
  }

  const parts = hashString.split('$');
  const method = parts[0];

  if (method.startsWith('pbkdf2:sha256')) {
    // Format: pbkdf2:sha256:iterations$salt$hash
    const methodParts = method.split(':');
    const iterations = parseInt(methodParts[2] || 260000, 10); // Default based on recent Werkzeug
    const salt = parts[1];
    const originalHash = parts[2];

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
    return derivedKey.toString('hex') === originalHash;
  } else if (method === 'scrypt') {
    // Format: scrypt:salt$hash
    // Werkzeug Defaults: n=16384, r=8, p=1
    const salt = parts[1];
    const originalHash = parts[2];

    const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    return derivedKey.toString('hex') === originalHash;
  }
  
  // Add more methods if needed (e.g., plain sha256 for legacy args)
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
        
        const method = 'scrypt';
        const hashedPassword = `${method}:${salt}$${derivedKey.toString('hex')}`;
        
        try {
            const sql = 'INSERT INTO users (username, email, password, name, created_at) VALUES (?, ?, ?, ?, NOW())';
            const [result] = await db.execute(sql, [username, email, hashedPassword, name]);
            resolve(result.insertId);
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
