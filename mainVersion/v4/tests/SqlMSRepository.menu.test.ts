import { describe, expect, it } from 'vitest';
import { SqlMSRepository } from '../shared/src/repositories/SqlMSRepository';

type Row = Record<string, any>;

/** Minimal fake of the supabase-js query builder. Like the real server, a select that embeds "prep(...)"
 *  fails when the table is called "Prep" (names are case-sensitive and there is no relationship). */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(name: string) {
      let rows = tables[name];
      let error: any = rows ? null : { message: `relation "${name}" does not exist` };
      const q: any = {
        select(cols: string) {
          if (/prep\(/.test(cols)) error = { message: "Could not find a relationship between tables" };
          return q;
        },
        order(col: string) { rows = [...(rows ?? [])].sort((a, b) => String(a[col]).localeCompare(String(b[col]))); return q; },
        eq(col: string, v: any) { rows = (rows ?? []).filter((r) => r[col] === v); return q; },
        not(col: string, _op: string, v: any) { rows = (rows ?? []).filter((r) => r[col] !== v); return q; },
        returns() { return q; },
        maybeSingle() { q._single = true; return q; },
        then(ok: any, bad: any) {
          const data = error ? null : q._single ? (rows?.[0] ?? null) : rows;
          return Promise.resolve({ data, error }).then(ok, bad);
        },
      };
      return q;
    },
  } as any;
}

const dishRow = (name: string, price: number) => ({
  name, details: '', price: String(price), calories: '300', carbohydrates: '30', protein: '20', sodium: '400', fats: '10', vitamins: '1', allergens: ['gluten'],
});

describe('SqlMSRepository menu loading', () => {
  const db = fakeDb({
    SqlDatabaseMeals: [dishRow('Burger', 12.5), dishRow('Salad', 9)],
    SqlDatabaseSides: [dishRow('Fries', 4)],
    Prep: [
      { id: '1', item_name: 'Beef Patty', type: 'protein', item_quantity: '150', steps: 'Grill', meal_name: 'Burger', side_name: null },
      { id: '2', item_name: 'Potatoes', type: 'veg', item_quantity: '300', steps: 'Fry', meal_name: null, side_name: 'Fries' },
    ],
  });
  const repo = new SqlMSRepository(db);

  it('lists meals with their own prep rows', async () => {
    const meals = await repo.showAllMeals();
    expect(meals.map((m) => m.name)).toEqual(['Burger', 'Salad']);
    expect(meals[0].price).toBe(12.5);
    expect(meals[0].prepList.map((p) => p.itemName)).toEqual(['Beef Patty']);
    expect(meals[0].prepList[0].itemQuantity).toBe(150);
    expect(meals[1].prepList).toEqual([]);
  });

  it('lists sides with their own prep rows', async () => {
    const sides = await repo.showAllSides();
    expect(sides[0].prepList.map((p) => p.itemName)).toEqual(['Potatoes']);
  });

  it('gets one meal or side', async () => {
    expect((await repo.getMeal('Burger')).prepList).toHaveLength(1);
    expect((await repo.getSide('Fries')).prepList).toHaveLength(1);
    await expect(repo.getMeal('Nope')).rejects.toThrow(/not found/);
  });

  it('returns an empty menu without touching prep', async () => {
    const empty = new SqlMSRepository(fakeDb({ SqlDatabaseMeals: [], SqlDatabaseSides: [] }));
    expect(await empty.showAllMeals()).toEqual([]);
  });
});
