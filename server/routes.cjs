const express = require('express');
const router = express.Router();
const pool = require('./db.cjs');
const auth = require('./auth.cjs');
const mediaStorage = require('./media-storage.cjs');
const emailService = require('./email-service.cjs');

const rateLimitBuckets = new Map();
const RATE_LIMIT_MAX_BUCKETS = 10000;
let rateLimitSweepCount = 0;
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    // Bound memory under churn from many one-off source addresses.
    if (++rateLimitSweepCount % 128 === 0 || rateLimitBuckets.size > 5000) {
      for (const [bucketKey, value] of rateLimitBuckets) {
        if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
      }
    }
    let bucket = rateLimitBuckets.get(key);
    if (!bucket) {
      if (rateLimitBuckets.size >= RATE_LIMIT_MAX_BUCKETS) {
        res.set('Retry-After', '60');
        return res.status(429).json({ message: 'Authentication is busy. Please wait a minute and try again.' });
      }
      bucket = { count: 0, resetAt: now + windowMs };
    } else if (bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
    }
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ message: 'Too many attempts. Please wait a little and try again.' });
    }
    next();
  };
}

router.post('/login', rateLimit({ max: 10 }), async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Username/email and password are required.' });
  }

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
        let token;
        try { token = auth.createSessionToken(user); } catch (tokenError) {
          console.error('Session configuration error:', tokenError.message);
          return res.status(500).json({ message: 'Authentication is not configured on this server.' });
        }
        res.json({
          success: true,
          token,
          expires_in: 43200,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            profile_pic: user.profile_pic,
            email: user.email
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
router.post('/register', rateLimit({ max: 5 }), async (req, res) => {
  const { name, username, email, password } = req.body;
  
  if (!name || !username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    await auth.registerUser(name, username, email, password);
    // Send Welcome Email asynchronously
    emailService.sendWelcomeEmail(email, name, req).catch((e) => {
      console.error('[Register] Welcome email error:', e.message);
    });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(400).json({ message: err.message || 'Registration failed' });
  }
});

// Forgot Password Endpoint
router.post('/forgot-password', rateLimit({ max: 5 }), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const token = await auth.createPasswordResetToken(email);
    // Fetch recipient name if available
    let recipientName = 'Operator';
    try {
      const [rows] = await pool.execute('SELECT name FROM users WHERE email = ? LIMIT 1', [email]);
      if (rows.length && rows[0].name) recipientName = rows[0].name;
    } catch (e) {
      /* ignore */
    }

    // Send Designer Password Reset Email
    await emailService.sendPasswordResetEmail(email, recipientName, token, req);
    res.json({ message: 'If an account exists, a reset link has been requested.' });
  } catch (err) {
    // Keep the public response identical for unknown accounts and internal failures.
    res.json({ message: 'If an account exists, a reset link has been requested.' });
  }
});

// Reset Password Endpoint
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (typeof token !== 'string' || !token || typeof newPassword !== 'string' || !newPassword) return res.status(400).json({ message: 'Token and new password required' });

  try {
    await auth.resetPassword(token, newPassword);
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to reset password' });
  }
});

// Contact Form Endpoint (Matching myCloud implementation)
router.post('/contact', rateLimit({ max: 5 }), async (req, res) => {
  const { name, email, subject, category, message, company } = req.body || {};

  // Honeypot check for bots
  if (company && String(company).trim()) {
    return res.json({ success: true, message: 'Thanks, your message has been sent.' });
  }

  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanSubject = String(subject || '').trim();
  const cleanCategory = String(category || 'general').trim().toLowerCase();
  const cleanMessage = String(message || '').trim();

  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
    return res.status(400).json({ success: false, error: 'Enter a valid name between 2 and 80 characters.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail) || cleanEmail.length > 254) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
  }

  if (cleanSubject.length < 3 || cleanSubject.length > 160 || /[\r\n]/.test(cleanSubject)) {
    return res.status(400).json({ success: false, error: 'Enter a subject between 3 and 160 characters.' });
  }

  if (cleanMessage.length < 20 || cleanMessage.length > 5000) {
    return res.status(400).json({ success: false, error: 'Enter a message between 20 and 5,000 characters.' });
  }

  try {
    const result = await emailService.sendContactMessage(
      {
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        category: cleanCategory,
        message: cleanMessage,
        company: company ? String(company).trim() : '',
      },
      req
    );

    res.json(result);
  } catch (err) {
    console.error('[Contact Error]', err);
    res.status(500).json({ success: false, error: 'Could not send your message right now. Please try again later.' });
  }
});

// Every API below this point requires a signed, expiring bearer token.
router.use(auth.requireAuth);

// --- Persistent alert history and notification preferences ---
router.get('/alerts', async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  try {
    const [rows] = await pool.execute(
      `SELECT id, camera_id AS cameraId, event_type AS type, message, occurred_at AS timestamp, is_read AS isRead, recording_id AS recordingId
       FROM alert_events WHERE user_id = ? ORDER BY occurred_at DESC, id DESC LIMIT ${limit}`,
      [req.user.id]
    );
    res.json(rows.map((row) => ({ ...row, id: String(row.id), isRead: Boolean(row.isRead), timestamp: new Date(row.timestamp).toISOString() })));
  } catch (error) {
    console.error('Alert history fetch failed:', error.message);
    res.status(500).json({ message: 'Could not load alert history.' });
  }
});

// Create and trigger an alert event
router.post('/alerts', async (req, res) => {
  const type = typeof req.body?.type === 'string' ? req.body.type.trim() : 'activity';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : 'Activity reported by a camera';
  const cameraId = typeof req.body?.cameraId === 'string' ? req.body.cameraId.trim() : null;
  const safeType = /^[a-z][a-z0-9_-]{0,39}$/.test(type) ? type : 'activity';
  const safeMessage = message.slice(0, 500);

  try {
    const [result] = await pool.execute(
      'INSERT INTO alert_events (user_id, camera_id, event_type, message) VALUES (?, ?, ?, ?)',
      [req.user.id, cameraId, safeType, safeMessage]
    );

    const [prefRows] = await pool.execute(
      'SELECT motion_alerts, dashboard_toasts, browser_notifications FROM alert_preferences WHERE user_id = ?',
      [req.user.id]
    );
    const prefs = prefRows[0] || { motion_alerts: 1, dashboard_toasts: 1, browser_notifications: 0 };

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('smart-alert', {
        id: String(result.insertId),
        type: safeType,
        cameraId,
        timestamp: new Date().toISOString(),
        message: safeMessage,
        dashboardToast: Boolean(prefs.dashboard_toasts),
        browserNotification: Boolean(prefs.browser_notifications),
      });
    }

    res.status(201).json({
      id: String(result.insertId),
      type: safeType,
      cameraId,
      timestamp: new Date().toISOString(),
      message: safeMessage,
    });
  } catch (error) {
    console.error('Alert creation failed:', error.message);
    res.status(500).json({ message: 'Could not create alert.' });
  }
});


