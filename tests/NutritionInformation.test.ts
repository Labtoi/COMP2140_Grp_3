import { beforeEach, describe, expect, it } from 'vitest';
import {
  NutritionInformation, NotFoundError, UnauthorizedError, ValidationError, hasNutritionData,
} from '../src/mainClasses/NutritionInformation';
import { ALLERGENS_UNAVAILABLE, NUTRITION_UNAVAILABLE, type Actor, type NutritionFacts } from '../src/mainClasses/NutritionInformation';
import type { Dish } from '../src/models';
import type { IOwnerNutritionServiceRepo } from '../src/interfaces';
import { InMemoryMsRepository } from './fakes/InMemoryMsRepository';
import { chopOnions } from './helpers/fixtures';

// Service tests always use the in-memory fake: they check NutritionInformation's rules, not the database.
// SRS Req 3: TS-1 to TS-6. The Owner is read-only per the class diagram (IOwnerNutritionServiceRepo).

const chef: Actor = { id: 'chef', role: 'chef' };
const owner: Actor = { id: 'owner', role: 'owner' };
const customer: Actor = { id: 'guest', role: 'customer' };

const facts: NutritionFacts = { calories: 100, protein: 10, carbohydrates: 20, fats: 5, sodium: 200, vitamins: 2 };
const withData = (): Dish => ({ name: 'Test Chicken', details: 'grilled', price: 12.5, ...facts, allergens: ['soy'], prepList: [] });
const noData = (): Dish => ({
  name: 'Mystery Stew', details: '', price: 10,
  calories: 0, protein: 0, carbohydrates: 0, fats: 0, sodium: 0, vitamins: 0, allergens: [], prepList: [],
});

let repo: InMemoryMsRepository;
let svc: NutritionInformation;

beforeEach(async () => {
  repo = new InMemoryMsRepository();
  await repo.addMeal(withData());
  await repo.addMeal(noData());
  svc = new NutritionInformation(repo);
});

