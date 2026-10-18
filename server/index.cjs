const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();
const routes = require('./routes.cjs');
const setupSocket = require('./socket.cjs');
const pool = require('./db.cjs');

const app = express();
app.disable('x-powered-by');
// Enable only when the API is behind exactly one trusted reverse proxy (the supplied Compose topology).
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,https://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed by CORS'));
} }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.send('MyCam Backend Running');
});

// Liveness: confirms the HTTP process is responding.
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness: confirms the service can reach its configured database.
app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', database: 'reachable' });
  } catch (error) {
    console.error('Readiness check failed:', error.message);
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

app.use('/api', routes);

// Recover stale upload reservations after a process crash or forced restart.
// Marking stale requests failed makes them retryable with the same idempotency key.
const UPLOAD_RECOVERY_STALE_MINUTES = Math.max(5, Number(process.env.UPLOAD_RECOVERY_STALE_MINUTES || 15));
async function recoverStaleUploadRequests() {
  try {
    const [result] = await pool.execute(
      `UPDATE recording_upload_requests SET status = 'failed' WHERE status = 'processing' AND updated_at < DATE_SUB(NOW(), INTERVAL ${UPLOAD_RECOVERY_STALE_MINUTES} MINUTE)`
    );
    if (result.affectedRows > 0) console.warn(`[Upload recovery] Marked ${result.affectedRows} stale upload request(s) retryable.`);
  } catch (error) {
    console.error('[Upload recovery] Sweep failed:', error.message);
  }
}
const uploadRecoveryTimer = setInterval(recoverStaleUploadRequests, 5 * 60 * 1000);
uploadRecoveryTimer.unref();
recoverStaleUploadRequests();

// Initialize Socket.io
const io = setupSocket(server);
app.set('io', io);

// Global Error Handler to allow JSON response instead of HTML
app.use((err, req, res, next) => {
  // Detailed failures belong in server logs only; never return SQL, paths, or stack details to clients.
  console.error('Unhandled Server Error:', err?.stack || err?.message || 'Unknown error');
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error. Please try again later.' });
});

const shutdown = (signal) => {
  clearInterval(uploadRecoveryTimer);
  console.log(`${signal} received; shutting down MyCam server`);
  server.close(async (serverError) => {
    try { await pool.end(); } catch (error) { console.error('Database pool shutdown failed:', error.message); }
    process.exit(serverError ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
