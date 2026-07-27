import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Menghapus kolom start_date dari tabel seminars...");
  
  try {
    await db.execute(sql`ALTER TABLE "seminars" DROP COLUMN IF EXISTS "start_date";`);
    console.log("✓ Kolom start_date berhasil dihapus");
  } catch (e) {
    console.log("Error:", e);
  }

  console.log("Selesai!");
  process.exit(0);
}

migrate();