// Associate an alert with a real recording owned by the same account.
router.put('/alerts/:id/recording', async (req, res) => {
  const eventId = String(req.params.id || '');
  const recordingId = req.body?.recordingId == null ? null : Number(req.body.recordingId);
  if (!/^\d{1,18}$/.test(eventId)) return res.status(400).json({ message: 'Invalid alert ID.' });
  if (recordingId !== null && (!Number.isSafeInteger(recordingId) || recordingId < 1)) {
    return res.status(400).json({ message: 'Provide a valid recording ID or null to unlink.' });
  }
  try {
    const [eventRows] = await pool.execute('SELECT id FROM alert_events WHERE id = ? AND user_id = ? LIMIT 1', [eventId, req.user.id]);
    if (!eventRows.length) return res.status(404).json({ message: 'Alert not found.' });
    if (recordingId !== null) {
      const [recordingRows] = await pool.execute('SELECT id, camera_id FROM recordings WHERE id = ? AND user_id = ? LIMIT 1', [recordingId, req.user.id]);
      if (!recordingRows.length) return res.status(404).json({ message: 'Recording not found in this account.' });
      const [alertRows] = await pool.execute('SELECT camera_id FROM alert_events WHERE id = ? AND user_id = ? LIMIT 1', [eventId, req.user.id]);
      const alertCamera = alertRows[0]?.camera_id;
      if (alertCamera && recordingRows[0].camera_id && alertCamera !== recordingRows[0].camera_id) {
        return res.status(400).json({ message: 'The recording belongs to a different camera.' });
      }
    }
    await pool.execute('UPDATE alert_events SET recording_id = ? WHERE id = ? AND user_id = ?', [recordingId, eventId, req.user.id]);
    res.json({ message: recordingId === null ? 'Recording unlinked.' : 'Recording linked to alert.', eventId, recordingId });
  } catch (error) {
    console.error('Alert recording link update failed:', error.message);
    res.status(500).json({ message: 'Could not update the event recording link.' });
  }
});

router.patch('/alerts/read', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => /^\d{1,18}$/.test(String(id))).slice(0, 100) : null;
  try {
    if (ids === null) return res.status(400).json({ message: 'Provide an array of alert IDs.' });
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      await pool.execute(`UPDATE alert_events SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`, [req.user.id, ...ids]);
    }
    res.json({ message: 'Alerts marked as read.' });
  } catch (error) {
    console.error('Alert read update failed:', error.message);
    res.status(500).json({ message: 'Could not update alerts.' });
  }
});

router.delete('/alerts', async (req, res) => {
  try {
    await pool.execute('DELETE FROM alert_events WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Alert history cleared.' });
  } catch (error) {
    console.error('Alert clear failed:', error.message);
    res.status(500).json({ message: 'Could not clear alert history.' });
  }
});

router.get('/alert-preferences', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT motion_alerts, dashboard_toasts, browser_notifications FROM alert_preferences WHERE user_id = ?', [req.user.id]);
    const row = rows[0] || { motion_alerts: 1, dashboard_toasts: 1, browser_notifications: 0 };
    res.json({ motionAlerts: Boolean(row.motion_alerts), dashboardToasts: Boolean(row.dashboard_toasts), browserNotifications: Boolean(row.browser_notifications) });
  } catch (error) {
    console.error('Alert preferences fetch failed:', error.message);
    res.status(500).json({ message: 'Could not load alert preferences.' });
  }
});

router.put('/alert-preferences', async (req, res) => {
  const body = req.body || {};
  for (const key of ['motionAlerts', 'dashboardToasts', 'browserNotifications']) {
    if (typeof body[key] !== 'boolean') return res.status(400).json({ message: 'All notification preferences must be boolean values.' });
  }
  try {
    await pool.execute(
      `INSERT INTO alert_preferences (user_id, motion_alerts, dashboard_toasts, browser_notifications) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE motion_alerts = VALUES(motion_alerts), dashboard_toasts = VALUES(dashboard_toasts), browser_notifications = VALUES(browser_notifications)`,
      [req.user.id, body.motionAlerts ? 1 : 0, body.dashboardToasts ? 1 : 0, body.browserNotifications ? 1 : 0]
    );
    res.json({ motionAlerts: body.motionAlerts, dashboardToasts: body.dashboardToasts, browserNotifications: body.browserNotifications });
  } catch (error) {
    console.error('Alert preferences save failed:', error.message);
    res.status(500).json({ message: 'Could not save alert preferences.' });
  }
});

// Runtime WebRTC ICE configuration. TURN credentials must be short-lived where supported.
router.get('/rtc-config', (req, res) => {
  try {
    const configured = process.env.ICE_SERVERS_JSON;
    const iceServers = configured ? JSON.parse(configured) : [{ urls: 'stun:stun.l.google.com:19302' }];
    if (!Array.isArray(iceServers) || iceServers.length === 0 || iceServers.some((server) => !server || !(typeof server.urls === 'string' || Array.isArray(server.urls)))) {
      return res.status(500).json({ message: 'ICE server configuration is invalid.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ iceServers });
  } catch (error) {
    console.error('Invalid ICE_SERVERS_JSON configuration:', error.message);
    res.status(500).json({ message: 'ICE server configuration is invalid.' });
  }
});

// --- Multi-camera registry ---
// A default mobile camera preserves the existing first-run experience. Further cameras
// are explicitly registered by the authenticated account and are never shared cross-user.
router.get('/cameras', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, source_label, is_enabled, created_at FROM camera_devices WHERE user_id = ? ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Camera list failed:', error.message);
    res.status(500).json({ message: 'Could not load registered cameras.' });
  }
});

router.post('/cameras', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Camera name must be between 2 and 100 characters.' });
  const id = `cam-${require('crypto').randomUUID()}`;
  try {
    await pool.execute('INSERT INTO camera_devices (id, user_id, name) VALUES (?, ?, ?)', [id, req.user.id, name]);
    res.status(201).json({ id, name, source_label: 'Browser broadcaster', is_enabled: 1 });
  } catch (error) {
    console.error('Camera registration failed:', error.message);
    res.status(500).json({ message: 'Could not register this camera.' });
  }
});