describe('Req 3: Nutritional Information', () => {
  it('TS-1: customer sees calories, macros and allergens for an item with stored data', async () => {
    const v = await svc.getInformation('meal', 'Test Chicken');
    expect(v.available).toBe(true);
    expect(v).toMatchObject({ calories: 100, proteinG: 10, carbohydratesG: 20, fatsG: 5, sodiumMg: 200, vitamins: 2, allergens: 'soy' });
  });

  it('TS-2: item with no stored data shows "Nutritional information not available"', async () => {
    const v = await svc.getInformation('meal', 'Mystery Stew');
    expect(v.available).toBe(false);
    expect(v.message).toBe(NUTRITION_UNAVAILABLE);
    expect(v.calories).toBeUndefined();
    expect(v.proteinG).toBeUndefined();
  });

  it('QA-2: an item with no recorded allergens is never shown as allergen-free', async () => {
    expect((await svc.getInformation('meal', 'Mystery Stew')).allergens).toBe(ALLERGENS_UNAVAILABLE);
    await repo.addMeal({ ...withData(), name: 'Plain', allergens: [] });
    expect((await svc.getInformation('meal', 'Plain')).allergens).toBe(ALLERGENS_UNAVAILABLE);
  });

  it('TS-3: 250 g of an item at 100 kcal per 100 g shows 250 kcal (and scales the macros)', async () => {
    expect(await svc.getInformation('meal', 'Test Chicken', 250)).toMatchObject({
      weightG: 250, calories: 250, proteinG: 25, carbohydratesG: 50, fatsG: 12.5, sodiumMg: 500, vitamins: 5,
    });
  });

  it('TS-4: changing the weight updates the values consistently', async () => {
    const cal = async (w: number) => (await svc.getInformation('meal', 'Test Chicken', w)).calories;
    expect(await cal(100)).toBe(100);
    expect(await cal(300)).toBe(300);
    expect(await cal(100)).toBe(100); // back to the start gives the same answer
    expect(await cal(50)).toBe(50);
  });

  it('TS-4: a weight that is zero, negative or not a number is rejected', async () => {
    for (const w of [0, -5, NaN, Infinity]) {
      await expect(svc.getInformation('meal', 'Test Chicken', w)).rejects.toThrow(ValidationError);
    }
  });

  it('TS-5: the chef can add, update and remove nutrition and allergens', async () => {
    const added = await svc.addNutrition(chef, 'meal', 'Mystery Stew', facts, ['Gluten', ' gluten ', 'Tree nuts']);
    expect(added).toMatchObject({ ...facts, allergens: ['gluten', 'tree_nuts'] });
    expect(await repo.getMeal('Mystery Stew')).toMatchObject({ ...facts, allergens: ['gluten', 'tree_nuts'] });

    await svc.updateNutrition(chef, 'meal', 'Mystery Stew', { calories: 120 }, ['gluten', 'dairy']);
    expect((await svc.getInformation('meal', 'Mystery Stew')).calories).toBe(120);
    expect((await repo.getMeal('Mystery Stew')).allergens).toEqual(['gluten', 'dairy']);

    await svc.removeNutrition(chef, 'meal', 'Mystery Stew');
    const after = await svc.getInformation('meal', 'Mystery Stew');
    expect(after.message).toBe(NUTRITION_UNAVAILABLE);
    expect(after.allergens).toBe(ALLERGENS_UNAVAILABLE);
  });

  it('TS-5: updating nutrition changes only the values given and leaves allergens alone', async () => {
    await svc.updateNutrition(chef, 'meal', 'Test Chicken', { protein: 30 });
    expect(await repo.getMeal('Test Chicken')).toMatchObject({ ...facts, protein: 30, allergens: ['soy'] });
  });

  it('TS-5: the chef can change allergens alone, and clear them', async () => {
    await svc.setAllergens(chef, 'meal', 'Mystery Stew', ['fish', 'shellfish']);
    expect((await repo.getMeal('Mystery Stew')).allergens).toEqual(['fish', 'shellfish']);
    expect(hasNutritionData(await repo.getMeal('Mystery Stew'))).toBe(false); // nutrition untouched
    await svc.setAllergens(chef, 'meal', 'Mystery Stew', []);
    expect((await repo.getMeal('Mystery Stew')).allergens).toEqual([]);
  });

  it('TS-5: works for sides as well as meals', async () => {
    await repo.addSide({ ...noData(), name: 'Coleslaw' });
    await svc.addNutrition(chef, 'side', 'Coleslaw', facts, ['eggs']);
    expect((await svc.getInformation('side', 'Coleslaw', 200)).calories).toBe(200);
    expect(await repo.showAllMeals()).toHaveLength(2); // the meals were not touched
  });

  it.each([['customer', customer], ['owner', owner]])('TS-6: %s cannot add, update or remove, and nothing changes', async (_n, actor) => {
    const before = JSON.stringify([await repo.showAllMeals(), await repo.showAllSides()]);
    await expect(svc.addNutrition(actor, 'meal', 'Mystery Stew', facts, [])).rejects.toThrow(UnauthorizedError);
    await expect(svc.updateNutrition(actor, 'meal', 'Test Chicken', { calories: 1 })).rejects.toThrow(UnauthorizedError);
    await expect(svc.removeNutrition(actor, 'meal', 'Test Chicken')).rejects.toThrow(UnauthorizedError);
    await expect(svc.setAllergens(actor, 'meal', 'Test Chicken', ['fish'])).rejects.toThrow(UnauthorizedError);
    await expect(svc.createItem(actor, { kind: 'meal', name: 'X', price: 100 })).rejects.toThrow(UnauthorizedError);
    expect(JSON.stringify([await repo.showAllMeals(), await repo.showAllSides()])).toBe(before);
  });
});

