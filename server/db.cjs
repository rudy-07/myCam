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
                thumbnail_url VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('recordings table ready');

    } catch (err) {
        console.error('Error creating tables:', err);
    }
})();

module.exports = pool;
