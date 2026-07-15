import { db } from "../src/lib/db";
import { seminars } from "../src/lib/schema";
import { sql, eq } from "drizzle-orm";

async function main() {
  try {
    // Aktifkan use_manual=true untuk semua seminar yang aktif
    await db
      .update(seminars)
      .set({ useManual: true })
      .where(
        sql`${seminars.isDeleted} = false AND ${seminars.isActive} = true`,
      );
    console.log("✓ use_manual=true untuk seminar aktif");

    // Cek hasilnya
    const result = await db
      .select({
        id: seminars.id,
        title: seminars.title,
        useManual: seminars.useManual,
        isActive: seminars.isActive,
      })
      .from(seminars)
      .where(
        sql`${seminars.isDeleted} = false AND ${seminars.isActive} = true`,
      )
      .orderBy(sql`date DESC`);

    console.log(`\nSeminar aktif dengan use_manual=true: ${result.length}`);
    for (const row of result) {
      console.log(`  - ${row.title} (use_manual: ${row.useManual})`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();