import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: "aws-1-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    user: "postgres.bdzqkxscwgdbnneuhjjh",
    password: "pkugombong21",
    database: "postgres",
    ssl: "require",
  },
} satisfies Config;
