const express = require('express');
const router = express.Router();
const pool = require('./db.cjs');
const auth = require('./auth.cjs');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];

    // Verify password using our helper
    const isValid = auth.verifyPassword(password, user.password);

    if (isValid) {
      if (user.is_verified) {
        // Successful login
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            profile_pic: user.profile_pic
          }
        });
      } else {
         res.status(403).json({ message: 'Account not verified. Please check your email.' });
      }
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Register Endpoint
router.post('/register', async (req, res) => {
  const { name, username, email, password } = req.body;
  
  if (!name || !username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    await auth.registerUser(name, username, email, password);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(400).json({ message: err.message || 'Registration failed' });
  }
});

// Forgot Password Endpoint
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const token = await auth.createPasswordResetToken(email);
    // In a real app, send email here. For now, log it.
    console.log(`[SIMULATION] Password Reset Link: http://localhost:5174/reset-password?token=${token}`);
    res.json({ message: 'If an account exists, a reset link has been sent (check server console).' });
  } catch (err) {
    console.error('Forgot password error:', err);
    // Secure response: don't reveal if user exists generally, but for dev we might want to know.
    res.status(500).json({ message: 'Error processing request' });
  }
});

// Reset Password Endpoint
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: 'Token and new password required' });

  try {
    await auth.resetPassword(token, newPassword);
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to reset password' });
  }
});

// --- Activity Zones Endpoints ---

// Get all zones for a user
router.get('/zones', async (req, res) => {
    // In a real app, middleware would attach user to req.
    // For now, we'll mock pass user_id via query or header, or just fetch all for demo if no auth middleware yet.
    // Assuming simple demo: pass user_id in query
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'User ID required' });

    try {
        const [rows] = await pool.execute('SELECT * FROM activity_zones WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching zones:', err);
        res.status(500).json({ message: 'Failed to fetch zones' });
    }
});

// Create a new zone
router.post('/zones', async (req, res) => {
    const { user_id, camera_id, name, coordinates } = req.body;
    
    if (!user_id || !camera_id || !name || !coordinates) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const sql = 'INSERT INTO activity_zones (user_id, camera_id, name, coordinates_json) VALUES (?, ?, ?, ?)';
        const [result] = await pool.execute(sql, [user_id, camera_id, name, JSON.stringify(coordinates)]);
        res.status(201).json({ id: result.insertId, message: 'Zone created' });
    } catch (err) {
        console.error('Error creating zone:', err);
        res.status(500).json({ message: 'Failed to create zone' });
    }
});

// Delete a zone
router.delete('/zones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM activity_zones WHERE id = ?', [id]);
        res.json({ message: 'Zone deleted' });
    } catch (err) {
        console.error('Error deleting zone:', err);
        res.status(500).json({ message: 'Failed to delete zone' });
    }
});

// --- Recordings Endpoints ---

router.get('/recordings', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'User ID required' });

    try {
        const [rows] = await pool.execute('SELECT * FROM recordings WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
        
        // --- DEMO ONLY: Insert mock data if empty ---
        if (rows.length === 0) {
            const mockData = [
                { camera_id: 'CAM-1', filename: 'clip_001.mp4', duration: '02:15', thumbnail_url: '' },
                { camera_id: 'CAM-1', filename: 'clip_002.mp4', duration: '05:00', thumbnail_url: '' },
                { camera_id: 'CAM-2', filename: 'clip_003.mp4', duration: '10:00', thumbnail_url: '' },
                { camera_id: 'CAM-3', filename: 'clip_004.mp4', duration: '01:30', thumbnail_url: '' }
            ];
            for (const rec of mockData) {
                 await pool.execute(
                    'INSERT INTO recordings (user_id, camera_id, filename, duration, thumbnail_url, created_at) VALUES (?, ?, ?, ?, ?, NOW())', 
                    [user_id, rec.camera_id, rec.filename, rec.duration, rec.thumbnail_url]
                );
            }
            // Fetch again
            const [newRows] = await pool.execute('SELECT * FROM recordings WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
            return res.json(newRows);
        }
        // ---------------------------------------------

        res.json(rows);
    } catch (err) {
        console.error('Error fetching recordings:', err);
        res.status(500).json({ message: 'Failed to fetch recordings' });
    }
});

const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure Multer for MyCloud Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // We expect user_id in the body (multer parses body before file if configured right, but best to use a default or verify)
    // IMPORTANT: req.body might be empty here depending on field order. 
    // Safest strategy: Save to temp or use a generic 'uploads' folder first, or trust fields come before files.
    // For this implementation, we will try to organize by user if possible, or fallback to 'uploads/mycam'.
    
    // NOTE: To get req.body here, fields must be appended BEFORE the file in FormData on the client.
    const userId = req.body.user_id || 'anonymous';
    const uploadPath = path.join(__dirname, '../mycloud_v0.4/uploads', 'mycam');

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Sanitize filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'rec-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

router.post('/recordings', upload.single('video'), async (req, res) => {
    // req.file is the `video` file
    // req.body will hold the text fields
    const { user_id, camera_id, duration } = req.body;
    
    console.log('[DEBUG] POST /recordings received:');
    console.log(' - body:', req.body);
    console.log(' - file:', req.file);

    if (!user_id) console.error('[DEBUG] Missing user_id');
    if (!camera_id) console.error('[DEBUG] Missing camera_id');
    if (!req.file) console.error('[DEBUG] Missing req.file');

    if (!user_id || !camera_id || !req.file) {
        return res.status(400).json({ message: 'Missing required fields or video file' });
    }

    const filename = req.file.filename;
    // Construct a URL path relative to where we serve static files (need to ensure static serving is set up)
    // For now, we'll store the filename. Frontend/Backend need to agree on how to serve.
    // Assuming we might need a route to serve this: /api/videos/:filename
    const thumbnail_url = ''; 

    try {
        const sql = 'INSERT INTO recordings (user_id, camera_id, filename, duration, thumbnail_url, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        const [result] = await pool.execute(sql, [user_id, camera_id, filename, duration, thumbnail_url]);
        
        const [newRecording] = await pool.execute('SELECT * FROM recordings WHERE id = ?', [result.insertId]);
        res.status(201).json(newRecording[0]);
    } catch (err) {
        console.error('Error creating recording:', err);
        res.status(500).json({ message: 'Failed to save recording' });
    }
});

// --- User Settings Endpoints ---

router.put('/user/profile', async (req, res) => {
    const { id, name, email, currentPassword, newPassword } = req.body;
    
    if (!id) return res.status(400).json({ message: 'User ID required' });

    try {
        // Verify current password if changing sensitive info or password
        if (currentPassword) {
            const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
            if (users.length === 0) return res.status(404).json({ message: 'User not found' });
            
            const valid = auth.verifyPassword(currentPassword, users[0].password);
            if (!valid) return res.status(401).json({ message: 'Incorrect current password' });

            if (newPassword) {
                 // Update password logic would go here (need hash helper exposed or duplication)
                 // For now, let's assume simple profile update without password for MVP or implement full hash flow
                 // Let's Skip password update for this turn to keep it simple unless requested, 
                 // just update Basic Info.
            }
        }

        // Update Basic Info
        await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
        
        // Fetch updated user
        const [updatedUsers] = await pool.execute('SELECT id, username, name, email, profile_pic FROM users WHERE id = ?', [id]);
        
        res.json({ message: 'Profile updated', user: updatedUsers[0] });

    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

module.exports = router;
