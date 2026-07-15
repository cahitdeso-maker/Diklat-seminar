/**
 * Check actual database schema for face-related tables
 * Run with: npx tsx scripts/check-schema.ts
 */
import postgres from "postgres";

async function main() {
  const client = postgres({
    host: "192.168.12.81",
    port: 5432,
    database: "seminar",
    username: "diklat",
    password: "pkugombong21",
    ssl: "require",
  });

  try {
    // Check registrations columns
    const regCols = await client.unsafe(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'registrations'
      ORDER BY ordinal_position
    `);
    console.log("=== registrations columns ===");
    regCols.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}(${c.character_maximum_length || ''})`));

    // Check users columns
    const userCols = await client.unsafe(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log("\n=== users columns ===");
    userCols.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}(${c.character_maximum_length || ''})`));

    // Check if face_embeddings already exists (partial migration)
    const tables = await client.unsafe(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'face_embeddings'
    `);
    console.log(`\n=== face_embeddings table: ${tables.length > 0 ? 'EXISTS' : 'NOT FOUND'} ===`);

    if (tables.length > 0) {
      const feCols = await client.unsafe(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'face_embeddings'
        ORDER BY ordinal_position
      `);
      feCols.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}`));
    }

    // Check remaining face columns
    const remCols = await client.unsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'registrations'
      AND column_name IN ('face_data', 'face_embedding', 'face_quality')
    `);
    console.log(`\n=== Remaining face columns in registrations: ${remCols.map((c: any) => c.column_name).join(', ') || 'none'} ===`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

main();
