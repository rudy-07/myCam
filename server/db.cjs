const mysql = require('mysql2/promise');
require('dotenv').config();


const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initial Table Check
(async () => {
    try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS password_resets (
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (email)
          )
        `);
        console.log('password_resets table ready');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_zones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                camera_id VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                coordinates_json JSON NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('activity_zones table ready');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS recordings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                camera_id VARCHAR(50) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                duration VARCHAR(20) NOT NULL,
                file_size_bytes BIGINT DEFAULT 0,
                storage_target VARCHAR(20) DEFAULT 'internal',
                thumbnail_url VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('recordings table ready');

        // Recording provenance: distinguish manual clips from event/schedule-triggered clips.
        const [recordingColumns] = await pool.query('SHOW COLUMNS FROM recordings');
        if (!recordingColumns.some((column) => column.Field === 'trigger_type')) {
            await pool.query("ALTER TABLE recordings ADD COLUMN trigger_type VARCHAR(20) NOT NULL DEFAULT 'manual'");
        }
        if (!recordingColumns.some((column) => column.Field === 'triggered_at')) {
            await pool.query('ALTER TABLE recordings ADD COLUMN triggered_at DATETIME NULL');
        }
        console.log('recording provenance columns ready');

        // Durable idempotency records prevent duplicate recordings when a client retries an upload.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recording_upload_requests (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                idempotency_key VARCHAR(128) NOT NULL,
                status ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
                recording_id INT NULL,
                response_json LONGTEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_recording_upload_user_key (user_id, idempotency_key),
                INDEX idx_recording_upload_status_updated (status, updated_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('recording_upload_requests table ready');

        // Storage Settings & Quota Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS storage_configs (
                user_id INT PRIMARY KEY,
                mode VARCHAR(20) DEFAULT 'local',
                local_target VARCHAR(20) DEFAULT 'both_failover',
                internal_quota_mb INT DEFAULT 1200,
                sdcard_quota_mb INT DEFAULT 3000,
                cloud_quota_mb INT DEFAULT 5000,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('storage_configs table ready');

        // Durable upload reservations serialize quota checks per account and storage target.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS storage_quota_locks (
                user_id INT NOT NULL,
                storage_target VARCHAR(20) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, storage_target),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS storage_upload_reservations (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                storage_target VARCHAR(20) NOT NULL,
                reserved_bytes BIGINT NOT NULL,
                status ENUM('reserved','committed','released') NOT NULL DEFAULT 'reserved',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_storage_reservations_active (user_id, storage_target, status, created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('storage quota locks and upload reservations tables ready');

        // Per-account camera registry used by multi-camera signalling.
        await pool.query(`
            CREATE TABLE IF NOT EXISTS camera_devices (
                id VARCHAR(50) PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                source_label VARCHAR(40) NOT NULL DEFAULT 'Browser broadcaster',
                is_enabled TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_camera_devices_user (user_id, created_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('camera_devices table ready');

        // Durable, account-scoped alert history and delivery preferences.
        await pool.query(`
          CREATE TABLE IF NOT EXISTS alert_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            camera_id VARCHAR(50) NULL,
            event_type VARCHAR(40) NOT NULL DEFAULT 'activity',
            message VARCHAR(500) NOT NULL,
            occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_alert_events_user_time (user_id, occurred_at),
            INDEX idx_alert_events_user_read (user_id, is_read),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        console.log('alert_events table ready');
        // Link persisted alerts to real recordings without requiring every event to have a clip.
        try { await pool.query('ALTER TABLE alert_events ADD COLUMN recording_id INT NULL'); } catch (error) {
            if (!String(error.message || '').includes('Duplicate column')) throw error;
        }
        try { await pool.query('ALTER TABLE alert_events ADD INDEX idx_alert_events_recording (recording_id)'); } catch (error) {
            if (!String(error.message || '').includes('Duplicate key name')) throw error;
        }
        console.log('alert event recording links ready');


        await pool.query(`
          CREATE TABLE IF NOT EXISTS alert_preferences (
            user_id INT PRIMARY KEY,
            motion_alerts TINYINT(1) NOT NULL DEFAULT 1,
            dashboard_toasts TINYINT(1) NOT NULL DEFAULT 1,
            browser_notifications TINYINT(1) NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        console.log('alert_preferences table ready');

        // Scheduled Recording Rules Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recording_schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                camera_id VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL,
                days_json JSON NOT NULL,
                start_time VARCHAR(10) NOT NULL,
                end_time VARCHAR(10) NOT NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('recording_schedules table ready');

        // Migration helper: add columns if table existed without them
        try {
            await pool.query(`ALTER TABLE recordings ADD COLUMN file_size_bytes BIGINT DEFAULT 0`);
        } catch (e) {}
        try {
            await pool.query(`ALTER TABLE recordings ADD COLUMN storage_target VARCHAR(20) DEFAULT 'internal'`);
        } catch (e) {}

    } catch (err) {
        console.error('Error creating tables:', err);
    }
})();

module.exports = pool;
