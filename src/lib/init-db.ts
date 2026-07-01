import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: "file:./data/database.sqlite",
});

const db = drizzle(client, { schema });

async function initDatabase() {
  // Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'mahasiswa',
      full_name TEXT NOT NULL,
      school_origin TEXT,
      age INTEGER,
      address TEXT,
      unit_id TEXT,
      face_data TEXT,
      password TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      unit_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS attendances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      scan_time TEXT NOT NULL,
      shift TEXT NOT NULL DEFAULT 'P',
      is_late INTEGER NOT NULL DEFAULT 0,
      location_map TEXT,
      photo_proof TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS certificate_templates (
      id TEXT PRIMARY KEY,
      template_name TEXT NOT NULL,
      template_config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 0
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      template_id TEXT REFERENCES certificate_templates(id),
      title TEXT NOT NULL DEFAULT 'Sertifikat Praktik',
      issuance_date TEXT,
      file_url TEXT,
      generated_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log("Database initialized successfully!");
}

initDatabase().catch(console.error);
