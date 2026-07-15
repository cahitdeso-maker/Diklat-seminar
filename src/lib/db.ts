import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres({
  host: "postgresql://neondb_owner:npg_6BfzbFru0cad@ep-odd-forest-aobh0k79-pooler.c-2.ap-southeast-1.aws.neon.tech/db-seminar?sslmode=require&channel_binding=require",
  port: 5432,
  database: "db-seminar",
  username: "neondb_owner",
  password: "npg_6BfzbFru0cad",
  ssl: "require",
});

export const db = drizzle(client, { schema });