import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres({
  host: "ep-patient-paper-azhqn296-pooler.c-3.ap-southeast-1.aws.neon.tech",
  port: 5432,
  database: "neondb",
  username: "neondb_owner",
  password: "npg_JiCPEZO0ruF5",
  ssl: "require",
});

export const db = drizzle(client, { schema });