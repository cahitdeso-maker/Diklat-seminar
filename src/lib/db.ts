import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres({
  host: "aws-1-ap-southeast-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  username: "postgres.bdzqkxscwgdbnneuhjjh",
  password: "pkugombong21",
  ssl: "require",
});

export const db = drizzle(client, { schema });