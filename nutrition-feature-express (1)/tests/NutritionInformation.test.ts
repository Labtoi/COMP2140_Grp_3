import { beforeEach, describe, expect, it } from 'vitest';
import { NutritionInformation, UnauthorizedError, ValidationError, NotFoundError } from '../src/mainClasses/NutritionInformation';
import { InMemoryNutritionRepo } from './fakes/InMemoryNutritionRepo';
import { ALLERGENS_UNAVAILABLE, NUTRITION_UNAVAILABLE, Actor, Meal, NutritionFacts } from '../src/models/MenuItem';

const chef: Actor = { id: 'chef', role: 'chef' };
const customer: Actor = { id: 'guest', role: 'customer' };
const facts: NutritionFacts = {
  caloriesPer100g: 100, proteinPer100g: 10, carbohydratesPer100g: 20, fatsPer100g: 5,
  sodiumMgPer100g: 200, vitamins: 'B12', defaultWeightG: 250,
};
const withData: Meal = { id: '1', kind: 'meal', name: 'Test Chicken', details: '', costCents: 50000, allergens: ['soy'], nutrition: facts };
const noData: Meal = { id: '2', kind: 'meal', name: 'Mystery Stew', details: '', costCents: 40000, allergens: [] };

let repo: InMemoryNutritionRepo;
let svc: NutritionInformation;

beforeEach(async () => {
  repo = new InMemoryNutritionRepo();
  await repo.AddMeal(withData);
  await repo.AddMeal(noData);
  svc = new NutritionInformation(repo);
});

describe('Req 3 – Nutritional Information', () => {
  it('TS-1: customer sees calories, macros and allergens for an item with stored data', async () => {
    const v = await svc.getInformation('meal', 'Test Chicken');
    expect(v.available).toBe(true);
    expect(v).toMatchObject({ calories: 250, proteinG: 25, carbohydratesG: 50, fatsG: 12.5, allergens: 'soy' });
  });

  it('TS-2: item with no data shows "Nutritional information not available"', async () => {
    const v = await svc.getInformation('meal', 'Mystery Stew');
    expect(v.available).toBe(false);
    expect(v.message).toBe(NUTRITION_UNAVAILABLE);
    expect(v.calories).toBeUndefined();
    expect(v.allergens).toBe(ALLERGENS_UNAVAILABLE);
  });

  it('TS-3: 250 g of an item at 100 kcal per 100 g shows 250 kcal', async () => {
    expect((await svc.getInformation('meal', 'Test Chicken', 250)).calories).toBe(250);
  });

  it('TS-4: changing the weight updates values consistently', async () => {
    expect((await svc.getInformation('meal', 'Test Chicken', 100)).calories).toBe(100);
    expect((await svc.getInformation('meal', 'Test Chicken', 300)).calories).toBe(300);
    expect((await svc.getInformation('meal', 'Test Chicken', 100)).calories).toBe(100);
    await expect(svc.getInformation('meal', 'Test Chicken', 0)).rejects.toThrow(ValidationError);
  });

  it('TS-5: authorized staff can add, update and remove nutrition and allergens', async () => {
    await svc.addNutrition(chef, 'meal', 'Mystery Stew', facts, ['Gluten', ' gluten ']);
    expect((await repo.GetMeal('Mystery Stew'))?.allergens).toEqual(['gluten']);

    await svc.updateNutrition(chef, 'meal', 'Mystery Stew', { ...facts, caloriesPer100g: 120 }, ['gluten', 'dairy']);
    expect((await svc.getInformation('meal', 'Mystery Stew', 100)).calories).toBe(120);
    expect((await repo.GetMeal('Mystery Stew'))?.allergens).toEqual(['gluten', 'dairy']);

    await svc.removeNutrition(chef, 'meal', 'Mystery Stew');
    expect((await svc.getInformation('meal', 'Mystery Stew')).message).toBe(NUTRITION_UNAVAILABLE);
  });

  it('TS-6: unauthorized users cannot add, update or remove, and nothing changes', async () => {
    const before = JSON.stringify(await repo.ShowAllMeals());
    await expect(svc.addNutrition(customer, 'meal', 'Mystery Stew', facts, [])).rejects.toThrow(UnauthorizedError);
    await expect(svc.updateNutrition(customer, 'meal', 'Test Chicken', facts, [])).rejects.toThrow(UnauthorizedError);
    await expect(svc.removeNutrition(customer, 'meal', 'Test Chicken')).rejects.toThrow(UnauthorizedError);
    await expect(svc.createItem(customer, { kind: 'meal', name: 'X', costCents: 100 })).rejects.toThrow(UnauthorizedError);
    expect(JSON.stringify(await repo.ShowAllMeals())).toBe(before);
  });

  it('rejects invalid input and unknown items', async () => {
    await expect(svc.addNutrition(chef, 'meal', 'Mystery Stew', { ...facts, caloriesPer100g: -5 }, [])).rejects.toThrow(ValidationError);
    await expect(svc.getInformation('side', 'Nope')).rejects.toThrow(NotFoundError);
    await expect(svc.createItem(chef, { kind: 'meal', name: 'test chicken', costCents: 100 })).rejects.toThrow(/already exists/);
  });

  it('creates a new item with a generated id', async () => {
    const item = await svc.createItem(chef, { kind: 'side', name: 'Coleslaw', costCents: 20000, nutrition: facts });
    expect(item.id).toBeTruthy();
    expect((await svc.getAll('side')).map((s) => s.name)).toEqual(['Coleslaw']);
  });
});