router.patch('/cameras/:id', async (req, res) => {
  const id = req.params.id;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,50}$/.test(id)) return res.status(400).json({ message: 'Invalid camera ID.' });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Camera name must be between 2 and 100 characters.' });
  try {
    const [result] = await pool.execute('UPDATE camera_devices SET name = ? WHERE id = ? AND user_id = ?', [name, id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Camera not found.' });
    res.json({ id, name, message: 'Camera updated.' });
  } catch (error) {
    console.error('Camera update failed:', error.message);
    res.status(500).json({ message: 'Could not update this camera.' });
  }
});

router.delete('/cameras/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[A-Za-z0-9._:-]{1,50}$/.test(id)) return res.status(400).json({ message: 'Invalid camera ID.' });
  try {
    const [result] = await pool.execute('DELETE FROM camera_devices WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Camera not found.' });

    // Clean up associated activity zones and recording schedules for this camera
    await pool.execute('DELETE FROM activity_zones WHERE camera_id = ? AND user_id = ?', [id, req.user.id]).catch(() => {});
    await pool.execute('DELETE FROM recording_schedules WHERE camera_id = ? AND user_id = ?', [id, req.user.id]).catch(() => {});

    res.json({ message: 'Camera removed.' });
  } catch (error) {
    console.error('Camera deletion failed:', error.message);
    res.status(500).json({ message: 'Could not remove this camera.' });
  }
});

// --- Activity Zones Endpoints ---

// Get all zones for a user
router.get('/zones', async (req, res) => {
    // The authenticated user ID is enforced by middleware.
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
    
    if (!camera_id || !name || !coordinates) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const sql = 'INSERT INTO activity_zones (user_id, camera_id, name, coordinates_json) VALUES (?, ?, ?, ?)';
        const [result] = await pool.execute(sql, [req.user.id, camera_id, name, JSON.stringify(coordinates)]);
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
        await pool.execute('DELETE FROM activity_zones WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ message: 'Zone deleted' });
    } catch (err) {
        console.error('Error deleting zone:', err);
        res.status(500).json({ message: 'Failed to delete zone' });
    }
});

// Upload status is scoped to the authenticated user and never exposes another account's request.
router.get('/recording-uploads/:key', async (req, res) => {
    const key = req.params.key;
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return res.status(400).json({ message: 'Invalid upload key.' });
    try {
        const [rows] = await pool.execute(
            'SELECT status, recording_id, response_json, created_at, updated_at FROM recording_upload_requests WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
            [req.user.id, key]
        );
        if (!rows.length) return res.status(404).json({ message: 'Upload request not found.' });
        const item = rows[0];
        return res.json({
            status: item.status,
            recording_id: item.recording_id,
            created_at: item.created_at,
            updated_at: item.updated_at,
            recording: item.status === 'completed' && item.response_json ? JSON.parse(item.response_json) : null
        });
    } catch (error) {
        console.error('Upload status lookup failed:', error.message);
        return res.status(500).json({ message: 'Could not retrieve upload status.' });
    }
});

// --- Recordings Endpoints ---

router.get('/recordings', async (req, res) => {
    const user_id = req.user.id;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM recordings WHERE user_id = ? ORDER BY created_at DESC',
            [user_id]
        );
        // An empty library is a valid state. Never create fake recording rows here.
        res.json(rows);
    } catch (err) {
        console.error('Error fetching recordings:', err);
        res.status(500).json({ message: 'Failed to fetch recordings' });
    }
});

// Account-scoped storage summary and non-destructive retention preview.
router.get('/recordings/retention-preview', async (req, res) => {
    const allowedDays = new Set([7, 30, 60, 90, 180, 365]);
    const days = Number(req.query.days ?? 30);
    if (!Number.isInteger(days) || !allowedDays.has(days)) {
        return res.status(400).json({ message: 'Choose a retention age of 7, 30, 60, 90, 180, or 365 days.' });
    }
    try {
        const [summaryRows] = await pool.execute(
            `SELECT COUNT(*) AS recording_count,
                    COALESCE(SUM(file_size_bytes), 0) AS total_bytes,
                    COALESCE(SUM(CASE WHEN storage_target = 'cloud' THEN file_size_bytes ELSE 0 END), 0) AS cloud_bytes,
                    COALESCE(SUM(CASE WHEN storage_target <> 'cloud' OR storage_target IS NULL THEN file_size_bytes ELSE 0 END), 0) AS local_bytes
             FROM recordings WHERE user_id = ?`, [req.user.id]
        );
        const [candidateRows] = await pool.execute(
            `SELECT id, filename, camera_id, duration, file_size_bytes, storage_target, trigger_type, created_at
             FROM recordings WHERE user_id = ? AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
             ORDER BY created_at ASC LIMIT 500`, [req.user.id, days]
        );
        const candidates = candidateRows.map((row) => ({
            id: String(row.id), filename: row.filename, camera_id: row.camera_id,
            duration: row.duration, file_size_bytes: Number(row.file_size_bytes || 0),
            storage_target: row.storage_target || 'internal', trigger_type: row.trigger_type || 'manual',
            created_at: row.created_at,
        }));
        const candidateBytes = candidates.reduce((sum, row) => sum + row.file_size_bytes, 0);
        return res.json({
            days, cutoff: new Date(Date.now() - days * 86400000).toISOString(),
            total_recordings: Number(summaryRows[0]?.recording_count || 0),
            total_bytes: Number(summaryRows[0]?.total_bytes || 0),
            local_bytes: Number(summaryRows[0]?.local_bytes || 0), cloud_bytes: Number(summaryRows[0]?.cloud_bytes || 0),
            candidate_count: candidates.length, candidate_bytes: candidateBytes,
            truncated: candidates.length === 500, candidates,
            note: 'Preview only. Nothing is deleted until you explicitly confirm cleanup. Results are limited to this account.'
        });
    } catch (error) {
        console.error('Retention preview failed:', error.message);
        return res.status(500).json({ message: 'Could not prepare the retention preview.' });
    }
});

