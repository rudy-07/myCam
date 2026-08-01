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
      if (typeof user.is_verified === 'undefined' || user.is_verified === null || user.is_verified === 1 || user.is_verified === true) {
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

// FIFO Loop Recycling Engine (Purges oldest clips when quota exceeded)
async function runStorageRecyclingLoop(userId, target, newFileSize) {
    try {
        // Fetch user quota configuration
        const [configRows] = await pool.execute('SELECT * FROM storage_configs WHERE user_id = ?', [userId]);
        const config = configRows[0] || {
            mode: 'local',
            local_target: 'both_failover',
            internal_quota_mb: 1200,
            sdcard_quota_mb: 3000,
            cloud_quota_mb: 5000
        };

        const quotaMap = {
            'internal': config.internal_quota_mb * 1024 * 1024,
            'sdcard': config.sdcard_quota_mb * 1024 * 1024,
            'cloud': config.cloud_quota_mb * 1024 * 1024
        };

        const quotaLimitBytes = quotaMap[target] || (1200 * 1024 * 1024);

        // Calculate current total used storage for target
        const [sumRows] = await pool.execute(
            'SELECT COALESCE(SUM(file_size_bytes), 0) AS total_used FROM recordings WHERE user_id = ? AND storage_target = ?',
            [userId, target]
        );
        let currentUsedBytes = Number(sumRows[0].total_used || 0);

        console.log(`[Storage Recycling] Target: ${target}, Used: ${(currentUsedBytes / 1024 / 1024).toFixed(2)} MB, Quota: ${(quotaLimitBytes / 1024 / 1024).toFixed(2)} MB, New Clip: ${(newFileSize / 1024 / 1024).toFixed(2)} MB`);

        // If saving new clip exceeds limit, purge oldest clips iteratively
        while ((currentUsedBytes + newFileSize) > quotaLimitBytes) {
            const [oldestRows] = await pool.execute(
                'SELECT id, filename, file_size_bytes FROM recordings WHERE user_id = ? AND storage_target = ? ORDER BY created_at ASC LIMIT 1',
                [userId, target]
            );

            if (oldestRows.length === 0) break; // No more files to purge

            const oldest = oldestRows[0];
            const filePath = path.join(__dirname, '../mycloud_v0.4/uploads/mycam', oldest.filename);

            // Delete physical file
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`[Storage Recycling] Purged old file: ${oldest.filename}`);
                } catch (e) {
                    console.warn(`[Storage Recycling] Could not delete file: ${oldest.filename}`, e);
                }
            }

            // Remove database entry
            await pool.execute('DELETE FROM recordings WHERE id = ?', [oldest.id]);
            currentUsedBytes -= Number(oldest.file_size_bytes || 0);
        }

    } catch (err) {
        console.error('[Storage Recycling] Error running recycling loop:', err);
    }
}

// --- Storage Config & Status Endpoints ---

router.get('/storage/config', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'User ID required' });

    try {
        const [rows] = await pool.execute('SELECT * FROM storage_configs WHERE user_id = ?', [user_id]);
        if (rows.length === 0) {
            return res.json({
                user_id: Number(user_id),
                mode: 'local',
                local_target: 'both_failover',
                internal_quota_mb: 1200,
                sdcard_quota_mb: 3000,
                cloud_quota_mb: 5000
            });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching storage config:', err);
        res.status(500).json({ message: 'Failed to fetch storage config' });
    }
});

