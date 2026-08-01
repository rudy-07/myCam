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
