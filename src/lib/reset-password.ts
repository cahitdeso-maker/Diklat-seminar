import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";

async function resetAdminPassword() {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  console.log("New hash:", hashedPassword);

  await db
    .update(users)
    .set({ password: hashedPassword })
    .where(eq(users.role, "admin"));

  // Verify
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (admin) {
    const verify = await bcrypt.compare("admin123", admin.password!);
    console.log("Verification test:", verify ? "PASS" : "FAIL");
    console.log("Stored hash in DB:", admin.password);
  }

  console.log("Password admin telah direset ke: admin123");
}

resetAdminPassword()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
