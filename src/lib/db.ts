import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const poolConnection = mysql.createPool({
  host: "aws-1-ap-southeast-1.pooler.supabase.com",
  port: 5432,
  user: "postgres.bdzqkxscwgdbnneuhjjh",
  password: "pkugombong21",
  database: "postgres",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(poolConnection, { schema, mode: "default" });
