import { db } from "./src/lib/db";
import { users } from "./src/lib/schema";
import crypto from "crypto";

async function main() {
  const rows = await db.select().from(users).limit(5);
  for (const u of rows) {
    console.log(JSON.stringify({ id: u.id, email: u.email, role: u.role, password: u.password }));
  }
  const hash = crypto.createHash("sha256").update("admin123").digest("hex");
  console.log("sha256(admin123)=", hash);
}
main().catch((e) => { console.error(e); process.exit(1); });