describe('Owner read-only view (IOwnerNutritionServiceRepo)', () => {
  it('the owner and the chef can see every meal and side', async () => {
    await repo.addSide({ ...withData(), name: 'Rice' });
    for (const actor of [owner, chef]) {
      const o = await svc.getOwnerOverview(actor);
      expect(o.meals.map((m) => m.name).sort()).toEqual(['Mystery Stew', 'Test Chicken']);
      expect(o.sides.map((s) => s.name)).toEqual(['Rice']);
      expect(o.meals.find((m) => m.name === 'Mystery Stew')?.available).toBe(false);
    }
  });

  it('a customer cannot see the overview', async () => {
    await expect(svc.getOwnerOverview(customer)).rejects.toThrow(UnauthorizedError);
  });

  it('reads through the narrow owner interface only (two read methods)', async () => {
    const calls: string[] = [];
    const narrow: IOwnerNutritionServiceRepo = {
      showAllMeals: async () => { calls.push('meals'); return []; },
      showAllSides: async () => { calls.push('sides'); return []; },
    };
    const s = new NutritionInformation(repo, narrow);
    expect(await s.getOwnerOverview(owner)).toEqual({ meals: [], sides: [] });
    expect(calls.sort()).toEqual(['meals', 'sides']);
  });
});

describe('createItem', () => {
  it('creates an item with a trimmed name, cleaned allergens and no prep steps', async () => {
    const item = await svc.createItem(chef, {
      kind: 'side', name: '  Coleslaw ', details: ' creamy ', price: 3.5, nutrition: facts, allergens: ['Eggs', 'eggs'],
    });
    expect(item).toMatchObject({ name: 'Coleslaw', details: 'creamy', price: 3.5, ...facts, allergens: ['eggs'] });
    expect((await svc.getAll('side')).map((s) => s.name)).toEqual(['Coleslaw']);
  });

  it('an item created without nutrition shows "not available"', async () => {
    await svc.createItem(chef, { kind: 'meal', name: 'New Dish', price: 100 });
    expect((await svc.getInformation('meal', 'New Dish')).message).toBe(NUTRITION_UNAVAILABLE);
  });

  it('rejects a duplicate name', async () => {
    await expect(svc.createItem(chef, { kind: 'meal', name: 'Test Chicken', price: 100 })).rejects.toThrow(/already exists/);
  });

  it('accepts dollar prices with up to 2 decimals, as the database stores them (e.g. 12.50, 0.1 + 0.2)', async () => {
    for (const [i, price] of [12.5, 0, 0.1 + 0.2, 999999.99].entries()) {
      await expect(svc.createItem(chef, { kind: 'side', name: `P${i}`, price })).resolves.toMatchObject({ price });
    }
  });

  it('allows a meal and a side with the same name', async () => {
    await expect(svc.createItem(chef, { kind: 'side', name: 'Test Chicken', price: 100 })).resolves.toBeDefined();
  });

  it.each([
    ['a blank name', { kind: 'meal', name: '  ', price: 100 }],
    ['a price with more than 2 decimal places', { kind: 'meal', name: 'A', price: 9.999 }],
    ['a negative price', { kind: 'meal', name: 'A', price: -1 }],
    ['a price too big for numeric(8,2)', { kind: 'meal', name: 'A', price: 1000000 }],
    ['a price that is not a number', { kind: 'meal', name: 'A', price: '5' }],
    ['an unknown kind', { kind: 'drink', name: 'A', price: 100 }],
    ['nutrition with a missing value', { kind: 'meal', name: 'A', price: 100, nutrition: { calories: 1 } }],
    ['nutrition that is all zeros', { kind: 'meal', name: 'A', price: 100, nutrition: { calories: 0, protein: 0, carbohydrates: 0, fats: 0, sodium: 0, vitamins: 0 } }],
    ['an unknown allergen', { kind: 'meal', name: 'A', price: 100, allergens: ['pollen'] }],
  ])('rejects %s', async (_label, input) => {
    await expect(svc.createItem(chef, input as never)).rejects.toThrow(ValidationError);
    expect(await repo.showAllMeals()).toHaveLength(2);
  });
});