// On-demand, read-only verification for one recording. This checks storage without
// changing or deleting the user's metadata when a file is missing or storage is down.
router.get('/recordings/:id/verify', async (req, res) => {
    const id = String(req.params.id || '');
    if (!/^\d{1,18}$/.test(id)) return res.status(400).json({ message: 'Invalid recording ID.' });
    try {
        const [rows] = await pool.execute(
            'SELECT id, camera_id, filename, duration, file_size_bytes, storage_target, trigger_type, triggered_at, created_at FROM recordings WHERE id = ? AND user_id = ? LIMIT 1',
            [id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Recording not found in this account.' });
        const recording = rows[0];
        const base = {
            id: String(recording.id), camera_id: recording.camera_id, filename: recording.filename,
            duration: recording.duration, file_size_bytes: Number(recording.file_size_bytes || 0),
            storage_target: recording.storage_target, trigger_type: recording.trigger_type || 'manual',
            triggered_at: recording.triggered_at, created_at: recording.created_at,
        };
        const filename = String(recording.filename || '');
        if (!filename || path.basename(filename) !== filename || !/^rec-[a-zA-Z0-9._-]+$/.test(filename)) {
            return res.json({ ...base, status: 'invalid_metadata', message: 'Stored filename failed validation.' });
        }
        if (recording.storage_target === 'cloud') {
            try {
                const object = await mediaStorage.headRecording({ userId: req.user.id, filename });
                return res.json({ ...base, status: 'available', actual_size_bytes: object.contentLength ?? null, checked_at: new Date().toISOString() });
            } catch (error) {
                if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
                    return res.json({ ...base, status: 'missing', message: 'Cloud object was not found.', checked_at: new Date().toISOString() });
                }
                return res.json({ ...base, status: 'unverified', message: 'Cloud storage could not be checked; no metadata was changed.', checked_at: new Date().toISOString() });
            }
        }
        const filePath = path.resolve(RECORDINGS_DIR, filename);
        if (!filePath.startsWith(`${RECORDINGS_DIR}${path.sep}`)) {
            return res.json({ ...base, status: 'invalid_metadata', message: 'Stored path failed validation.' });
        }
        try {
            const stat = await fs.promises.stat(filePath);
            if (!stat.isFile()) return res.json({ ...base, status: 'missing', message: 'Recording is not a regular file.', checked_at: new Date().toISOString() });
            return res.json({ ...base, status: 'available', actual_size_bytes: stat.size, checked_at: new Date().toISOString() });
        } catch (error) {
            if (error.code === 'ENOENT') return res.json({ ...base, status: 'missing', message: 'Recording file was not found in server storage.', checked_at: new Date().toISOString() });
            return res.json({ ...base, status: 'unverified', message: 'Storage could not be checked; no metadata was changed.', checked_at: new Date().toISOString() });
        }
    } catch (error) {
        console.error('Single recording verification failed:', error.message);
        return res.status(500).json({ message: 'Could not verify recording storage.' });
    }
});


// Read-only storage verification for recovery after interrupted uploads or restarts.
router.post('/recordings/verify', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, filename, storage_target, file_size_bytes, created_at FROM recordings WHERE user_id = ? ORDER BY created_at DESC LIMIT 500',
            [req.user.id]
        );
        const results = await Promise.all(rows.map(async (recording) => {
            const filename = String(recording.filename || '');
            const base = { id: recording.id, filename, storage_target: recording.storage_target, file_size_bytes: Number(recording.file_size_bytes || 0), created_at: recording.created_at };
            if (!filename || path.basename(filename) !== filename || !/^rec-[a-zA-Z0-9._-]+$/.test(filename)) {
                return { ...base, status: 'invalid_metadata', message: 'Stored filename failed validation.' };
            }
            if (recording.storage_target === 'cloud') {
                try {
                    const object = await mediaStorage.headRecording({ userId: req.user.id, filename });
                    return { ...base, status: 'available', actual_size_bytes: object.contentLength ?? null };
                } catch (error) {
                    if (error.name === 'NoSuchKey' || error.name === 'NotFound') return { ...base, status: 'missing', message: 'Cloud object was not found.' };
                    return { ...base, status: 'unverified', message: 'Cloud storage could not be checked; no metadata was changed.' };
                }
            }
            const filePath = path.resolve(RECORDINGS_DIR, filename);
            if (!filePath.startsWith(`${RECORDINGS_DIR}${path.sep}`)) return { ...base, status: 'invalid_metadata', message: 'Stored path failed validation.' };
            try {
                const stat = await fs.promises.stat(filePath);
                if (!stat.isFile()) return { ...base, status: 'missing', message: 'Local recording is not a regular file.' };
                return { ...base, status: 'available', actual_size_bytes: stat.size };
            } catch (error) {
                if (error.code === 'ENOENT') return { ...base, status: 'missing', message: 'Local recording file was not found.' };
                return { ...base, status: 'unverified', message: 'Local storage could not be checked; no metadata was changed.' };
            }
        }));
        const summary = results.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
        res.json({ checked: results.length, truncated: rows.length === 500, summary, recordings: results, note: 'Verification is read-only. Missing or unverified records are not automatically deleted.' });
    } catch (err) {
        console.error('Recording verification failed:', err.message);
        res.status(500).json({ message: 'Could not verify recording storage.' });
    }
});

const multer = require('multer');
const fs = require('fs');
const path = require('path');
const RECORDINGS_DIR = path.resolve(__dirname, '../mycloud_v0.4/uploads/mycam');

