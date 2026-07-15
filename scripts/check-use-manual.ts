import { db } from "../src/lib/db";
import { seminars } from "../src/lib/schema";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db
      .select({
        id: seminars.id,
        title: seminars.title,
        useManual: seminars.useManual,
        useQr: seminars.useQr,
        useFace: seminars.useFace,
        isActive: seminars.isActive,
        isCompleted: seminars.isCompleted,
        isDeleted: seminars.isDeleted,
        presensiOpen: seminars.presensiOpen,
      })
      .from(seminars)
      .orderBy(sql`date DESC`)
      .limit(20);

    console.log("=== Data Seminar ===");
    console.log(`Total: ${result.length} seminar`);
    console.log("");

    for (const row of result) {
      console.log(`ID: ${row.id}`);
      console.log(`Judul: ${row.title}`);
      console.log(`use_manual: ${row.useManual}`);
      console.log(`use_qr: ${row.useQr}`);
      console.log(`use_face: ${row.useFace}`);
      console.log(`is_active: ${row.isActive}`);
      console.log(`is_completed: ${row.isCompleted}`);
      console.log(`is_deleted: ${row.isDeleted}`);
      console.log(`presensi_open: ${row.presensiOpen}`);
      console.log("---");
    }

    const manualActive = result.filter(
      (r) =>
        r.useManual === true &&
        r.isDeleted === false &&
        r.isActive === true &&
        r.isCompleted === false,
    ).length;
    console.log(
      `\nSeminar useManual=true + isActive=true + isCompleted=false: ${manualActive}`,
    );
    console.log(
      `Seminar useManual=false: ${result.filter((r) => r.useManual === false).length}`,
    );
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();