describe('validation and errors', () => {
  it('rejects negative, non-numeric and missing nutrition values', async () => {
    await expect(svc.addNutrition(chef, 'meal', 'Mystery Stew', { ...facts, calories: -5 })).rejects.toThrow(ValidationError);
    await expect(svc.addNutrition(chef, 'meal', 'Mystery Stew', { ...facts, protein: '9' as never })).rejects.toThrow(ValidationError);
    await expect(svc.addNutrition(chef, 'meal', 'Mystery Stew', { calories: 5 } as never)).rejects.toThrow(/required/);
    await expect(svc.updateNutrition(chef, 'meal', 'Test Chicken', { fats: NaN })).rejects.toThrow(ValidationError);
  });

  it('rejects adding all-zero nutrition, which would still read as "not available"', async () => {
    const zeros = { calories: 0, protein: 0, carbohydrates: 0, fats: 0, sodium: 0, vitamins: 0 };
    await expect(svc.addNutrition(chef, 'meal', 'Mystery Stew', zeros)).rejects.toThrow(/above 0/);
    await expect(svc.updateNutrition(chef, 'meal', 'Test Chicken', zeros)).rejects.toThrow(/above 0/);
  });

  it('rejects allergens that are not in the Allergen list, and non-lists', async () => {
    await expect(svc.setAllergens(chef, 'meal', 'Test Chicken', ['pollen'])).rejects.toThrow(/unknown allergen/);
    await expect(svc.setAllergens(chef, 'meal', 'Test Chicken', 'soy' as never)).rejects.toThrow(ValidationError);
    expect((await repo.getMeal('Test Chicken')).allergens).toEqual(['soy']); // unchanged
  });

  it('add is refused when data already exists, update when it does not', async () => {
    await expect(svc.addNutrition(chef, 'meal', 'Test Chicken', facts)).rejects.toThrow(/Use update/);
    await expect(svc.updateNutrition(chef, 'meal', 'Mystery Stew', { calories: 5 })).rejects.toThrow(/Use add/);
    await expect(svc.updateNutrition(chef, 'meal', 'Test Chicken')).rejects.toThrow(/nothing to update/);
  });

  it('unknown items give NotFoundError, and so do other kinds with that name', async () => {
    await expect(svc.getInformation('meal', 'Nope')).rejects.toThrow(NotFoundError);
    await expect(svc.getInformation('side', 'Test Chicken')).rejects.toThrow(NotFoundError);
    await expect(svc.removeNutrition(chef, 'meal', 'Nope')).rejects.toThrow(NotFoundError);
  });

  it('a database failure is passed on as it is, not reported as "not found"', async () => {
    const broken = new InMemoryMsRepository();
    broken.getMeal = async () => { throw { message: 'connection lost', code: '08006' }; };
    await expect(new NutritionInformation(broken).getInformation('meal', 'Test Chicken')).rejects.toMatchObject({ message: 'connection lost' });
    await expect(new NutritionInformation(broken).createItem(chef, { kind: 'meal', name: 'X', price: 1 })).rejects.toMatchObject({ code: '08006' });
  });
});

describe('what the browser receives', () => {
  it('menu lists and edits leave out prep steps (staff-only, DC-7)', async () => {
    await repo.addPrep({ meal: 'Test Chicken' }, chopOnions());
    expect((await repo.getMeal('Test Chicken')).prepList).toHaveLength(1); // the repository does have them
    for (const entry of await svc.getAll('meal')) expect(entry).not.toHaveProperty('prepList');
    expect(await svc.updateNutrition(chef, 'meal', 'Test Chicken', { calories: 90 })).not.toHaveProperty('prepList');
  });

  it('editing nutrition does not disturb the prep steps', async () => {
    await repo.addPrep({ meal: 'Test Chicken' }, chopOnions());
    await svc.updateNutrition(chef, 'meal', 'Test Chicken', { calories: 90 });
    await svc.removeNutrition(chef, 'meal', 'Test Chicken');
    expect((await repo.getMeal('Test Chicken')).prepList.map((p) => p.itemName)).toEqual(['Onion']);
  });
});
