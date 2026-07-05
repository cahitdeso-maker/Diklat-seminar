import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting migration: Add face_embedding and face_quality columns...");

  try {
    // Add columns to registrations table
    await db.execute(sql`
      ALTER TABLE registrations 
      ADD COLUMN IF NOT EXISTS face_embedding text,
      ADD COLUMN IF NOT EXISTS face_quality integer
    `);
    console.log("✓ Columns added to registrations table");

    // Add columns to users table
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS face_embedding text,
      ADD COLUMN IF NOT EXISTS face_quality integer
    `);
    console.log("✓ Columns added to users table");

    console.log("\nMigration completed successfully!");
  } catch (error: any) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();