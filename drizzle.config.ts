import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: "127.0.0.1",
    port: 3307,
    user: "root",
    password: "Mahmudd",
    database: "presensi_diklat",
  },
} satisfies Config;
