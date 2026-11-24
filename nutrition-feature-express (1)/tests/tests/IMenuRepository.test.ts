import { beforeEach, describe, expect, it } from 'vitest';
import { ops, Kind } from './helpers/ops';
import { FullRepo, makeRepo } from './helpers/makeRepo';
import { ALLERGENS, chopOnions, curryGoat, friedPlantain, jerkChicken, riceAndPeas } from './helpers/fixtures';

// IMenuRepository is read-only, so data is seeded through INutritionRepository.
// Covers SRS Req 1 (menu availability), Req 2 (sides and prices) and Req 3 (SR-3.1 nutrition + allergens).

let repo: FullRepo;
beforeEach(async () => {
  repo = await makeRepo();
});

describe.each(['meal', 'side'] as Kind[])('IMenuRepository (%s)', (kind) => {
  const a = () => (kind === 'meal' ? jerkChicken() : riceAndPeas());
  const b = () => (kind === 'meal' ? curryGoat() : friedPlantain());
  const otherKind: Kind = kind === 'meal' ? 'side' : 'meal';
  let o: ReturnType<typeof ops>;
  let other: ReturnType<typeof ops>;

  beforeEach(() => {
    o = ops(repo, kind);
    other = ops(repo, otherKind);
  });

  it('showAll returns an empty list when nothing has been added', async () => {
    expect(await o.all()).toEqual([]);
  });

  it('showAll returns every item of this kind', async () => {
    await o.add(a());
    await o.add(b());
    const names = (await o.all()).map((d) => d.name).sort();
    expect(names).toEqual([a().name, b().name].sort());
  });

  it('showAll does not mix meals and sides', async () => {
    await o.add(a());
    await other.add(otherKind === 'meal' ? curryGoat() : friedPlantain());
    expect((await o.all()).map((d) => d.name)).toEqual([a().name]);
  });

  it('SR-1.3: a newly added item shows up on the next read', async () => {
    expect(await o.all()).toHaveLength(0);
    await o.add(a());
    expect(await o.all()).toHaveLength(1);
  });

  it('SR-2.2 / SR-3.1: each item exposes name, details, price, nutrition, allergens and prepList', async () => {
    await o.add(a());
    const [dish] = await o.all();
    expect(dish).toMatchObject({
      name: a().name, details: a().details, price: a().price, calories: a().calories,
      carbohydrates: a().carbohydrates, protein: a().protein, sodium: a().sodium,
      fats: a().fats, vitamins: a().vitamins,
    });
    expect(dish.allergens).toEqual(a().allergens);
    expect(Array.isArray(dish.prepList)).toBe(true);
  });

  it('numeric fields come back as numbers, not strings (SQL numeric columns)', async () => {
    await o.add(a());
    const d = await o.get(a().name);
    for (const field of ['price', 'calories', 'carbohydrates', 'protein', 'sodium', 'fats', 'vitamins'] as const) {
      expect(typeof d[field]).toBe('number');
    }
  });

  it('SR-1.4 / SR-2.3: allergens are always an array drawn from the Allergen list', async () => {
    await o.add(a());
    await o.add(b()); // recorded as having no allergens
    for (const d of await o.all()) {
      expect(Array.isArray(d.allergens)).toBe(true);
      expect(d.allergens.every((x) => ALLERGENS.includes(x))).toBe(true);
    }
  });

  it('get returns the item with the matching name', async () => {
    await o.add(a());
    await o.add(b());
    expect((await o.get(b().name)).name).toBe(b().name);
  });

  it('get rejects for a name that does not exist', async () => {
    await expect(o.get('Does Not Exist')).rejects.toThrow();
  });

  it('get does not find an item that belongs to the other kind', async () => {
    await other.add(otherKind === 'meal' ? jerkChicken() : riceAndPeas());
    const otherName = otherKind === 'meal' ? jerkChicken().name : riceAndPeas().name;
    await expect(o.get(otherName)).rejects.toThrow();
  });

  it('returns copies: changing a returned object does not change stored data', async () => {
    await o.add(a());
    const d = await o.get(a().name);
    d.price = 1;
    d.allergens.push('fish');
    const fresh = await o.get(a().name);
    expect(fresh.price).toBe(a().price);
    expect(fresh.allergens).toEqual(a().allergens);
  });

  it('includes the prep steps that belong to the item', async () => {
    await o.add(a());
    await repo.addPrep(kind === 'meal' ? { meal: a().name } : { side: a().name }, chopOnions());
    const d = await o.get(a().name);
    expect(d.prepList.map((p) => p.itemName)).toEqual(['Onion']);
  });
});

describe('not covered by the current model (SRS items to decide on)', () => {
  it.todo('SR-1.1: Dish has no availability field, so available/unavailable cannot be read yet');
  it.todo('SR-3.2 / TS-2: no way to tell "no nutrition recorded" from real zeros');
  it.todo('SRS 3.2: an empty allergens array cannot be told apart from "allergen information not available"');
});