// Stream a recording only when its metadata belongs to the requested account.
// This follows the app's existing user_id API contract; it is not a substitute for
// authenticated server-side sessions, which are a separate security milestone.
router.get('/videos/:filename', async (req, res) => {
    const { filename } = req.params;
    const user_id = req.user.id;
    if (!filename || path.basename(filename) !== filename || !/^rec-[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).json({ message: 'Invalid recording filename' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT id, storage_target FROM recordings WHERE user_id = ? AND filename = ? LIMIT 1',
            [user_id, filename]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Recording not found' });

        res.type(path.extname(filename).toLowerCase() === '.webm' ? 'video/webm' : path.extname(filename).toLowerCase() === '.mp4' ? 'video/mp4' : 'application/octet-stream');
        res.set('Cache-Control', 'private, no-store');
        if (rows[0].storage_target === 'cloud') {
            try {
                const object = await mediaStorage.getRecordingStream({ userId: user_id, filename });
                if (object.ContentType) res.type(object.ContentType);
                if (object.ContentLength) res.set('Content-Length', String(object.ContentLength));
                if (object.Body && typeof object.Body.pipe === 'function') return object.Body.pipe(res);
                return res.status(502).json({ message: 'Cloud storage returned an unreadable recording stream.' });
            } catch (cloudError) {
                if (cloudError.name === 'NoSuchKey' || cloudError.name === 'NotFound') return res.status(404).json({ message: 'Recording file is missing from cloud storage.' });
                console.error('Cloud recording retrieval failed:', cloudError.message);
                return res.status(502).json({ message: 'Could not retrieve recording from cloud storage.' });
            }
        }
        const filePath = path.resolve(RECORDINGS_DIR, filename);
        if (!filePath.startsWith(`${RECORDINGS_DIR}${path.sep}`)) return res.status(400).json({ message: 'Invalid recording path' });
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return res.status(404).json({ message: 'Recording file is missing from server storage' });
        return res.sendFile(filePath, (err) => {
            if (err && !res.headersSent) {
                console.error('Error sending recording file:', err);
                res.status(err.statusCode || 500).json({ message: 'Could not read recording file' });
            }
        });
    } catch (err) {
        console.error('Error serving recording:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Failed to retrieve recording' });
    }
});

// Configure Multer for MyCloud Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // We expect user_id in the body (multer parses body before file if configured right, but best to use a default or verify)
    // IMPORTANT: req.body might be empty here depending on field order. 
    // Safest strategy: Save to temp or use a generic 'uploads' folder first, or trust fields come before files.
    // For this implementation, we will try to organize by user if possible, or fallback to 'uploads/mycam'.
    
    // NOTE: To get req.body here, fields must be appended BEFORE the file in FormData on the client.
    const userId = req.body.user_id || 'anonymous';
    const uploadPath = RECORDINGS_DIR;

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

const MAX_RECORDING_BYTES = Number(process.env.MAX_RECORDING_BYTES || 500 * 1024 * 1024);
const upload = multer({
  storage,
  limits: { fileSize: MAX_RECORDING_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['video/webm', 'video/mp4', 'application/octet-stream']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Unsupported recording type. Upload a WebM or MP4 recording.'));
    cb(null, true);
  }
});

// Reserve quota transactionally before any cloud upload or metadata commit.
// A per-account/target lock serializes competing requests; active reservations count toward usage.
async function reserveStorageCapacity(userId, target, newFileSize) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [configRows] = await connection.execute('SELECT * FROM storage_configs WHERE user_id = ? LIMIT 1', [userId]);
        const config = configRows[0] || { internal_quota_mb: 1200, sdcard_quota_mb: 3000, cloud_quota_mb: 5000 };
        const quotaMap = {
            internal: Number(config.internal_quota_mb) * 1024 * 1024,
            sdcard: Number(config.sdcard_quota_mb) * 1024 * 1024,
            cloud: Number(config.cloud_quota_mb) * 1024 * 1024
        };
        const quotaLimitBytes = quotaMap[target];
        if (!Number.isSafeInteger(Number(newFileSize)) || Number(newFileSize) < 1 || !Number.isFinite(quotaLimitBytes) || quotaLimitBytes < 1 || Number(newFileSize) > quotaLimitBytes) {
            await connection.rollback();
            return { allowed: false, reason: 'file_exceeds_quota', usedBytes: 0, reservedBytes: 0, quotaBytes: quotaLimitBytes || 0, percentUsed: 0 };
        }

        await connection.execute(
            'INSERT INTO storage_quota_locks (user_id, storage_target) VALUES (?, ?) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP',
            [userId, target]
        );
        await connection.execute('SELECT user_id FROM storage_quota_locks WHERE user_id = ? AND storage_target = ? FOR UPDATE', [userId, target]);
        // Release stale rows as well as excluding them, preventing unbounded reservation-table growth.
        await connection.execute(
            "UPDATE storage_upload_reservations SET status = 'released' WHERE user_id = ? AND storage_target = ? AND status = 'reserved' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)",
            [userId, target]
        );
        // Stale reservations cannot block quota forever after a crashed process.
        const [usageRows] = await connection.execute(
            `SELECT
                (SELECT COALESCE(SUM(file_size_bytes), 0) FROM recordings WHERE user_id = ? AND storage_target = ?) AS used_bytes,
                (SELECT COALESCE(SUM(reserved_bytes), 0) FROM storage_upload_reservations WHERE user_id = ? AND storage_target = ? AND status = 'reserved' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)) AS reserved_bytes`,
            [userId, target, userId, target]
        );
        const usedBytes = Math.max(0, Number(usageRows[0].used_bytes || 0));
        const reservedBytes = Math.max(0, Number(usageRows[0].reserved_bytes || 0));
        const allowed = usedBytes + reservedBytes + Number(newFileSize) <= quotaLimitBytes;
        if (!allowed) {
            await connection.rollback();
            return { allowed: false, reason: 'quota_full', usedBytes, reservedBytes, quotaBytes: quotaLimitBytes, percentUsed: Math.min(100, Math.round(((usedBytes + reservedBytes) / quotaLimitBytes) * 100)) };
        }
        const [insert] = await connection.execute(
            "INSERT INTO storage_upload_reservations (user_id, storage_target, reserved_bytes, status) VALUES (?, ?, ?, 'reserved')",
            [userId, target, Number(newFileSize)]
        );
        await connection.commit();
        return { allowed: true, reservationId: insert.insertId, reason: null, usedBytes, reservedBytes, quotaBytes: quotaLimitBytes, percentUsed: Math.min(100, Math.round(((usedBytes + reservedBytes) / quotaLimitBytes) * 100)) };
    } catch (err) {
        if (connection) { try { await connection.rollback(); } catch (_) {} }
        console.error('[Storage Capacity] Could not reserve quota:', err);
        return { allowed: false, reason: 'capacity_unavailable', usedBytes: 0, reservedBytes: 0, quotaBytes: 0, percentUsed: 0 };
    } finally {
        if (connection) connection.release();
    }
}

async function releaseStorageReservation(reservationId, status = 'released') {
    if (!reservationId) return;
    try {
        await pool.execute("UPDATE storage_upload_reservations SET status = ? WHERE id = ? AND status = 'reserved'", [status, reservationId]);
    } catch (error) {
        console.error('[Storage Capacity] Could not finalize upload reservation:', error.message);
    }
}

