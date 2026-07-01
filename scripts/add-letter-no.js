const mysql = require("mysql2/promise");
async function run() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3307,
    user: "root",
    password: "Mahmudd",
    database: "presensi_diklat",
  });
  try {
    // Check if column already exists
    const [rows] = await conn.execute(
      "SHOW COLUMNS FROM certificate_number_settings LIKE 'letter_no'",
    );
    if (rows.length === 0) {
      await conn.execute(
        "ALTER TABLE certificate_number_settings ADD COLUMN letter_no varchar(50) NOT NULL DEFAULT '' AFTER letter_prefix",
      );
      console.log("Column letter_no added successfully");
    } else {
      console.log("Column letter_no already exists");
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}
run();
