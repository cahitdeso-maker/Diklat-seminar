import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Menambahkan kolom use_manual ke tabel seminars...");
    await db.execute(
      sql.raw(
        'ALTER TABLE "seminars" ADD COLUMN IF NOT EXISTS "use_manual" boolean NOT NULL DEFAULT false',
      ),
    );
    console.log("✓ Kolom use_manual berhasil ditambahkan");
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();