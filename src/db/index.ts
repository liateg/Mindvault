import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as appSchema from "./schema.js";
import * as authSchema from "./auth-schema.js";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const pool = new Pool({
  connectionString,
});

export const schema = {
  ...authSchema,
  ...appSchema,
};

export const db = drizzle({ client: pool, schema });