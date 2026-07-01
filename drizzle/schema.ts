import { mysqlTable, mysqlSchema, AnyMySqlColumn, foreignKey, primaryKey, varchar, timestamp, text, index, int, datetime, date, unique, float, tinyint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const attendances = mysqlTable("attendances", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	scanTime: timestamp("scan_time", { mode: 'string' }).notNull(),
	shift: varchar({ length: 10 }).default('P').notNull(),
	isLate: tinyint("is_late").default(0).notNull(),
	locationMap: text("location_map"),
	photoProof: text("photo_proof"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
	method: varchar({ length: 20 }).default('face'),
},
(table) => [
	primaryKey({ columns: [table.id], name: "attendances_id"}),
]);

export const biometricRegistrations = mysqlTable("biometric_registrations", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	credentialId: text("credential_id").notNull(),
	publicKey: text("public_key").notNull(),
	counter: int().default(0).notNull(),
	deviceName: varchar("device_name", { length: 255 }).default(''),
	biometricType: varchar("biometric_type", { length: 20 }).default('fingerprint'),
	isActive: tinyint("is_active").default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("user_id").on(table.userId),
	primaryKey({ columns: [table.id], name: "biometric_registrations_id"}),
]);

export const certificateTemplates = mysqlTable("certificate_templates", {
	id: varchar({ length: 36 }).notNull(),
	templateName: varchar("template_name", { length: 255 }).notNull(),
	templateConfig: text("template_config").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	isActive: tinyint("is_active").default(0).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "certificate_templates_id"}),
]);

export const certificates = mysqlTable("certificates", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	templateId: varchar("template_id", { length: 36 }).references(() => certificateTemplates.id),
	title: varchar({ length: 255 }).default('Sertifikat Praktik').notNull(),
	issuanceDate: varchar("issuance_date", { length: 20 }),
	fileUrl: varchar("file_url", { length: 500 }),
	generatedDate: timestamp("generated_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "certificates_id"}),
]);

export const registrations = mysqlTable("registrations", {
	id: varchar({ length: 36 }).notNull(),
	seminarId: varchar("seminar_id", { length: 36 }).notNull().references(() => seminars.id),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	email: varchar({ length: 255 }),
	phoneNumber: varchar("phone_number", { length: 30 }),
	institution: varchar({ length: 255 }),
	profession: varchar({ length: 100 }),
	faceData: text("face_data"),
	qrCode: varchar("qr_code", { length: 255 }),
	isPresent: tinyint("is_present").default(0).notNull(),
	presentTime: datetime("present_time", { mode: 'string'}),
	presentMethod: varchar("present_method", { length: 20 }),
	certificateSent: tinyint("certificate_sent").default(0).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("seminar_id").on(table.seminarId),
	primaryKey({ columns: [table.id], name: "registrations_id"}),
]);

export const schedules = mysqlTable("schedules", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	checkInHour: int("check_in_hour").default(7).notNull(),
	checkInMinute: int("check_in_minute").default(0).notNull(),
	checkOutHour: int("check_out_hour").default(14).notNull(),
	checkOutMinute: int("check_out_minute").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "schedules_id"}),
]);

export const seminars = mysqlTable("seminars", {
	id: varchar({ length: 36 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	// you can use { mode: 'date' }, if you want to have Date as type for this column
	date: date({ mode: 'string' }).notNull(),
	startTime: varchar("start_time", { length: 10 }),
	endTime: varchar("end_time", { length: 10 }),
	location: varchar({ length: 255 }),
	maxParticipants: int("max_participants").default(0),
	useQr: tinyint("use_qr").default(1).notNull(),
	useFace: tinyint("use_face").default(1).notNull(),
	isActive: tinyint("is_active").default(1).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "seminars_id"}),
]);

export const settings = mysqlTable("settings", {
	id: varchar({ length: 36 }).notNull(),
	settingKey: varchar("setting_key", { length: 100 }).notNull(),
	settingValue: text("setting_value").notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "settings_id"}),
	unique("setting_key").on(table.settingKey),
]);

export const speakers = mysqlTable("speakers", {
	id: varchar({ length: 36 }).notNull(),
	seminarId: varchar("seminar_id", { length: 36 }).notNull().references(() => seminars.id),
	name: varchar({ length: 255 }).notNull(),
	topic: text(),
	displayOrder: int("display_order").default(1).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => [
	index("seminar_id").on(table.seminarId),
	primaryKey({ columns: [table.id], name: "speakers_id"}),
]);

export const units = mysqlTable("units", {
	id: varchar({ length: 36 }).notNull(),
	unitName: varchar("unit_name", { length: 255 }).notNull(),
	latitude: float().notNull(),
	longitude: float().notNull(),
	radius: int().default(100).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "units_id"}),
]);

export const users = mysqlTable("users", {
	id: varchar({ length: 36 }).notNull(),
	role: varchar({ length: 20 }).default('mahasiswa').notNull(),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	email: varchar({ length: 255 }),
	schoolOrigin: varchar("school_origin", { length: 255 }),
	age: int(),
	address: text(),
	unitId: varchar("unit_id", { length: 36 }),
	faceData: text("face_data"),
	password: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`(now())`).notNull(),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	dateOfBirth: varchar("date_of_birth", { length: 20 }),
	phoneNumber: varchar("phone_number", { length: 30 }),
	homeAddress: text("home_address"),
	institutionName: varchar("institution_name", { length: 255 }),
	studyProgram: varchar("study_program", { length: 255 }),
	semester: int(),
	practiceStartDate: varchar("practice_start_date", { length: 20 }),
	practiceEndDate: varchar("practice_end_date", { length: 20 }),
	practiceDurationWeeks: int("practice_duration_weeks"),
	stase: varchar({ length: 100 }),
	staseLainnya: varchar("stase_lainnya", { length: 100 }),
	diplomaFile: text("diploma_file"),
	isActive: tinyint("is_active").default(1).notNull(),
	isDeleted: tinyint("is_deleted").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "users_id"}),
]);
