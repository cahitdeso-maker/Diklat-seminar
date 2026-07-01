import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function seed() {
  console.log("🌱 Seeding database for Seminar Attendance System...");

  // Admin dengan SHA-256 hash password: admin123
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@diklat.rs"))
    .limit(1);

  if (!existingAdmin) {
    const adminPasswordHash =
      "e8fd7ad21ae11300a5c9346899d8026c8d5eb6fe35ec48775e6d62a404bb447b";

    await db.insert(users).values({
      id: generateId(),
      role: "admin",
      fullName: "Admin Diklat RS",
      email: "admin@diklat.rs",
      password: adminPasswordHash,
      isActive: true,
    });
    console.log("✅ Admin created: admin@diklat.rs / admin123");
  } else {
    console.log("ℹ️ Admin already exists");
  }

  console.log("✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
