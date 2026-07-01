import { db } from "./db";

async function addColumnIfNotExists(
  table: string,
  column: string,
  definition: string,
) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    console.log(`  → Added column ${column} to ${table}`);
  } catch {}
}

async function initDatabase() {
  console.log("📦 Initializing database for Seminar Attendance System...");

  try {
    // Add is_completed column for existing seminars tables (migration helper)
    await addColumnIfNotExists(
      "seminars",
      "is_completed",
      "is_completed BOOLEAN NOT NULL DEFAULT FALSE AFTER is_active",
    );

    // Users table (simplified - admin only)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        role VARCHAR(20) NOT NULL DEFAULT 'admin',
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        password VARCHAR(255),
        phone_number VARCHAR(30),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ users table ready");

    // Seminars table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS seminars (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        start_time VARCHAR(10),
        end_time VARCHAR(10),
        location VARCHAR(255),
        max_participants INT DEFAULT 0,
        use_qr BOOLEAN NOT NULL DEFAULT TRUE,
        use_face BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ seminars table ready");

    // Registrations table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS registrations (
        id VARCHAR(36) PRIMARY KEY,
        seminar_id VARCHAR(36) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone_number VARCHAR(30),
        institution VARCHAR(255),
        profession VARCHAR(100),
        face_data TEXT,
        qr_code VARCHAR(255),
        is_present BOOLEAN NOT NULL DEFAULT FALSE,
        present_time DATETIME,
        present_method VARCHAR(20),
        certificate_sent BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seminar_id) REFERENCES seminars(id)
      )
    `);
    console.log("✅ registrations table ready");

    // Certificates table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR(36) PRIMARY KEY,
        registration_id VARCHAR(36) NOT NULL,
        seminar_id VARCHAR(36) NOT NULL,
        file_url VARCHAR(500),
        sent_via VARCHAR(20),
        sent_at TIMESTAMP,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (registration_id) REFERENCES registrations(id),
        FOREIGN KEY (seminar_id) REFERENCES seminars(id)
      )
    `);
    console.log("✅ certificates table ready");

    // Speakers table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS speakers (
        id VARCHAR(36) PRIMARY KEY,
        seminar_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        topic TEXT,
        display_order INT NOT NULL DEFAULT 1,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seminar_id) REFERENCES seminars(id)
      )
    `);
    console.log("✅ speakers table ready");

    // Settings table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(36) PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ settings table ready");

    console.log("\n🎉 All tables initialized successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    process.exit(1);
  }
}

initDatabase();
