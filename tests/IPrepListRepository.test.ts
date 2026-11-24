import { beforeEach, describe, expect, it } from 'vitest';
import { PrepOwner } from '../src/interfaces';
import { FullRepo, makeRepo } from './helpers/makeRepo';
import { chopOnions, curryGoat, jerkChicken, marinate, riceAndPeas } from './helpers/fixtures';

// SRS Req 5, SR-5.1: view, add, edit and remove tasks on the preparation list.
// (the interface exports `IPreplistRepository`, with a lowercase "l".)

const forJerk: PrepOwner = { meal: 'Jerk Chicken' };
const forRice: PrepOwner = { side: 'Rice and Peas' };

let repo: FullRepo;
beforeEach(async () => {
  repo = await makeRepo();
  await repo.addMeal(jerkChicken());
  await repo.addMeal(curryGoat());
  await repo.addSide(riceAndPeas());
});

describe('showAllPrep', () => {
  it('is empty before any prep is added', async () => {
    expect(await repo.showAllPrep()).toEqual([]);
  });

  it('returns prep steps for meals and sides together', async () => {
    await repo.addPrep(forJerk, marinate());
    await repo.addPrep(forRice, chopOnions());
    expect((await repo.showAllPrep()).map((p) => p.itemName).sort()).toEqual(['Chicken', 'Onion']);
  });
});

describe('addPrep', () => {
  it('SR-5.1: returns the saved prep step with a generated id', async () => {
    const saved = await repo.addPrep(forJerk, chopOnions());
    expect(saved).toMatchObject(chopOnions());
    expect(typeof saved.id).toBe('string');
    expect(saved.id).toBeTruthy();
  });

  it('gives every prep step its own id', async () => {
    const a = await repo.addPrep(forJerk, chopOnions());
    const b = await repo.addPrep(forJerk, marinate());
    expect(a.id).not.toBe(b.id);
  });

  it('works for a meal owner and for a side owner', async () => {
    await repo.addPrep(forJerk, marinate());
    await repo.addPrep(forRice, chopOnions());
    expect((await repo.getMeal('Jerk Chicken')).prepList.map((p) => p.itemName)).toEqual(['Chicken']);
    expect((await repo.getSide('Rice and Peas')).prepList.map((p) => p.itemName)).toEqual(['Onion']);
  });

  it('puts the step on its own dish only', async () => {
    await repo.addPrep(forJerk, marinate());
    expect((await repo.getMeal('Curry Goat')).prepList).toEqual([]);
    expect((await repo.getSide('Rice and Peas')).prepList).toEqual([]);
  });

  it('SR-5.4: itemQuantity is stored and returned as a number', async () => {
    await repo.addPrep(forJerk, chopOnions());
    const p = await repo.getPrep('Onion');
    expect(p.itemQuantity).toBe(3);
    expect(typeof p.itemQuantity).toBe('number');
  });

  it('rejects when the meal does not exist', async () => {
    await expect(repo.addPrep({ meal: 'Nope' }, chopOnions())).rejects.toThrow();
    expect(await repo.showAllPrep()).toEqual([]);
  });

  it('rejects when the side does not exist', async () => {
    await expect(repo.addPrep({ side: 'Nope' }, chopOnions())).rejects.toThrow();
  });

  it('does not accept a meal name as a side owner', async () => {
    await expect(repo.addPrep({ side: 'Jerk Chicken' }, chopOnions())).rejects.toThrow();
  });
});

describe('getPrep', () => {
  it('returns the step with that item name', async () => {
    await repo.addPrep(forJerk, chopOnions());
    await repo.addPrep(forJerk, marinate());
    expect(await repo.getPrep('Chicken')).toMatchObject(marinate());
  });

  it('rejects when no step has that name', async () => {
    await expect(repo.getPrep('Nope')).rejects.toThrow();
  });
});

describe('updatePrep', () => {
  beforeEach(async () => {
    await repo.addPrep(forJerk, chopOnions());
  });

  it('SR-5.1: changes the given fields and returns the updated step', async () => {
    const updated = await repo.updatePrep('Onion', { itemQuantity: 5, steps: 'Slice thinly' });
    expect(updated).toMatchObject({ itemName: 'Onion', itemQuantity: 5, steps: 'Slice thinly', type: 'chop' });
  });

  it('keeps the same id', async () => {
    const before = await repo.getPrep('Onion');
    const after = await repo.updatePrep('Onion', { itemQuantity: 5 });
    expect(after.id).toBe(before.id);
  });

  it('persists the change and keeps the step on its dish', async () => {
    await repo.updatePrep('Onion', { itemQuantity: 5 });
    expect((await repo.getPrep('Onion')).itemQuantity).toBe(5);
    expect((await repo.getMeal('Jerk Chicken')).prepList[0].itemQuantity).toBe(5);
  });

  it('can rename the item', async () => {
    await repo.updatePrep('Onion', { itemName: 'Scallion' });
    expect((await repo.getPrep('Scallion')).type).toBe('chop');
    await expect(repo.getPrep('Onion')).rejects.toThrow();
  });

  it('does not change other steps', async () => {
    await repo.addPrep(forJerk, marinate());
    await repo.updatePrep('Onion', { itemQuantity: 5 });
    expect(await repo.getPrep('Chicken')).toMatchObject(marinate());
  });

  it('id cannot be changed (checked by tsc)', async () => {
    // @ts-expect-error "id" is excluded from the update type
    const attempt = repo.updatePrep('Onion', { id: 'hacked' });
    await attempt.catch(() => undefined);
    expect(true).toBe(true);
  });

  it('rejects when no step has that name', async () => {
    await expect(repo.updatePrep('Nope', { itemQuantity: 1 })).rejects.toThrow();
  });
});

describe('removePrep', () => {
  beforeEach(async () => {
    await repo.addPrep(forJerk, chopOnions());
    await repo.addPrep(forJerk, marinate());
  });

  it('SR-5.1: removes the step from the list', async () => {
    await repo.removePrep('Onion');
    expect((await repo.showAllPrep()).map((p) => p.itemName)).toEqual(['Chicken']);
    await expect(repo.getPrep('Onion')).rejects.toThrow();
  });

  it('removes it from the dish prep list too', async () => {
    await repo.removePrep('Onion');
    expect((await repo.getMeal('Jerk Chicken')).prepList.map((p) => p.itemName)).toEqual(['Chicken']);
  });

  it('resolves with nothing', async () => {
    await expect(repo.removePrep('Onion')).resolves.toBeUndefined();
  });

  it('is idempotent: removing a step that does not exist resolves and changes nothing', async () => {
    await expect(repo.removePrep('Nope')).resolves.toBeUndefined();
    expect(await repo.showAllPrep()).toHaveLength(2);
  });

  it('removing a step does not delete its dish', async () => {
    await repo.removePrep('Onion');
    await repo.removePrep('Chicken');
    expect((await repo.getMeal('Jerk Chicken')).name).toBe('Jerk Chicken');
  });
});

describe('not covered by the current interface (SRS Req 5)', () => {
  it.todo('SR-5.1: reorder tasks (no reorder method or position field)');
  it.todo('SR-5.5: mark a task in-progress or complete (Prep has no status)');
  it.todo('SR-5.2 / SR-5.6: auto-generate and refresh the list from stock and availability (service layer)');
  it.todo('SR-5.3: highlight low-stock ingredients (needs StockManagement)');
});
