import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: "192.168.12.81",
    port: 5432,
    user: "diklat",
    password: "pkugombong21",
    database: "seminar",
    ssl: "require",
  },
} satisfies Config;
