CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"method" varchar(20) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_number_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_number" integer,
	"certificate_code" varchar(255),
	"registration_id" text,
	"seminar_id" text,
	"month_roman" varchar(10),
	"is_config" boolean DEFAULT false NOT NULL,
	"letter_prefix" varchar(50) DEFAULT 'NO : ' NOT NULL,
	"institution_code" varchar(100) DEFAULT 'RSUD' NOT NULL,
	"letter_type" varchar(20) DEFAULT 'KET' NOT NULL,
	"unit_code" varchar(50) DEFAULT 'IV.6.AU' NOT NULL,
	"classification" varchar(10) DEFAULT 'A' NOT NULL,
	"year" varchar(4) NOT NULL,
	"format" varchar(100) DEFAULT '{prefix}{nomor}/{kode}/{bulan}/{tahun}' NOT NULL,
	"participant_name" varchar(255) DEFAULT '' NOT NULL,
	"next_certificate_number" integer,
	"reset_option" varchar(20) DEFAULT 'per_tahun' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"title" varchar(255) NOT NULL,
	"issuance_date" varchar(50),
	"file_url" varchar(500),
	"generated_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"certificate_number" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "face_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"descriptor" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seminar_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone_number" varchar(30),
	"institution" varchar(255),
	"profession" varchar(100),
	"qr_code" varchar(255),
	"is_present" boolean DEFAULT false NOT NULL,
	"present_time" timestamp,
	"present_method" varchar(20),
	"certificate_sent" boolean DEFAULT false NOT NULL,
	"certificate_number" integer,
	"certificate_code" varchar(255),
	"certificate_generated_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seminars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"end_date" date,
	"start_time" varchar(10),
	"end_time" varchar(10),
	"location" varchar(255),
	"max_participants" integer DEFAULT 0,
	"use_qr" boolean DEFAULT true NOT NULL,
	"use_face" boolean DEFAULT true NOT NULL,
	"use_manual" boolean DEFAULT false NOT NULL,
	"presensi_open" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" varchar(100) NOT NULL,
	"setting_value" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "signature_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"nip" varchar(30),
	"signature_image" varchar(500),
	"signature_width" integer DEFAULT 500,
	"signature_height" integer DEFAULT 150,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seminar_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"topic" text,
	"display_order" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar(20) DEFAULT 'admin' NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"password" varchar(255),
	"phone_number" varchar(30),
	"school_origin" varchar(255),
	"age" integer,
	"address" text,
	"place_of_birth" varchar(255),
	"date_of_birth" varchar(20),
	"home_address" text,
	"institution_name" varchar(255),
	"study_program" varchar(255),
	"semester" integer,
	"practice_start_date" varchar(20),
	"practice_end_date" varchar(20),
	"practice_duration_weeks" integer,
	"stase" varchar(100),
	"stase_lainnya" varchar(100),
	"diploma_file" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_seminar_id_seminars_id_fk" FOREIGN KEY ("seminar_id") REFERENCES "public"."seminars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_seminar_id_seminars_id_fk" FOREIGN KEY ("seminar_id") REFERENCES "public"."seminars"("id") ON DELETE no action ON UPDATE no action;