import { beforeEach, describe, expect, it } from 'vitest';
import { ops, Kind } from './helpers/ops';
import { FullRepo, makeRepo } from './helpers/makeRepo';
import { chopOnions, curryGoat, friedPlantain, jerkChicken, riceAndPeas } from './helpers/fixtures';

// SRS Req 3: TS-5 (add, update and remove nutrition and allergens) at the repository level.
// TS-6 (unauthorized users) is not decided here: see IOwnerNutritionServiceRepo.test.ts.

describe.each(['meal', 'side'] as Kind[])('INutritionRepository (%s)', (kind) => {
  const dish = () => (kind === 'meal' ? jerkChicken() : riceAndPeas());
  const dish2 = () => (kind === 'meal' ? curryGoat() : friedPlantain());
  const otherKind: Kind = kind === 'meal' ? 'side' : 'meal';
  let repo: FullRepo;
  let o: ReturnType<typeof ops>;
  let other: ReturnType<typeof ops>;

  beforeEach(async () => {
    repo = await makeRepo();
    o = ops(repo, kind);
    other = ops(repo, otherKind);
  });

  it('still provides the read methods from IMenuRepository', () => {
    for (const m of ['showAllMeals', 'showAllSides', 'getMeal', 'getSide'] as const) {
      expect(typeof repo[m]).toBe('function');
    }
  });

  describe('add', () => {
    it('returns the saved item', async () => {
      const saved = await o.add(dish());
      expect(saved).toMatchObject({ name: dish().name, price: dish().price, calories: dish().calories });
      expect(saved.allergens).toEqual(dish().allergens);
    });

    it('makes the item readable with get and showAll', async () => {
      await o.add(dish());
      expect((await o.get(dish().name)).name).toBe(dish().name);
      expect((await o.all()).map((d) => d.name)).toContain(dish().name);
    });

    it('stores nutrition values and allergens exactly as given', async () => {
      await o.add({ ...dish(), calories: 321, protein: 12.5, allergens: ['gluten', 'dairy'] });
      expect(await o.get(dish().name)).toMatchObject({ calories: 321, protein: 12.5, allergens: ['gluten', 'dairy'] });
    });

    it('rejects a second item with the same name', async () => {
      await o.add(dish());
      await expect(o.add(dish())).rejects.toThrow();
      expect(await o.all()).toHaveLength(1);
    });

    it('does not create the item under the other kind', async () => {
      await o.add(dish());
      expect(await other.all()).toEqual([]);
    });

    it('allows a meal and a side to share a name', async () => {
      await o.add(dish());
      await other.add({ ...dish2(), name: dish().name });
      expect((await o.get(dish().name)).price).toBe(dish().price);
      expect((await other.get(dish().name)).price).toBe(dish2().price);
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await o.add(dish());
    });

    it('TS-5: changes nutrition values and returns the updated item', async () => {
      const updated = await o.update(dish().name, { calories: 120, protein: 30 });
      expect(updated).toMatchObject({ name: dish().name, calories: 120, protein: 30 });
    });

    it('TS-5: changes allergens, including clearing them', async () => {
      expect((await o.update(dish().name, { allergens: ['gluten', 'dairy'] })).allergens).toEqual(['gluten', 'dairy']);
      expect((await o.update(dish().name, { allergens: [] })).allergens).toEqual([]);
    });

    it('persists the change for later reads', async () => {
      await o.update(dish().name, { calories: 120 });
      expect((await o.get(dish().name)).calories).toBe(120);
    });

    it('leaves every field that was not mentioned unchanged', async () => {
      await o.update(dish().name, { calories: 120 });
      expect(await o.get(dish().name)).toMatchObject({
        details: dish().details, price: dish().price, carbohydrates: dish().carbohydrates,
        protein: dish().protein, sodium: dish().sodium, fats: dish().fats, vitamins: dish().vitamins,
        allergens: dish().allergens,
      });
    });

    it('can change price and details (menu management)', async () => {
      await o.update(dish().name, { price: 999, details: 'New description' });
      expect(await o.get(dish().name)).toMatchObject({ price: 999, details: 'New description' });
    });

    it('does not touch the prep list', async () => {
      await repo.addPrep(kind === 'meal' ? { meal: dish().name } : { side: dish().name }, chopOnions());
      await o.update(dish().name, { calories: 120 });
      expect((await o.get(dish().name)).prepList.map((p) => p.itemName)).toEqual(['Onion']);
    });

    it('does not change other items', async () => {
      await o.add(dish2());
      await o.update(dish().name, { calories: 120 });
      expect((await o.get(dish2().name)).calories).toBe(dish2().calories);
    });

    it('rejects when the item does not exist', async () => {
      await expect(o.update('Does Not Exist', { calories: 1 })).rejects.toThrow();
    });

    it('does not change the same-named item of the other kind', async () => {
      await other.add({ ...dish2(), name: dish().name });
      await o.update(dish().name, { calories: 120 });
      expect((await other.get(dish().name)).calories).toBe(dish2().calories);
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await o.add(dish());
      await o.add(dish2());
    });

    it('removes the item from get and showAll', async () => {
      await o.del(dish().name);
      await expect(o.get(dish().name)).rejects.toThrow();
      expect((await o.all()).map((d) => d.name)).toEqual([dish2().name]);
    });

    it('resolves with nothing', async () => {
      await expect(o.del(dish().name)).resolves.toBeUndefined();
    });

    it('rejects when the item does not exist', async () => {
      await expect(o.del('Does Not Exist')).rejects.toThrow();
    });

    it('does not remove the same-named item of the other kind', async () => {
      await other.add({ ...dish2(), name: dish().name });
      await o.del(dish().name);
      expect((await other.get(dish().name)).name).toBe(dish().name);
    });

    it('lets the same name be added again afterwards', async () => {
      await o.del(dish().name);
      await expect(o.add(dish())).resolves.toBeDefined();
    });
  });
});

describe('not decided at repository level', () => {
  it.todo('TS-6: only authorized staff can change nutrition (needs the Chef/Owner service layer, the repository has no roles)');
  it.todo('SR-3.2: scaling calories by portion weight belongs to NutritionInformation, not the repository');
  it.todo('whether deleting a meal/side also deletes its prep steps (current fake cascades, confirm for SQL)');
});
