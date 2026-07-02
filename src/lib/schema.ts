import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  real,
  date,
  uuid,
} from "drizzle-orm/pg-core";

// ================================
// TABEL ADMIN / PANITIA DIKLAT
// ================================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: varchar("role", { length: 20 }).notNull().default("admin"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  password: varchar("password", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 30 }),
  schoolOrigin: varchar("school_origin", { length: 255 }),
  age: integer("age"),
  address: text("address"),
  unitId: uuid("unit_id"),
  faceData: text("face_data"),
  placeOfBirth: varchar("place_of_birth", { length: 255 }),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  homeAddress: text("home_address"),
  institutionName: varchar("institution_name", { length: 255 }),
  studyProgram: varchar("study_program", { length: 255 }),
  semester: integer("semester"),
  practiceStartDate: varchar("practice_start_date", { length: 20 }),
  practiceEndDate: varchar("practice_end_date", { length: 20 }),
  practiceDurationWeeks: integer("practice_duration_weeks"),
  stase: varchar("stase", { length: 100 }),
  staseLainnya: varchar("stase_lainnya", { length: 100 }),
  diplomaFile: text("diploma_file"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// TABEL SEMINAR / EVENT
// ================================
export const seminars = pgTable("seminars", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  date: date("date").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  location: varchar("location", { length: 255 }),
  maxParticipants: integer("max_participants").default(0),
  useQr: boolean("use_qr").notNull().default(true),
  useFace: boolean("use_face").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  isCompleted: boolean("is_completed").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// TABEL PENDAFTARAN PESERTA
// ================================
export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  seminarId: uuid("seminar_id")
    .notNull()
    .references(() => seminars.id),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 30 }),
  institution: varchar("institution", { length: 255 }),
  profession: varchar("profession", { length: 100 }),
  faceData: text("face_data"),
  qrCode: varchar("qr_code", { length: 255 }),
  isPresent: boolean("is_present").notNull().default(false),
  presentTime: timestamp("present_time"),
  presentMethod: varchar("present_method", { length: 20 }),
  certificateSent: boolean("certificate_sent").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// SERTIFIKAT
// ================================
export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id),
  seminarId: uuid("seminar_id")
    .notNull()
    .references(() => seminars.id),
  fileUrl: varchar("file_url", { length: 500 }),
  sentVia: varchar("sent_via", { length: 20 }),
  sentAt: timestamp("sent_at"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// PRESENSI / ATTENDANCE
// ================================
export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .notNull()
    .references(() => registrations.id),
  method: varchar("method", { length: 20 }).notNull(), // face, qr, code
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// PEMATERI / SPEAKER
// ================================
export const speakers = pgTable("speakers", {
  id: uuid("id").primaryKey().defaultRandom(),
  seminarId: uuid("seminar_id")
    .notNull()
    .references(() => seminars.id),
  name: varchar("name", { length: 255 }).notNull(),
  topic: text("topic"),
  displayOrder: integer("display_order").notNull().default(1),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ================================
// SETTINGS
// ================================
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
  settingValue: text("setting_value").notNull(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ================================
// PENANDA TANGAN SERTIFIKAT
// ================================
export const signatureSettings = pgTable("signature_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  position: varchar("position", { length: 255 }).notNull(),
  nip: varchar("nip", { length: 30 }),
  signatureImage: varchar("signature_image", { length: 500 }),
  isActive: boolean("is_active").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ================================
// PENGATURAN NOMOR SURAT
// ================================
export const certificateNumberSettings = pgTable(
  "certificate_number_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    letterPrefix: varchar("letter_prefix", { length: 50 })
      .notNull()
      .default("NO : "),
    letterNo: varchar("letter_no", { length: 50 }).notNull().default(""),
    institutionCode: varchar("institution_code", { length: 100 })
      .notNull()
      .default("RSUD"),
    currentNumber: integer("current_number").notNull().default(1),
    year: varchar("year", { length: 4 }).notNull(),
    format: varchar("format", { length: 100 })
      .notNull()
      .default("{prefix}{nomor}/{kode}/{bulan}/{tahun}"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);