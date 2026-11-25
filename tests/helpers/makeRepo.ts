import { config } from 'dotenv';
import { IMenuRepository, INutritionRepository, IPreplistRepository } from '../../shared/src/interfaces';
import { InMemoryMsRepository } from '../fakes/InMemoryMsRepository';

// Optional test-database settings live in .env.test (keep it out of git).
config({ path: '.env.test', quiet: true });

export type FullRepo = IMenuRepository & INutritionRepository & IPreplistRepository;

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_KEY;

/** True when .env.test points the contract tests at a real Supabase project instead of the in-memory fake. */
export const usingRealDb = Boolean(url && key);

/**
 * Every contract test calls this to get a fresh, EMPTY repository.
 *
 * Default: the in-memory fake, so `npm test` needs no database.
 * With TEST_SUPABASE_URL and TEST_SUPABASE_KEY in .env.test: the real SqlMSRepository against that project.
 * WARNING: that mode DELETES EVERY ROW in sql_database_meals, sql_database_sides and prep.
 * Use a separate test project, never the live one.
 */
export async function makeRepo(): Promise<FullRepo> {
  if (!usingRealDb) return new InMemoryMsRepository();

  const { createClient } = await import('@supabase/supabase-js');
  const { SqlMSRepository } = await import('../../shared/src/repositories/SqlMSRepository');
  const db = createClient(url!, key!, { auth: { persistSession: false } });

  // prep rows are removed with their dish (ON DELETE CASCADE); the explicit delete covers stray rows.
  for (const [table, column] of [['prep', 'item_name'], ['sql_database_meals', 'name'], ['sql_database_sides', 'name']] as const) {
    const { error } = await db.from(table).delete().neq(column, '');
    if (error) throw new Error(`could not clear ${table}: ${error.message}`);
  }
  return new SqlMSRepository(db);
}
