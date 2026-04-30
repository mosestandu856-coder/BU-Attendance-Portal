const mysql = require('mysql2/promise');

let pool;

async function initDB() {
  pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'attendance_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Test connection
  const conn = await pool.getConnection();
  await conn.release();

  await createTables();
  console.log('MySQL database connected and tables ready.');
}

async function createTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255),
      reg_number VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS lectures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      period VARCHAR(255) NOT NULL,
      qr_token VARCHAR(255) NOT NULL UNIQUE,
      class_lat DOUBLE,
      class_lng DOUBLE,
      radius_meters DOUBLE DEFAULT 100,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      course_id INT,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      lecture_id INT NOT NULL,
      scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      student_lat DOUBLE,
      student_lng DOUBLE,
      location_valid TINYINT DEFAULT 1,
      UNIQUE KEY unique_attendance (user_id, lecture_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (lecture_id) REFERENCES lectures(id)
    )`,
    `CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      credential_id VARCHAR(512) NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS student_assessments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      lecture_id INT NOT NULL,
      attendance_score DOUBLE DEFAULT 0,
      mid_semester_score DOUBLE DEFAULT 0,
      final_exam_score DOUBLE DEFAULT 0,
      total_score DOUBLE DEFAULT 0,
      grade VARCHAR(10) DEFAULT '',
      grade_point DOUBLE DEFAULT 0,
      remarks TEXT,
      assessed_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_student_assessment (student_id, lecture_id),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (lecture_id) REFERENCES lectures(id)
    )`,
    `CREATE TABLE IF NOT EXISTS lecturer_assessments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lecturer_id INT NOT NULL,
      semester VARCHAR(255) NOT NULL,
      teaching_quality INT DEFAULT 0,
      punctuality INT DEFAULT 0,
      content_delivery INT DEFAULT 0,
      overall_rating DOUBLE DEFAULT 0,
      comments TEXT,
      assessed_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecturer_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS student_lecturer_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      lecturer_id INT NOT NULL,
      lecture_id INT,
      rating INT NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_student_lecture_rating (student_id, lecture_id),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (lecturer_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS semesters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      start_date DATE,
      end_date DATE,
      is_active TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_code VARCHAR(100) NOT NULL UNIQUE,
      course_name VARCHAR(255) NOT NULL,
      semester_id INT,
      lecturer_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (semester_id) REFERENCES semesters(id),
      FOREIGN KEY (lecturer_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS course_enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      course_id INT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'approved',
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_enrollment (student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )`,
    `CREATE TABLE IF NOT EXISTS course_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rater_id INT NOT NULL,
      ratee_id INT NOT NULL,
      course_id INT NOT NULL,
      rater_role VARCHAR(50) NOT NULL,
      score INT NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_course_rating (rater_id, ratee_id, course_id),
      FOREIGN KEY (rater_id) REFERENCES users(id),
      FOREIGN KEY (ratee_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )`,
    `CREATE TABLE IF NOT EXISTS contact_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      sender_name VARCHAR(255) NOT NULL,
      sender_email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL DEFAULT 'General Enquiry',
      message TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'unread',
      admin_reply TEXT,
      replied_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT NOT NULL
    )`,
  ];

  for (const sql of queries) {
    await pool.query(sql);
  }
}

function getPool() {
  return pool;
}

/**
 * Synchronous-style query helper that returns a promise.
 * Usage mirrors the old sql.js prepare() API but returns promises.
 *
 * prepare(sql).get(...params)  → first row or undefined
 * prepare(sql).all(...params)  → array of rows
 * prepare(sql).run(...params)  → { insertId, affectedRows }
 */
function prepare(sql) {
  // Convert SQLite ? placeholders — MySQL also uses ?, so no change needed.
  // Convert SQLite-specific functions to MySQL equivalents at query time.
  const mysqlSql = convertSql(sql);

  return {
    get: async (...params) => {
      const [rows] = await pool.query(mysqlSql, params.flat());
      return rows[0] || undefined;
    },
    all: async (...params) => {
      const [rows] = await pool.query(mysqlSql, params.flat());
      return rows;
    },
    run: async (...params) => {
      const [result] = await pool.query(mysqlSql, params.flat());
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
  };
}

/**
 * Convert SQLite-specific SQL to MySQL-compatible SQL.
 * Also converts NOW() to CURRENT_TIMESTAMP for older MySQL compatibility.
 */
function convertSql(sql) {
  return sql
    // SQLite datetime('now') → MySQL CURRENT_TIMESTAMP
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    // SQLite datetime('now', ...) → MySQL DATE_ADD(NOW(), INTERVAL ...)
    .replace(/datetime\('now',\s*'([+-]\d+)\s+(\w+)'\)/gi, (_, offset, unit) => {
      const n = parseInt(offset);
      const u = unit.toUpperCase().replace(/S$/, '');
      return `DATE_ADD(NOW(), INTERVAL ${n} ${u})`;
    })
    // SQLite DATE('now', ...) → MySQL DATE_ADD(CURDATE(), INTERVAL ...)
    .replace(/DATE\('now',\s*'([+-]\d+)\s+(\w+)'\)/gi, (_, offset, unit) => {
      const n = parseInt(offset);
      const u = unit.toUpperCase().replace(/S$/, '');
      return `DATE_ADD(CURDATE(), INTERVAL ${n} ${u})`;
    })
    // SQLite DATE('now') → MySQL CURDATE()
    .replace(/DATE\('now'\)/gi, 'CURDATE()')
    // strftime('%Y-W%W', col) → DATE_FORMAT(col, '%Y-W%u')
    .replace(/strftime\('%Y-W%W',\s*([^)]+)\)/gi, (_, col) => `DATE_FORMAT(${col.trim()}, '%Y-W%u')`)
    // strftime('%H', col) → HOUR(col)
    .replace(/strftime\('%H',\s*([^)]+)\)/gi, (_, col) => `HOUR(${col.trim()})`)
    // CAST(... AS INTEGER) → CAST(... AS UNSIGNED)
    .replace(/CAST\(([^)]+)\s+AS\s+INTEGER\)/gi, (_, expr) => `CAST(${expr} AS UNSIGNED)`)
    // INSERT OR REPLACE → REPLACE
    .replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'REPLACE INTO')
    // NOW() in queries → CURRENT_TIMESTAMP (for older MySQL 5.x compatibility)
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    ;
}

module.exports = { initDB, getPool, prepare };
