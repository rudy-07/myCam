const { Server } = require('socket.io');
const auth = require('./auth.cjs');
const pool = require('./db.cjs');

const setupSocket = (server) => {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,https://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
  });
  // Each account can have independent broadcasters. A camera's peers never negotiate
  // with another camera's broadcaster, even when both belong to the same account.
  const broadcasterByCamera = new Map(); // `${userId}:${cameraId}` -> socket id
  const userBySocket = new Map();
  const cameraBySocket = new Map();
  const keyFor = (userId, cameraId) => `${userId}:${cameraId}`;
  const safeCameraId = (value) => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,50}$/.test(value) ? value : 'mobile';

  io.use((socket, next) => {
    const user = auth.verifySessionToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('Authentication required. Please sign in again.'));
    socket.data.userId = String(user.id);
    socket.data.cameraId = safeCameraId(socket.handshake.auth?.cameraId);
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const cameraId = socket.data.cameraId;
    const accountRoom = `user:${userId}`;
    const cameraRoom = `user:${userId}:camera:${cameraId}`;
    socket.join(accountRoom);
    socket.join(cameraRoom);
    userBySocket.set(socket.id, userId);
    cameraBySocket.set(socket.id, cameraId);

    socket.on('broadcaster', (requestedId) => {
      const id = safeCameraId(requestedId || cameraBySocket.get(socket.id));
      const key = keyFor(userId, id);
      const previous = broadcasterByCamera.get(key);
      if (previous && previous !== socket.id) io.to(`user:${userId}:camera:${id}`).emit('disconnectPeer', previous);
      broadcasterByCamera.set(key, socket.id);
      cameraBySocket.set(socket.id, id);
      socket.join(`user:${userId}:camera:${id}`);
      socket.to(`user:${userId}:camera:${id}`).emit('broadcaster');
    });

    socket.on('watcher', (requestedId) => {
      const id = safeCameraId(requestedId || cameraBySocket.get(socket.id));
      const broadcaster = broadcasterByCamera.get(keyFor(userId, id));
      if (broadcaster && broadcaster !== socket.id) io.to(broadcaster).emit('watcher', socket.id, id);
    });

    socket.on('offer', (id, message) => {
      if (userBySocket.get(id) === userId && cameraBySocket.get(id) === cameraId) io.to(id).emit('offer', socket.id, message);
    });
    socket.on('answer', (id, message) => {
      if (userBySocket.get(id) === userId && cameraBySocket.get(id) === cameraId) io.to(id).emit('answer', socket.id, message);
    });
    socket.on('candidate', (id, message) => {
      const targetId = id === 'broadcaster' ? broadcasterByCamera.get(keyFor(userId, cameraId)) : id;
      if (targetId && userBySocket.get(targetId) === userId && cameraBySocket.get(targetId) === cameraId) io.to(targetId).emit('candidate', socket.id, message);
    });
    socket.on('change-quality', (quality) => {
      const broadcaster = broadcasterByCamera.get(keyFor(userId, cameraId));
      if (broadcaster) io.to(broadcaster).emit('change-quality', quality);
    });
    let lastAlertAt = 0;
    const persistAndEmitAlert = async (type, message) => {
      const now = Date.now();
      // Avoid a noisy or misconfigured client flooding the durable event history.
      if (now - lastAlertAt < 1500) return;
      lastAlertAt = now;
      const safeType = /^[a-z][a-z0-9_-]{0,39}$/.test(type) ? type : 'activity';
      const safeMessage = String(message || 'Activity reported by a camera').trim().slice(0, 500);
      if (!safeMessage) return;
      try {
        const [prefRows] = await pool.execute(
          'SELECT motion_alerts, dashboard_toasts, browser_notifications FROM alert_preferences WHERE user_id = ?', [userId]
        );
        const prefs = prefRows[0] || { motion_alerts: 1, dashboard_toasts: 1, browser_notifications: 0 };
        if (safeType === 'motion' && !prefs.motion_alerts) return;
        const [result] = await pool.execute(
          'INSERT INTO alert_events (user_id, camera_id, event_type, message) VALUES (?, ?, ?, ?)',
          [userId, cameraId, safeType, safeMessage]
        );
        io.to(accountRoom).emit('smart-alert', {
          id: String(result.insertId), type: safeType, cameraId,
          timestamp: new Date().toISOString(), message: safeMessage,
          dashboardToast: Boolean(prefs.dashboard_toasts), browserNotification: Boolean(prefs.browser_notifications)
        });
      } catch (error) {
        console.error('[Alerts] Could not persist camera event:', error.message);
      }
    };

    socket.on('motion-detected', () => {
      void persistAndEmitAlert('motion', 'Activity / Motion detected on camera feed!');
    });
    socket.on('trigger-alert', (alertData) => {
      const type = typeof alertData?.type === 'string' ? alertData.type : 'activity';
      const message = typeof alertData?.message === 'string' ? alertData.message : 'Activity reported by a camera';
      void persistAndEmitAlert(type, message);
    });
    socket.on('schedule-trigger', (scheduleData) => io.to(accountRoom).emit('schedule-trigger', scheduleData));

    socket.on('disconnect', () => {
      const id = cameraBySocket.get(socket.id) || cameraId;
      const key = keyFor(userId, id);
      if (broadcasterByCamera.get(key) === socket.id) {
        broadcasterByCamera.delete(key);
        socket.to(`user:${userId}:camera:${id}`).emit('disconnectPeer', socket.id);
      }
      userBySocket.delete(socket.id);
      cameraBySocket.delete(socket.id);
    });
  });
  return io;
};

module.exports = setupSocket;
