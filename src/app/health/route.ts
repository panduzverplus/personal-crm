import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

// Smoke check after a deploy: the app is running and reaches the database.
export async function GET() {
  await connection();
  await db.execute(sql`select 1`);
  return Response.json({ status: "ok" });
}
