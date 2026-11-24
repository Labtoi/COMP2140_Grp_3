import { IMenuRepository, INutritionRepository, IPreplistRepository } from '../../src/interfaces';
import { InMemoryMsRepository } from '../fakes/InMemoryMsRepository';

export type FullRepo = IMenuRepository & INutritionRepository & IPreplistRepository;

/**
 * Every test file calls this to get a fresh, EMPTY repository.
 * To run the same tests against the real thing, return your SQL repository here instead, e.g.
 *   await testPool.query('TRUNCATE meals, sides, prep RESTART IDENTITY CASCADE');
 *   return new SqlMSRepository(testPool);
 */
export async function makeRepo(): Promise<FullRepo> {
  return new InMemoryMsRepository();
}
