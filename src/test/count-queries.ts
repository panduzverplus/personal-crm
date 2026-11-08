import type postgres from "postgres";
import { db } from "@/db";

/** Runs `action` and returns how many SQL queries the app code sent to the database. */
export async function countQueries(action: () => Promise<unknown>) {
  const { options } = db.$client as postgres.Sql;
  const previous = options.debug;
  let queries = 0;
  options.debug = () => {
    queries += 1;
  };
  try {
    await action();
  } finally {
    options.debug = previous;
  }
  return queries;
}
