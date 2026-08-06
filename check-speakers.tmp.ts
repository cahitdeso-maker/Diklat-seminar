import { db } from "./src/lib/db";
import { speakers, seminars } from "./src/lib/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== SEMINARS ===");
  const semRows = await db
    .select({ id: seminars.id, title: seminars.title })
    .from(seminars)
    .limit(30);
  console.log("Total seminars (max 30):", semRows.length);
  for (const s of semRows) {
    console.log(`  ${s.id} | ${s.title}`);
  }

  console.log("\n=== SPEAKERS (aggregate) ===");
  const agg = await db
    .select({
      total: sql<number>`count(*)`,
      withTopic: sql<number>`count(topic)`,
      deleted: sql<number>`count(*) FILTER (WHERE is_deleted = true)`,
    })
    .from(speakers);
  console.log(JSON.stringify(agg, null, 2));

  console.log("\n=== SPEAKERS (sample rows) ===");
  const spRows = await db
    .select({
      id: speakers.id,
      seminarId: speakers.seminarId,
      name: speakers.name,
      topic: speakers.topic,
      displayOrder: speakers.displayOrder,
      isDeleted: speakers.isDeleted,
    })
    .from(speakers)
    .orderBy(speakers.createdAt)
    .limit(50);
  for (const sp of spRows) {
    console.log(
      `  [${sp.isDeleted ? "DELETED" : "active"}] order=${sp.displayOrder} | sem=${sp.seminarId} | ${sp.name} | topic=${JSON.stringify(sp.topic)}`,
    );
  }
  console.log("Speaker sample count:", spRows.length);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("DIAGNOSTIC ERROR:", e);
    process.exit(1);
  });
