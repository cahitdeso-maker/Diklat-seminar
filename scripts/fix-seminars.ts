import { db } from "../src/lib/db";
import { seminars } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function fix() {
  // Reset seminars happening today (2026-07-04) that were incorrectly marked as completed
  const result = await db
    .update(seminars)
    .set({ isCompleted: false })
    .where(eq(seminars.date, "2026-07-04"));

  console.log("Fixed seminars:", result);

  // Verify
  const all = await db.select().from(seminars);
  console.log("All seminars:", JSON.stringify(all, null, 2));
  process.exit(0);
}

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});