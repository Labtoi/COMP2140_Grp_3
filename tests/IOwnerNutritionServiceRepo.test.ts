import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { IOwnerNutritionServiceRepo } from '../shared/src/interfaces';
import { FullRepo, makeRepo } from './helpers/makeRepo';
import { curryGoat, friedPlantain, jerkChicken, riceAndPeas } from './helpers/fixtures';

// IOwnerNutritionServiceRepo = Pick<IMenuRepository, "showAllMeals" | "showAllSides">.
// The Owner can read the nutrition of every meal and side but cannot change anything (SRS TS-6).
// Most of this is enforced by the compiler, so run `npx tsc --noEmit` as well as `npm test`.

/** What an Owner-facing class would be handed: only the two read methods. */
const asOwnerView = (r: FullRepo): IOwnerNutritionServiceRepo => ({
  showAllMeals: () => r.showAllMeals(),
  showAllSides: () => r.showAllSides(),
});

let repo: FullRepo;
let owner: IOwnerNutritionServiceRepo;

beforeEach(async () => {
  repo = await makeRepo();
  owner = asOwnerView(repo);
  await repo.addMeal(jerkChicken());
  await repo.addMeal(curryGoat());
  await repo.addSide(riceAndPeas());
  await repo.addSide(friedPlantain());
});

describe('IOwnerNutritionServiceRepo: shape (checked by tsc)', () => {
  it('exposes exactly showAllMeals and showAllSides', () => {
    expectTypeOf<keyof IOwnerNutritionServiceRepo>().toEqualTypeOf<'showAllMeals' | 'showAllSides'>();
  });

  it('has no write or single-item methods', () => {
    // @ts-expect-error addMeal is not part of the Owner view
    owner.addMeal;
    // @ts-expect-error addSide is not part of the Owner view
    owner.addSide;
    // @ts-expect-error updateMeal is not part of the Owner view
    owner.updateMeal;
    // @ts-expect-error updateSide is not part of the Owner view
    owner.updateSide;
    // @ts-expect-error deleteMeal is not part of the Owner view
    owner.deleteMeal;
    // @ts-expect-error deleteSide is not part of the Owner view
    owner.deleteSide;
    // @ts-expect-error getMeal is not part of the Owner view
    owner.getMeal;
    expect(true).toBe(true);
  });

  it('can be satisfied by an object that has only the two read methods', () => {
    const minimal: IOwnerNutritionServiceRepo = { showAllMeals: async () => [], showAllSides: async () => [] };
    expect(Object.keys(minimal).sort()).toEqual(['showAllMeals', 'showAllSides']);
  });

  it('accepts the full repository too (it is a narrower view of the same thing)', () => {
    const view: IOwnerNutritionServiceRepo = repo;
    expect(typeof view.showAllMeals).toBe('function');
  });
});

describe('IOwnerNutritionServiceRepo: behaviour', () => {
  it('showAllMeals returns every meal with its nutrition values', async () => {
    const meals = await owner.showAllMeals();
    expect(meals.map((m) => m.name).sort()).toEqual(['Curry Goat', 'Jerk Chicken']);
    expect(meals.find((m) => m.name === 'Jerk Chicken')).toMatchObject({
      calories: 190, carbohydrates: 3, protein: 24, sodium: 420, fats: 9, vitamins: 2, allergens: ['soy'],
    });
  });

  it('showAllSides returns every side with its nutrition values', async () => {
    const sides = await owner.showAllSides();
    expect(sides.map((s) => s.name).sort()).toEqual(['Fried Plantain', 'Rice and Peas']);
    expect(sides.find((s) => s.name === 'Rice and Peas')).toMatchObject({ calories: 150, price: 3 });
  });

  it('returns the same data as the full repository', async () => {
    expect(await owner.showAllMeals()).toEqual(await repo.showAllMeals());
    expect(await owner.showAllSides()).toEqual(await repo.showAllSides());
  });

  it('is a live view: changes made by the Chef show up on the next read', async () => {
    await repo.updateMeal('Jerk Chicken', { calories: 175 });
    await repo.addSide({ ...friedPlantain(), name: 'Coleslaw' });
    expect((await owner.showAllMeals()).find((m) => m.name === 'Jerk Chicken')?.calories).toBe(175);
    expect((await owner.showAllSides()).map((s) => s.name)).toContain('Coleslaw');
    await repo.deleteMeal('Curry Goat');
    expect((await owner.showAllMeals()).map((m) => m.name)).toEqual(['Jerk Chicken']);
  });

  it('returns copies: changing what the Owner reads does not change stored data', async () => {
    const meals = await owner.showAllMeals();
    meals[0].calories = 9999;
    meals.pop();
    expect(await repo.showAllMeals()).toHaveLength(2);
    expect((await repo.getMeal(meals[0].name)).calories).not.toBe(9999);
  });

  it('returns empty lists, not errors, when there is nothing on the menu', async () => {
    const empty = asOwnerView(await makeRepo());
    expect(await empty.showAllMeals()).toEqual([]);
    expect(await empty.showAllSides()).toEqual([]);
  });
});

describe('not decided at this level', () => {
  it.todo('TS-6: rejecting a customer or unauthenticated caller needs the Authentication component (DC-7)');
});
