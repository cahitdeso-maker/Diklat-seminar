import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  float,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  role: varchar("role", { length: 20 }).notNull().default("mahasiswa"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  schoolOrigin: varchar("school_origin", { length: 255 }),
  age: int("age"),
  address: text("address"),
  unitId: varchar("unit_id", { length: 36 }),
  faceData: text("face_data"),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const units = mysqlTable("units", {
  id: varchar("id", { length: 36 }).primaryKey(),
  unitName: varchar("unit_name", { length: 255 }).notNull(),
  latitude: float("latitude").notNull(),
  longitude: float("longitude").notNull(),
  radius: int("radius").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const attendances = mysqlTable("attendances", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  scanTime: timestamp("scan_time").notNull(),
  shift: varchar("shift", { length: 10 }).notNull().default("P"),
  isLate: boolean("is_late").notNull().default(false),
  locationMap: text("location_map"),
  photoProof: text("photo_proof"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const certificateTemplates = mysqlTable("certificate_templates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  templateConfig: text("template_config").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(false),
});

export const certificates = mysqlTable("certificates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  templateId: varchar("template_id", { length: 36 }).references(
    () => certificateTemplates.id,
  ),
  title: varchar("title", { length: 255 })
    .notNull()
    .default("Sertifikat Praktik"),
  issuanceDate: varchar("issuance_date", { length: 20 }),
  fileUrl: varchar("file_url", { length: 500 }),
  generatedDate: timestamp("generated_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
