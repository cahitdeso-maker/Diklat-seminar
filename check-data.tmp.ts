import { db } from "./src/lib/db";
import { users, speakers } from "./src/lib/schema";

async function main() {
  const us = await db.select().from(users).limit(10);
  console.log("USERS:", JSON.stringify(us.map(u => ({ id: u.id, email: u.email, role: u.role, pw: u.password }))));
  const sp = await db.select().from(speakers).limit(100);
  console.log("SPEAKERS_COUNT:", sp.length);
  console.log("SPEAKERS:", JSON.stringify(sp.map(s => ({ id: s.id, seminarId: s.seminarId, name: s.name, displayOrder: s.displayOrder, isDeleted: s.isDeleted }))));
}
main().catch((e) => { console.error(e); process.exit(1); });