router.post('/storage/config', async (req, res) => {
    const { user_id, mode, local_target, internal_quota_mb, sdcard_quota_mb, cloud_quota_mb } = req.body;
    if (!user_id) return res.status(400).json({ message: 'User ID required' });

    try {
        const sql = `
            INSERT INTO storage_configs (user_id, mode, local_target, internal_quota_mb, sdcard_quota_mb, cloud_quota_mb)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                mode = VALUES(mode),
                local_target = VALUES(local_target),
                internal_quota_mb = VALUES(internal_quota_mb),
                sdcard_quota_mb = VALUES(sdcard_quota_mb),
                cloud_quota_mb = VALUES(cloud_quota_mb)
        `;
        await pool.execute(sql, [user_id, mode || 'local', local_target || 'both_failover', internal_quota_mb || 1200, sdcard_quota_mb || 3000, cloud_quota_mb || 5000]);
        res.json({ message: 'Storage settings updated successfully' });
    } catch (err) {
        console.error('Error updating storage config:', err);
        res.status(500).json({ message: 'Failed to update storage config' });
    }
});

router.get('/storage/status', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'User ID required' });

    try {
        const [configRows] = await pool.execute('SELECT * FROM storage_configs WHERE user_id = ?', [user_id]);
        const config = configRows[0] || {
            mode: 'local',
            local_target: 'both_failover',
            internal_quota_mb: 1200,
            sdcard_quota_mb: 3000,
            cloud_quota_mb: 5000
        };

        const [sumInternal] = await pool.execute('SELECT COALESCE(SUM(file_size_bytes), 0) as used FROM recordings WHERE user_id = ? AND storage_target = "internal"', [user_id]);
        const [sumSdCard] = await pool.execute('SELECT COALESCE(SUM(file_size_bytes), 0) as used FROM recordings WHERE user_id = ? AND storage_target = "sdcard"', [user_id]);
        const [sumCloud] = await pool.execute('SELECT COALESCE(SUM(file_size_bytes), 0) as used FROM recordings WHERE user_id = ? AND storage_target = "cloud"', [user_id]);

        const usedInternalMb = Math.round(Number(sumInternal[0].used) / 1024 / 1024);
        const usedSdCardMb = Math.round(Number(sumSdCard[0].used) / 1024 / 1024);
        const usedCloudMb = Math.round(Number(sumCloud[0].used) / 1024 / 1024);

        // Determine current active target in failover mode
        let activeTarget = config.local_target;
        if (config.local_target === 'both_failover') {
            activeTarget = (usedInternalMb >= config.internal_quota_mb) ? 'sdcard' : 'internal';
        }

        res.json({
            config,
            used_mb: {
                internal: usedInternalMb,
                sdcard: usedSdCardMb,
                cloud: usedCloudMb
            },
            active_target: activeTarget
        });
    } catch (err) {
        console.error('Error fetching storage status:', err);
        res.status(500).json({ message: 'Failed to fetch storage status' });
    }
});

router.post('/recordings', upload.single('video'), async (req, res) => {
    const { user_id, camera_id, duration, target_override } = req.body;
    
    if (!user_id || !camera_id || !req.file) {
        return res.status(400).json({ message: 'Missing required fields or video file' });
    }

    const filename = req.file.filename;
    const fileSize = req.file.size || 0;
    const thumbnail_url = ''; 

    // Fetch storage target configuration
    let target = target_override || 'internal';
    try {
        const [cfg] = await pool.execute('SELECT * FROM storage_configs WHERE user_id = ?', [user_id]);
        if (cfg.length > 0) {
            const config = cfg[0];
            if (config.mode === 'cloud') {
                target = 'cloud';
            } else if (config.local_target === 'both_failover') {
                const [sumInt] = await pool.execute('SELECT COALESCE(SUM(file_size_bytes), 0) as used FROM recordings WHERE user_id = ? AND storage_target = "internal"', [user_id]);
                const usedIntMb = Math.round(Number(sumInt[0].used) / 1024 / 1024);
                target = (usedIntMb >= config.internal_quota_mb) ? 'sdcard' : 'internal';
            } else {
                target = config.local_target || 'internal';
            }
        }
    } catch (e) {
        console.warn('Using default storage target internal', e);
    }

    // Run FIFO Loop Recycling before database entry
    await runStorageRecyclingLoop(user_id, target, fileSize);

    try {
        const sql = 'INSERT INTO recordings (user_id, camera_id, filename, duration, file_size_bytes, storage_target, thumbnail_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())';
        const [result] = await pool.execute(sql, [user_id, camera_id, filename, duration, fileSize, target, thumbnail_url]);
        
        const [newRecording] = await pool.execute('SELECT * FROM recordings WHERE id = ?', [result.insertId]);
        res.status(201).json({ ...newRecording[0], active_target: target });
    } catch (err) {
        console.error('Error creating recording:', err);
        res.status(500).json({ message: 'Failed to save recording' });
    }
});

