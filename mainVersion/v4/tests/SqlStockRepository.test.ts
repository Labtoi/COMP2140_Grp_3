import { describe, expect, it } from 'vitest';
import { SqlStockRepository } from '../owner/src/repositories/SqlStockRepository';
import { StockManagement } from '../owner/src/mainClasses/StockManagement';
import { makeKitchen } from './helpers/kitchen';
import { OrderProcessing } from '../shared/src/mainClasses/OrderProcessing';
import { burger } from './helpers/kitchen';

/** A fake pg pool that returns rows the way the real one does here: dates as "YYYY-MM-DD" text, numbers as text. */
const day = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const row = (id: string, name: string, qty: string, expiry: string | null) =>
  ({ item_id: id, item_name: name, item_quantity: qty, date_added: day(0), expiry_date: expiry, type: 'protein' });
const poolWith = (rows: any[]) => ({ query: async (sql: string, args?: any[]) => ({ rows: sql.includes('where item_id') ? rows.filter((r) => r.item_id === args![0]) : rows }) }) as any;

describe('SqlStockRepository dates', () => {
  it('turns "YYYY-MM-DD" text into Date objects without shifting the day', async () => {
    const repo = new SqlStockRepository(poolWith([row('A', 'Beef Patty', '500.00', day(5))]));
    const [item] = await repo.getAllItems();
    expect(item.expiryDate).toBeInstanceOf(Date);
    expect(item.dateAdded).toBeInstanceOf(Date);
    const d = item.expiryDate!;
    expect(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`).toBe(day(5));
    expect(item.itemQuantity).toBe(500);
  });

  it('keeps "no expiry" as null', async () => {
    const [item] = await new SqlStockRepository(poolWith([row('A', 'Salt', '10', null)])).getAllItems();
    expect(item.expiryDate).toBeNull();
  });

  it('StockManagement can tell what is usable (this used to throw "getTime is not a function")', async () => {
    const stock = new StockManagement(new SqlStockRepository(poolWith([
      row('FRESH', 'Beef Patty', '500', day(5)), row('OLD', 'Old Beef', '500', day(-3)),
      row('EMPTY', 'Empty', '0', day(5)), row('NOEXP', 'Salt', '5', null),
    ])));
    expect(await stock.itemAvailabilityForMealPrep('FRESH')).toBe(true);
    expect(await stock.itemAvailabilityForMealPrep('OLD')).toBe(false);
    expect(await stock.itemAvailabilityForMealPrep('EMPTY')).toBe(false);
    expect(await stock.itemAvailabilityForMealPrep('NOEXP')).toBe(true);
    await expect(stock.expiryPeriodItem('FRESH')).resolves.toBeGreaterThanOrEqual(4);
  });

  it('the customer menu shows items as available when stock has expiry dates (real SqlStockRepository)', async () => {
    const k = await makeKitchen();
    const names = [['S1', 'Beef Patty', '1000'], ['S2', 'Brioche Bun', '20'], ['S3', 'Onion', '500'], ['S4', 'Romaine', '1000'], ['S5', 'Potatoes', '3000']];
    const pool = poolWith(names.map(([id, n, q]) => row(id, n, q, day(7))));
    const orders = new OrderProcessing({ menu: k.menu, prepRepo: k.menu, stock: new StockManagement(new SqlStockRepository(pool)), analysis: k.analysis, nutrition: k.nutrition });
    const menu = await orders.getMenu();
    expect([...menu.meals, ...menu.sides].filter((i) => i.name !== 'Water').every((i) => i.available)).toBe(true);
    void burger;
  });
});

describe('StockManagement tolerates text dates even if the repository passes them through', () => {
  it('does not throw when expiryDate is "YYYY-MM-DD" text', async () => {
    const repo: any = {
      getItem: async (id: string) => ({ itemID: id, itemName: 'Beef Patty', itemQuantity: 5, dateAdded: day(0), expiryDate: day(3), type: null }),
      getAllItems: async () => [{ itemID: 'A', itemName: 'Beef Patty', itemQuantity: 5, dateAdded: day(0), expiryDate: day(3), type: null }],
    };
    const stock = new StockManagement(repo);
    expect(await stock.itemAvailabilityForMealPrep('A')).toBe(true);
    await expect(stock.expiryPeriodItem('A')).resolves.toBeGreaterThanOrEqual(2);
  });
});
