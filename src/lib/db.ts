import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const poolConnection = mysql.createPool({
  host: "127.0.0.1",
  port: 3307,
  user: "root",
  password: "Mahmudd",
  database: "presensi_diklat",
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(poolConnection, { schema, mode: "default" });