// Configure Snapshot Storage
const snapshotStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../mycloud_v0.4/uploads', 'snapshots');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'snap-' + uniqueSuffix + ext);
  }
});
const uploadSnapshot = multer({ storage: snapshotStorage });

router.post('/snapshots', uploadSnapshot.single('image'), async (req, res) => {
    const { user_id, camera_id, trigger_type } = req.body;
    console.log('[DEBUG] POST /snapshots received:', { user_id, camera_id, trigger_type, file: req.file });

    if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
    }

    res.status(201).json({
        success: true,
        message: 'Snapshot captured and saved successfully',
        filename: req.file.filename,
        trigger_type: trigger_type || 'manual',
        captured_at: new Date().toISOString()
    });
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

// --- Scheduled Recording Endpoints ---

router.get('/schedules', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ message: 'User ID required' });

    try {
        const [rows] = await pool.execute('SELECT * FROM recording_schedules WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
        
        // Demo initial schedule if empty
        if (rows.length === 0) {
            const defaultDays = JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
            await pool.execute(
                'INSERT INTO recording_schedules (user_id, camera_id, name, days_json, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
                [user_id, 'mobile', 'Night Surveillance', defaultDays, '22:00', '06:00']
            );
            const [newRows] = await pool.execute('SELECT * FROM recording_schedules WHERE user_id = ? ORDER BY created_at DESC', [user_id]);
            return res.json(newRows);
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching schedules:', err);
        res.status(500).json({ message: 'Failed to fetch schedules' });
    }
});

router.post('/schedules', async (req, res) => {
    const { user_id, camera_id, name, days, start_time, end_time } = req.body;
    if (!user_id || !camera_id || !name || !days || !start_time || !end_time) {
        return res.status(400).json({ message: 'Missing required schedule fields' });
    }

    try {
        const sql = 'INSERT INTO recording_schedules (user_id, camera_id, name, days_json, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)';
        const [result] = await pool.execute(sql, [user_id, camera_id, name, JSON.stringify(days), start_time, end_time]);
        
        const [newSchedule] = await pool.execute('SELECT * FROM recording_schedules WHERE id = ?', [result.insertId]);
        res.status(201).json(newSchedule[0]);
    } catch (err) {
        console.error('Error creating schedule:', err);
        res.status(500).json({ message: 'Failed to create schedule' });
    }
});

router.put('/schedules/:id', async (req, res) => {
    const { id } = req.params;
    const { is_active, name, days, start_time, end_time } = req.body;

    try {
        if (typeof is_active !== 'undefined') {
            await pool.execute('UPDATE recording_schedules SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
        } else {
            await pool.execute(
                'UPDATE recording_schedules SET name = ?, days_json = ?, start_time = ?, end_time = ? WHERE id = ?',
                [name, JSON.stringify(days), start_time, end_time, id]
            );
        }
        res.json({ message: 'Schedule updated successfully' });
    } catch (err) {
        console.error('Error updating schedule:', err);
        res.status(500).json({ message: 'Failed to update schedule' });
    }
});

router.delete('/schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM recording_schedules WHERE id = ?', [id]);
        res.json({ message: 'Schedule deleted successfully' });
    } catch (err) {
        console.error('Error deleting schedule:', err);
        res.status(500).json({ message: 'Failed to delete schedule' });
    }
});

module.exports = router;
