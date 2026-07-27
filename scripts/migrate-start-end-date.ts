import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Menambahkan kolom start_date dan end_date ke tabel seminars...");
  
  try {
    await db.execute(sql`ALTER TABLE "seminars" ADD COLUMN IF NOT EXISTS "start_date" date;`);
    console.log("✓ Kolom start_date berhasil ditambahkan");
  } catch (e) {
    console.log("Kolom start_date sudah ada atau error:", e);
  }

  try {
    await db.execute(sql`ALTER TABLE "seminars" ADD COLUMN IF NOT EXISTS "end_date" date;`);
    console.log("✓ Kolom end_date berhasil ditambahkan");
  } catch (e) {
    console.log("Kolom end_date sudah ada atau error:", e);
  }

  console.log("Migrasi selesai!");
  process.exit(0);
}

migrate();