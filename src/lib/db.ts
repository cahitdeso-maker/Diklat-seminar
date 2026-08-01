import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE!,
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  ssl: process.env.DB_SSL === "disable" ? false : "require",
});
export const db = drizzle(client, { schema });