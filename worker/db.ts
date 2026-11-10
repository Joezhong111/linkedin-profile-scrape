import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export type AppDb = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): AppDb {
  return drizzle(d1, { schema });
}

/**
 * D1 allows at most 100 bound parameters per statement. Batch helpers keep
 * `inArray` lists and multi-row inserts comfortably below that limit.
 */
export function chunk<T>(items: T[], size = 90): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