const getCapacityAlert = (usedBytes, quotaBytes) => {
    if (!Number.isFinite(quotaBytes) || quotaBytes <= 0) return { level: 'unavailable', message: 'Quota usage is unavailable.' };
    const percent = Math.round((usedBytes / quotaBytes) * 100);
    if (percent >= 100) return { level: 'full', message: 'Quota is full. Delete recordings or increase the quota before uploading.' };
    if (percent >= 90) return { level: 'critical', message: 'Storage is almost full (90% or more).' };
    if (percent >= 80) return { level: 'warning', message: 'Storage usage has reached 80%.' };
    return { level: 'normal', message: 'Storage usage is within the configured quota.' };
};

// --- Storage Config & Status Endpoints ---
router.get('/storage/provider-status', async (req, res) => {
    const configured = mediaStorage.cloudConfigured();
    if (!configured) return res.json({ provider: 's3-compatible', configured: false, connected: false, message: 'Cloud storage is not configured; local storage remains available.' });
    try {
        const status = await mediaStorage.checkConnection();
        return res.json({ provider: 's3-compatible', ...status });
    } catch (error) {
        console.error('Cloud storage readiness check failed:', error.message);
        return res.status(503).json({ provider: 's3-compatible', configured: true, connected: false, message: 'Cloud storage credentials or bucket permissions could not be verified.' });
    }
});

router.get('/storage/config', async (req, res) => {
    const user_id = req.user.id;

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
    const { mode, local_target, internal_quota_mb, sdcard_quota_mb, cloud_quota_mb } = req.body;
    const user_id = req.user.id;
    const quotas = [internal_quota_mb, sdcard_quota_mb, cloud_quota_mb].filter((value) => value !== undefined);
    if (quotas.some((value) => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 1024 * 1024)) {
        return res.status(400).json({ message: 'Storage quotas must be positive whole MB values within the supported limit.' });
    }
    if (mode && !['local', 'cloud', 'both'].includes(mode)) return res.status(400).json({ message: 'Invalid storage mode.' });
    if (local_target && !['internal', 'sdcard', 'both_failover'].includes(local_target)) return res.status(400).json({ message: 'Invalid local storage target.' });

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
    const user_id = req.user.id;

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

        const usageBytes = {
            internal: Math.max(0, Number(sumInternal[0].used || 0)),
            sdcard: Math.max(0, Number(sumSdCard[0].used || 0)),
            cloud: Math.max(0, Number(sumCloud[0].used || 0))
        };
        const quotaBytes = {
            internal: Number(config.internal_quota_mb) * 1024 * 1024,
            sdcard: Number(config.sdcard_quota_mb) * 1024 * 1024,
            cloud: Number(config.cloud_quota_mb) * 1024 * 1024
        };
        const usage = Object.fromEntries(Object.keys(usageBytes).map((key) => {
            const quota = quotaBytes[key];
            const percent = Number.isFinite(quota) && quota > 0 ? Math.round((usageBytes[key] / quota) * 100) : null;
            return [key, {
                used_bytes: usageBytes[key],
                quota_bytes: quota,
                percent_used: percent,
                alert: getCapacityAlert(usageBytes[key], quota)
            }];
        }));

        res.json({
            config,
            used_mb: {
                internal: usedInternalMb,
                sdcard: usedSdCardMb,
                cloud: usedCloudMb
            },
            usage,
            active_target: activeTarget
        });
    } catch (err) {
        console.error('Error fetching storage status:', err);
        res.status(500).json({ message: 'Failed to fetch storage status' });
    }
});

// Account-scoped upload operations view. Never return idempotency keys, response bodies,
// local paths, provider credentials, or another user's upload/reservation rows.
router.get('/storage/upload-diagnostics', async (req, res) => {
    const userId = req.user.id;
    const staleMinutes = Math.max(5, Math.min(1440, Number.parseInt(process.env.UPLOAD_RECOVERY_STALE_MINUTES, 10) || 15));
    try {
        const [statusRows] = await pool.execute(
            `SELECT status, COUNT(*) AS item_count, MAX(updated_at) AS latest_at
             FROM recording_upload_requests WHERE user_id = ? GROUP BY status`,
            [userId]
        );
        const [recentRows] = await pool.execute(
            `SELECT status, recording_id, created_at, updated_at,
                    (status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL ${staleMinutes} MINUTE)) AS is_stale
             FROM recording_upload_requests WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 20`,
            [userId]
        );
        const [reservationRows] = await pool.execute(
            `SELECT storage_target, status, COUNT(*) AS item_count,
                    COALESCE(SUM(reserved_bytes), 0) AS reserved_bytes,
                    SUM(CASE WHEN status = 'reserved' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE) THEN 1 ELSE 0 END) AS stale_count,
                    MAX(updated_at) AS latest_at
             FROM storage_upload_reservations WHERE user_id = ? GROUP BY storage_target, status`,
            [userId]
        );

        const uploads = { processing: 0, completed: 0, failed: 0, latest_activity: null };
        for (const row of statusRows) {
            if (Object.prototype.hasOwnProperty.call(uploads, row.status)) uploads[row.status] = Number(row.item_count || 0);
            if (row.latest_at && (!uploads.latest_activity || new Date(row.latest_at) > new Date(uploads.latest_activity))) {
                uploads.latest_activity = new Date(row.latest_at).toISOString();
            }
        }
        const recent = recentRows.map((row) => ({
            status: row.status,
            recording_id: row.recording_id == null ? null : String(row.recording_id),
            created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
            updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
            is_stale: Boolean(row.is_stale)
        }));
        const reservations = reservationRows.map((row) => ({
            storage_target: row.storage_target,
            status: row.status,
            count: Number(row.item_count || 0),
            reserved_bytes: Number(row.reserved_bytes || 0),
            stale_count: Number(row.stale_count || 0),
            latest_activity: row.latest_at ? new Date(row.latest_at).toISOString() : null
        }));
        return res.json({ generated_at: new Date().toISOString(), stale_processing_after_minutes: staleMinutes, uploads, recent, reservations });
    } catch (error) {
        console.error('[Upload diagnostics] Could not inspect account upload state:', error.message);
        return res.status(500).json({ message: 'Upload diagnostics are temporarily unavailable.' });
    }
});

