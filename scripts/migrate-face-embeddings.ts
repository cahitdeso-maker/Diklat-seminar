/**
 * Migration script: Add face_embeddings table + drop old columns
 *
 * Run with: npx tsx scripts/migrate-face-embeddings.ts
 */
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=== Migration: face_embeddings table ===");

  // Read the migration SQL
  const sqlPath = path.join(__dirname, "..", "drizzle", "0009_add_face_embeddings.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Migration SQL loaded:", sqlPath);

  // Connect to database (same config as src/lib/db.ts)
  const client = postgres({
    host: "192.168.12.81",
    port: 5432,
    database: "seminar",
    username: "diklat",
    password: "pkugombong21",
    ssl: "require",
  });

  try {
    console.log("Connected to database.");

    // Strip all comment lines (-- ...) and empty lines before parsing SQL
    const cleanSql = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");

    // Split by semicolon and filter empty statements
    const statements = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute.`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 80).replace(/\n/g, " ");
      console.log(`\n[${i + 1}/${statements.length}] ${preview}...`);
      try {
        await client.unsafe(stmt);
        console.log("  ✓");
      } catch (err: any) {
        const msg = err.message || "";
        if (msg.includes("does not exist")) {
          console.log("  ⚠ Column/table already removed, skipping");
        } else if (msg.includes("already exists")) {
          console.log("  ⚠ Already exists, skipping");
        } else {
          throw err;
        }
      }
    }

    console.log("\n=== Migration completed successfully! ===");

    // Verify the migration
    const tables = await client.unsafe(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'face_embeddings'
    `);
    if (tables.length > 0) {
      console.log("✓ face_embeddings table exists");
    } else {
      console.log("✗ face_embeddings table NOT found");
    }

    const columns = await client.unsafe(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'registrations' 
      AND column_name IN ('face_data', 'face_embedding', 'face_quality')
    `);
    if (columns.length === 0) {
      console.log("✓ Old columns removed from registrations");
    } else {
      console.log("⚠ Old columns still exist:", columns.map((c: any) => c.column_name).join(", "));
    }

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Connection closed.");
  }
}

main();
