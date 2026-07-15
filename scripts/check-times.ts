import { db } from "../src/lib/db";
import { seminars } from "../src/lib/schema";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db
      .select({
        id: seminars.id,
        title: seminars.title,
        startTime: seminars.startTime,
        endTime: seminars.endTime,
        date: seminars.date,
        useManual: seminars.useManual,
        isActive: seminars.isActive,
        isCompleted: seminars.isCompleted,
      })
      .from(seminars)
      .where(
        sql`${seminars.isDeleted} = false AND ${seminars.useManual} = true AND ${seminars.isActive} = true AND ${seminars.isCompleted} = false`,
      )
      .orderBy(sql`date DESC`);

    console.log(`Total seminar: ${result.length}`);
    for (const row of result) {
      console.log(`"${row.title}"`);
      console.log(`  date: ${row.date}`);
      console.log(`  startTime: "${row.startTime}"`);
      console.log(`  endTime: "${row.endTime}"`);
      console.log(`  useManual: ${row.useManual}`);
      console.log(`  isActive: ${row.isActive}`);
      console.log(`  isCompleted: ${row.isCompleted}`);
      console.log("---");
    }
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();