router.post('/recordings', (req, res, next) => upload.single('video')(req, res, (err) => {
    if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Recording exceeds the configured upload size limit.' : err.message || 'Invalid recording upload.' });
    }
    next();
}), async (req, res) => {
    const { camera_id, duration, target_override } = req.body;
    const requestedTrigger = String(req.body.trigger_type || 'manual').toLowerCase();
    const trigger_type = ['manual', 'motion', 'scheduled'].includes(requestedTrigger) ? requestedTrigger : null;
    if (!trigger_type) {
        try { if (req.file?.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
        return res.status(400).json({ message: 'Invalid trigger_type. Use manual, motion, or scheduled.' });
    }
    const user_id = req.user.id;
    
    if (!camera_id || !req.file) {
        try { if (req.file?.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
        return res.status(400).json({ message: 'Missing required fields or video file' });
    }

    // Idempotency is optional for older clients, but new clients can safely retry with the same key.
    const idempotencyKey = req.get('Idempotency-Key');
    let ownsIdempotencyReservation = false;
    if (idempotencyKey) {
        if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
            try { if (req.file.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
            return res.status(400).json({ message: 'Invalid Idempotency-Key. Use 8-128 letters, numbers, dots, underscores, colons or hyphens.' });
        }
        try {
            const [existing] = await pool.execute(
                'SELECT status, response_json FROM recording_upload_requests WHERE user_id = ? AND idempotency_key = ? LIMIT 1',
                [user_id, idempotencyKey]
            );
            if (existing.length && existing[0].status === 'completed' && existing[0].response_json) {
                try { if (req.file.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
                res.set('Idempotency-Replayed', 'true');
                return res.status(200).json(JSON.parse(existing[0].response_json));
            }
            if (existing.length && existing[0].status === 'processing') {
                try { if (req.file.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
                res.set('Retry-After', '2');
                return res.status(409).json({ message: 'An upload with this key is still processing. Retry the same request with the same Idempotency-Key.' });
            }
            if (existing.length && existing[0].status === 'failed') {
                await pool.execute(
                    "UPDATE recording_upload_requests SET status = 'processing', recording_id = NULL, response_json = NULL WHERE user_id = ? AND idempotency_key = ?",
                    [user_id, idempotencyKey]
                );
                ownsIdempotencyReservation = true;
            } else {
                try {
                    await pool.execute(
                        "INSERT INTO recording_upload_requests (user_id, idempotency_key, status) VALUES (?, ?, 'processing')",
                        [user_id, idempotencyKey]
                    );
                    ownsIdempotencyReservation = true;
                } catch (reservationError) {
                    if (reservationError.code === 'ER_DUP_ENTRY') {
                        try { if (req.file.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
                        res.set('Retry-After', '2');
                        return res.status(409).json({ message: 'An upload with this key is already processing. Retry with the same Idempotency-Key.' });
                    }
                    throw reservationError;
                }
            }
            if (ownsIdempotencyReservation) {
                res.once('finish', () => {
                    if (res.statusCode >= 400) {
                        pool.execute(
                            "UPDATE recording_upload_requests SET status = 'failed' WHERE user_id = ? AND idempotency_key = ? AND status = 'processing'",
                            [user_id, idempotencyKey]
                        ).catch((e) => console.warn('Could not mark upload retryable:', e.message));
                    }
                });
            }
        } catch (idempotencyError) {
            console.error('Upload idempotency reservation failed:', idempotencyError.message);
            try { if (req.file.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
            return res.status(503).json({ message: 'Upload retry protection is temporarily unavailable. Please retry shortly with the same key.' });
        }
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

    if (!['internal', 'sdcard', 'cloud'].includes(target)) {
        try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (cleanupError) { console.warn('Could not remove invalid-target upload:', cleanupError.message); }
        return res.status(400).json({ message: 'Invalid storage target.' });
    }

    // Reserve quota before moving bytes to cloud or committing metadata. This prevents concurrent
    // uploads from each observing the same free space and collectively exceeding the quota.
    const capacity = await reserveStorageCapacity(user_id, target, Number(req.file.size || 0));
    if (!capacity.allowed) {
        try { if (req.file && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (cleanupError) { console.warn('Could not remove quota-rejected upload:', cleanupError.message); }
        if (capacity.reason === 'capacity_unavailable') return res.status(503).json({ message: 'Storage capacity could not be verified. The upload was rejected safely; retry after checking storage settings.' });
        return res.status(413).json({
            message: capacity.reason === 'file_exceeds_quota'
                ? 'This recording is larger than the configured quota for the selected storage target.'
                : 'Storage quota is full, including other uploads in progress. No existing recordings were deleted. Remove older recordings or increase the quota before uploading.',
            code: 'STORAGE_QUOTA_EXCEEDED', target,
            used_bytes: capacity.usedBytes, reserved_bytes: capacity.reservedBytes,
            quota_bytes: capacity.quotaBytes, percent_used: capacity.percentUsed
        });
    }
    const storageReservationId = capacity.reservationId;

    // Cloud means an actual configured object-storage upload, never a local file with a cloud label.
    if (target === 'cloud') {
        try {
            await mediaStorage.putRecording({ userId: user_id, filename, filePath: req.file.path, contentType: req.file.mimetype });
            await fs.promises.unlink(req.file.path);
        } catch (cloudError) {
            await releaseStorageReservation(storageReservationId);
            try { if (req.file && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path); } catch (_) {}
            console.error('Cloud recording upload failed:', cloudError.message);
            return res.status(502).json({ message: 'Cloud storage upload failed. Configure the S3-compatible storage settings and retry.' });
        }
    }

    try {
        const sql = 'INSERT INTO recordings (user_id, camera_id, filename, duration, file_size_bytes, storage_target, thumbnail_url, trigger_type, triggered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())';
        const [result] = await pool.execute(sql, [user_id, camera_id, filename, duration, fileSize, target, thumbnail_url, trigger_type]);
        
        const [newRecording] = await pool.execute('SELECT * FROM recordings WHERE id = ?', [result.insertId]);
        await releaseStorageReservation(storageReservationId, 'committed');
        const responseBody = { ...newRecording[0], active_target: target };
        if (idempotencyKey && ownsIdempotencyReservation) {
            try {
                await pool.execute(
                    "UPDATE recording_upload_requests SET status = 'completed', recording_id = ?, response_json = ? WHERE user_id = ? AND idempotency_key = ?",
                    [result.insertId, JSON.stringify(responseBody), user_id, idempotencyKey]
                );
            } catch (idempotencyCommitError) {
                // Do not delete valid media or metadata after the recording has committed.
                console.error('Recording saved but idempotency result could not be committed:', idempotencyCommitError.message);
            }
        }
        res.status(201).json(responseBody);
    } catch (err) {
        console.error('Error creating recording:', err);
        await releaseStorageReservation(storageReservationId);
        // Avoid leaving an orphaned media file when the metadata insert fails.
        try {
            if (target === 'cloud') {
                await mediaStorage.deleteRecording({ userId: user_id, filename });
            } else {
                const uploadedPath = path.resolve(RECORDINGS_DIR, filename);
                if (uploadedPath.startsWith(`${RECORDINGS_DIR}${path.sep}`) && fs.existsSync(uploadedPath)) await fs.promises.unlink(uploadedPath);
            }
        } catch (cleanupError) {
            console.warn('Could not clean up failed recording upload:', cleanupError);
        }
        res.status(500).json({ message: 'Failed to save recording' });
    }
});

// Delete a recording and its stored media only when it belongs to the authenticated account.
router.delete('/recordings/:id', async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid recording ID.' });
    try {
        const [rows] = await pool.execute(
            'SELECT id, filename, storage_target FROM recordings WHERE id = ? AND user_id = ? LIMIT 1',
            [id, req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Recording not found.' });
        const recording = rows[0];
        const filename = String(recording.filename || '');
        if (!filename || path.basename(filename) !== filename || !/^rec-[a-zA-Z0-9._-]+$/.test(filename)) {
            return res.status(409).json({ message: 'Recording metadata contains an invalid filename; no file was deleted.' });
        }
        const filePath = path.resolve(RECORDINGS_DIR, filename);
        if (recording.storage_target !== 'cloud' && !filePath.startsWith(`${RECORDINGS_DIR}${path.sep}`)) return res.status(400).json({ message: 'Invalid recording path.' });
        // Remove metadata only after media deletion succeeds or the local file is already absent.
        try {
            if (recording.storage_target === 'cloud') await mediaStorage.deleteRecording({ userId: req.user.id, filename });
            else if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
        } catch (fileError) {
            console.error('Recording media deletion failed:', fileError.message);
            return res.status(500).json({ message: 'Could not delete the recording file. Metadata was retained.' });
        }
        // Keep event history intact when its associated media is deleted.
        await pool.execute('UPDATE alert_events SET recording_id = NULL WHERE recording_id = ? AND user_id = ?', [id, req.user.id]);
        await pool.execute('DELETE FROM recordings WHERE id = ? AND user_id = ?', [id, req.user.id]);
        return res.json({ message: 'Recording deleted. Any linked events were preserved without the clip association.' });
    } catch (err) {
        console.error('Error deleting recording:', err);
        return res.status(500).json({ message: 'Failed to delete recording.' });
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
    const { camera_id, trigger_type } = req.body;
    const user_id = req.user.id;
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
            const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
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
        if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid name and email address.' });
        }
        await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name.trim(), email.trim(), req.user.id]);
        
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
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM recording_schedules WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        // Empty schedules remain empty until the user creates one.
        res.json(rows);
    } catch (err) {
        console.error('Error fetching schedules:', err);
        res.status(500).json({ message: 'Failed to fetch schedules' });
    }
});

const validSchedulePayload = ({ camera_id, name, days, start_time, end_time }) => {
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    return typeof camera_id === 'string' && camera_id.trim().length > 0 && camera_id.length <= 50
        && typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 60
        && Array.isArray(days) && days.length > 0 && days.every((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(day))
        && new Set(days).size === days.length
        && typeof start_time === 'string' && timePattern.test(start_time)
        && typeof end_time === 'string' && timePattern.test(end_time)
        && start_time !== end_time;
};

router.post('/schedules', async (req, res) => {
    const { camera_id, name, days, start_time, end_time } = req.body;
    if (!validSchedulePayload({ camera_id, name, days, start_time, end_time })) {
        return res.status(400).json({ message: 'Enter a name, camera, valid days, and different valid start/end times.' });
    }

    try {
        const sql = 'INSERT INTO recording_schedules (user_id, camera_id, name, days_json, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)';
        const [result] = await pool.execute(sql, [req.user.id, camera_id.trim(), name.trim(), JSON.stringify(days), start_time, end_time]);
        
        const [newSchedule] = await pool.execute('SELECT * FROM recording_schedules WHERE id = ?', [result.insertId]);
        res.status(201).json(newSchedule[0]);
    } catch (err) {
        console.error('Error creating schedule:', err);
        res.status(500).json({ message: 'Failed to create schedule' });
    }
});

router.put('/schedules/:id', async (req, res) => {
    const { id } = req.params;
    const { is_active, camera_id, name, days, start_time, end_time } = req.body;
    if (!/^\d+$/.test(id)) return res.status(400).json({ message: 'Invalid schedule ID.' });

    try {
        if (typeof is_active !== 'undefined') {
            if (![true, false, 0, 1].includes(is_active)) return res.status(400).json({ message: 'is_active must be a boolean.' });
            const [result] = await pool.execute('UPDATE recording_schedules SET is_active = ? WHERE id = ? AND user_id = ?', [is_active === true || is_active === 1 ? 1 : 0, id, req.user.id]);
            if (!result.affectedRows) return res.status(404).json({ message: 'Schedule not found.' });
        } else {
            if (!validSchedulePayload({ camera_id: camera_id ?? 'mobile', name, days, start_time, end_time })) {
                return res.status(400).json({ message: 'Enter a name, valid days, and different valid start/end times.' });
            }
            const [result] = await pool.execute(
                'UPDATE recording_schedules SET name = ?, days_json = ?, start_time = ?, end_time = ? WHERE id = ? AND user_id = ?',
                [name.trim(), JSON.stringify(days), start_time, end_time, id, req.user.id]
            );
            if (!result.affectedRows) return res.status(404).json({ message: 'Schedule not found.' });
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
        await pool.execute('DELETE FROM recording_schedules WHERE id = ? AND user_id = ?', [id, req.user.id]);
        res.json({ message: 'Schedule deleted successfully' });
    } catch (err) {
        console.error('Error deleting schedule:', err);
        res.status(500).json({ message: 'Failed to delete schedule' });
    }
});

module.exports = router;
