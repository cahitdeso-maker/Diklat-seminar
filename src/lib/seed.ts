import { db } from "./db";
import { users, units, certificateTemplates } from "./schema";
import { generateId } from "./utils";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Create admin user
  const adminId = generateId();
  const hashedPassword = await hashPassword("admin123");

  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!existingAdmin) {
    await db.insert(users).values({
      id: adminId,
      fullName: "Admin Diklat",
      role: "admin",
      password: hashedPassword,
    });
    console.log("Admin user created: username=Admin Diklat, password=admin123");
  } else {
    console.log("Admin user already exists");
  }

  // Create sample units if none exist
  const existingUnits = await db.select().from(units);
  if (existingUnits.length === 0) {
    const sampleUnits = [
      {
        id: generateId(),
        unitName: "Unit IGD",
        latitude: -6.2088,
        longitude: 106.8456,
        radius: 100,
      },
      {
        id: generateId(),
        unitName: "Unit Barokah",
        latitude: -6.21,
        longitude: 106.85,
        radius: 100,
      },
      {
        id: generateId(),
        unitName: "Unit Rawat Inap",
        latitude: -6.209,
        longitude: 106.848,
        radius: 100,
      },
    ];

    for (const unit of sampleUnits) {
      await db.insert(units).values(unit);
    }
    console.log("Sample units created");
  }

  // Create a default certificate template
  const existingTemplates = await db.select().from(certificateTemplates);
  if (existingTemplates.length === 0) {
    await db.insert(certificateTemplates).values({
      id: generateId(),
      templateName: "Tema Default",
      templateConfig: JSON.stringify({
        primaryColor: "#2563eb",
        secondaryColor: "#1e40af",
        fontFamily: "helvetica",
      }),
      isActive: true,
    });
    console.log("Default certificate template created");
  }

  console.log("Database seeding completed!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
