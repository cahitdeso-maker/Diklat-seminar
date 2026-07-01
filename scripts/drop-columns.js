const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3307,
    user: "root",
    password: "Mahmudd",
    database: "presensi_diklat",
  });

  try {
    for (const col of ["latitude", "longitude", "radius"]) {
      const [rows] = await conn.execute(
        "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_NAME = 'seminars' AND COLUMN_NAME = ?",
        [col],
      );
      if (rows[0].cnt > 0) {
        await conn.execute("ALTER TABLE seminars DROP COLUMN " + col);
        console.log("Kolom '" + col + "' berhasil dihapus dari tabel seminars");
      } else {
        console.log("Kolom '" + col + "' sudah tidak ada di tabel seminars");
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await conn.end();
  }
}

main();
