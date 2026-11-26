import { beforeEach, describe, expect, it } from 'vitest';
import {
  OrderDeniedError, OrderLimitError, OrderNotFoundError, OrderValidationError, ORDER_PREP_TYPE, MAX_ACTIVE_ORDERS,
} from '../shared/src/mainClasses/OrderProcessing';
import { burger, fries, makeKitchen, salad, water, type Kitchen } from './helpers/kitchen';

let k: Kitchen;
beforeEach(async () => { k = await makeKitchen(); });

describe('menu', () => {
  it('lists meals and sides with nutrition, allergens and price', async () => {
    const m = await k.orders.getMenu();
    expect(m.meals.map((x) => x.name)).toEqual(['Classic Burger', 'Garden Salad']);
    expect(m.sides.map((x) => x.name)).toEqual(['Fries', 'Water']);
    expect(m.meals[0]).toMatchObject({ price: 12.5, allergens: ['gluten', 'dairy'], available: true });
    expect(m.meals[0].nutrition.available).toBe(true);
  });

  it('marks a dish unavailable when stock is short, and the others stay available', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 100; // burger needs 150 patty
    const m = await k.orders.getMenu();
    expect(m.meals.find((x) => x.name === 'Classic Burger')!.available).toBe(false);
    expect(m.meals.find((x) => x.name === 'Garden Salad')!.available).toBe(true);
  });

  it('marks a dish unavailable when its ingredient is expired or missing', async () => {
    k.stockDb.rows.get('S4')!.expiryDate = new Date(Date.now() - 86_400_000);
    k.stockDb.rows.delete('S5');
    const m = await k.orders.getMenu();
    expect(m.meals.find((x) => x.name === 'Garden Salad')!.available).toBe(false);
    expect(m.sides.find((x) => x.name === 'Fries')!.available).toBe(false);
    expect(m.sides.find((x) => x.name === 'Water')!.available).toBe(true); // no recipe, nothing to run out of
  });

  it('flags the customer\'s allergies', async () => {
    const m = await k.orders.getMenu(['dairy']);
    expect(m.meals.find((x) => x.name === 'Classic Burger')!.allergyWarning).toEqual(['dairy']);
  });
});

describe('placing an order', () => {
  it('accepts it: stock used, prep saved, analysis recorded', async () => {
    const o = await k.orders.placeOrder(k.ana, [burger(2), fries(1), water(1)]);
    expect(o).toMatchObject({ orderNumber: 1, status: 'preparing', total: 30 });
    expect(o.items).toHaveLength(3);
    expect(o.receipt).toContain('Ana');
    // StockManagement -> DatabaseM
    expect(k.stockDb.quantity('S1')).toBe(700); // 2 x 150
    expect(k.stockDb.quantity('S2')).toBe(18);
    expect(k.stockDb.quantity('S3')).toBe(460);
    expect(k.stockDb.quantity('S5')).toBe(2700);
    // prep database (IPreplistRepository)
    const tasks = (await k.menu.showAllMeals()).flatMap((m) => m.prepList).filter((p) => p.type === ORDER_PREP_TYPE);
    expect(tasks.map((t) => t.itemName)).toContain('#1 Beef Patty for Classic Burger');
    expect(tasks.find((t) => t.itemName === '#1 Beef Patty for Classic Burger')).toMatchObject({ itemQuantity: 300 });
    // StockAnalysis -> DatabaseA
    const rows = await k.analysisDb.GetAllAnalysis();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ revenue: 30, mealsSold: 2, sidesSold: 2 });
  });

  it('denies it when stock is short, with no side effects', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 100;
    await expect(k.orders.placeOrder(k.ana, [salad(1), burger(1)])).rejects.toBeInstanceOf(OrderDeniedError);
    expect(k.stockDb.quantity('S1')).toBe(100);
    expect(k.stockDb.quantity('S3')).toBe(500);
    expect(await k.analysisDb.GetAllAnalysis()).toHaveLength(0);
    const all = (await k.menu.showAllMeals()).flatMap((m) => m.prepList).filter((p) => p.type === ORDER_PREP_TYPE);
    expect(all).toHaveLength(0);
    expect(k.orders.ordersFor('ana').orders).toHaveLength(0);
  });

  it('names the dish that cannot be made, not the ingredient', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 0;
    const err = await k.orders.placeOrder(k.ana, [burger(1), salad(1)]).catch((e) => e);
    expect(err).toBeInstanceOf(OrderDeniedError);
    expect(err.unavailable).toEqual(['Classic Burger']);
    expect(err.message).not.toContain('Beef Patty');
  });

  it('adds up an ingredient shared by two dishes', async () => {
    k.stockDb.rows.get('S3')!.itemQuantity = 40; // burger 20 + salad 30 = 50 > 40
    await expect(k.orders.placeOrder(k.ana, [burger(1), salad(1)])).rejects.toBeInstanceOf(OrderDeniedError);
    k.stockDb.rows.get('S3')!.itemQuantity = 50;
    await expect(k.orders.placeOrder(k.ana, [burger(1), salad(1)])).resolves.toBeTruthy();
    expect(k.stockDb.quantity('S3')).toBe(0);
  });

  it('scales the recipe by quantity', async () => {
    await k.orders.placeOrder(k.ana, [burger(3)]);
    expect(k.stockDb.quantity('S1')).toBe(550);
  });

  it('merges repeated lines and enforces the quantity limit', async () => {
    const o = await k.orders.placeOrder(k.ana, [burger(1), burger(2)]);
    expect(o.items).toHaveLength(1);
    expect(o.items[0].quantity).toBe(3);
    await expect(k.orders.placeOrder(k.ben, [fries(6), fries(6)])).rejects.toBeInstanceOf(OrderValidationError);
  });

  it('rejects bad input', async () => {
    for (const bad of [undefined, [], 'x', [{ kind: 'drink', name: 'x', quantity: 1 }], [{ kind: 'meal', name: '', quantity: 1 }],
      [{ kind: 'meal', name: 'Classic Burger', quantity: 0 }], [{ kind: 'meal', name: 'Classic Burger', quantity: 1.5 }],
      [{ kind: 'meal', name: 'Classic Burger', quantity: -1 }], [{ kind: 'meal', name: 'Classic Burger', quantity: '2' }], [null]]) {
      await expect(k.orders.placeOrder(k.ana, bad)).rejects.toBeInstanceOf(OrderValidationError);
    }
    expect(k.stockDb.quantity('S1')).toBe(1000);
  });

  it('rejects an item that is not on the menu', async () => {
    await expect(k.orders.placeOrder(k.ana, [{ kind: 'meal', name: 'Nope', quantity: 1 }])).rejects.toBeInstanceOf(OrderValidationError);
  });

  it('blocks a dish with one of the customer\'s allergens (QA-2)', async () => {
    const allergic = { ...k.ana, allergies: ['Milk'] };
    await expect(k.orders.placeOrder(allergic, [burger(1)])).rejects.toThrow(/dairy/);
    expect(k.stockDb.quantity('S1')).toBe(1000);
    await expect(k.orders.placeOrder(allergic, [salad(1)])).resolves.toBeTruthy();
  });

  it('limits active orders per customer', async () => {
    for (let i = 0; i < MAX_ACTIVE_ORDERS; i++) await k.orders.placeOrder(k.ana, [water(1)]);
    await expect(k.orders.placeOrder(k.ana, [water(1)])).rejects.toBeInstanceOf(OrderLimitError);
    await expect(k.orders.placeOrder(k.ben, [water(1)])).resolves.toBeTruthy();
  });

  it('numbers orders in sequence, and a failed order does not use a number', async () => {
    await k.orders.placeOrder(k.ana, [water(1)]);
    await k.orders.placeOrder(k.ana, [burger(100)]).catch(() => undefined);
    const o = await k.orders.placeOrder(k.ben, [water(1)]);
    expect(o.orderNumber).toBe(2);
  });

  it('uses the batch that expires first', async () => {
    k.stockDb.seed('S6', 'Onion', 500, new Date(Date.now() + 2 * 86_400_000));
    await k.orders.placeOrder(k.ana, [salad(1)]);
    expect(k.stockDb.quantity('S6')).toBe(470);
    expect(k.stockDb.quantity('S3')).toBe(500);
  });

  it('does not let two customers take the last of an ingredient', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 150;
    const results = await Promise.allSettled([k.orders.placeOrder(k.ana, [burger(1)]), k.orders.placeOrder(k.ben, [burger(1)])]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(k.stockDb.quantity('S1')).toBe(0);
  });
});

describe('all-or-nothing', () => {
  it('undoes the stock when StockAnalysis fails', async () => {
    k.analysisDb.failAdd = true;
    await expect(k.orders.placeOrder(k.ana, [burger(1), fries(1)])).rejects.toThrow(/analysis database/);
    expect(k.stockDb.quantity('S1')).toBe(1000);
    expect(k.stockDb.quantity('S5')).toBe(3000);
    const all = (await k.menu.showAllMeals()).flatMap((m) => m.prepList).filter((p) => p.type === ORDER_PREP_TYPE);
    expect(all).toHaveLength(0);
    expect(k.orders.ordersFor('ana').orders).toHaveLength(0);
  });

  it('undoes earlier stock changes when a later one fails', async () => {
    k.stockDb.failUpdateFor = 'S3'; // Onion, used after Beef Patty and Brioche Bun
    await expect(k.orders.placeOrder(k.ana, [burger(1)])).rejects.toThrow();
    k.stockDb.failUpdateFor = null;
    expect(k.stockDb.quantity('S1')).toBe(1000);
    expect(k.stockDb.quantity('S2')).toBe(20);
    expect(k.stockDb.quantity('S3')).toBe(500);
  });
});

describe('recipes are not polluted by orders', () => {
  it('a second order still uses the original recipe', async () => {
    await k.orders.placeOrder(k.ana, [burger(1)]);
    await k.orders.placeOrder(k.ben, [burger(1)]);
    expect(k.stockDb.quantity('S1')).toBe(700);
    const m = await k.orders.getMenu();
    expect(m.meals.find((x) => x.name === 'Classic Burger')!.available).toBe(true);
  });
});

describe('pickup notification', () => {
  it('is not ready until the kitchen says so', async () => {
    await k.orders.placeOrder(k.ana, [burger(1)]);
    expect(k.orders.ordersFor('ana').readyForPickup).toBe(false);
  });

  it('notifies the customer, clears the prep tasks, and shows collected after pickup', async () => {
    await k.orders.placeOrder(k.ana, [burger(1)]);
    await k.orders.placeOrder(k.ben, [water(1)]);
    const ready = await k.orders.markReady(1, 'Chef Lee');
    expect(ready).toMatchObject({ status: 'ready', readyBy: 'Chef Lee' });
    expect(k.orders.ordersFor('ana').readyForPickup).toBe(true);
    expect(k.orders.ordersFor('ben').readyForPickup).toBe(false);
    const left = (await k.menu.showAllMeals()).flatMap((m) => m.prepList).filter((p) => p.type === ORDER_PREP_TYPE);
    expect(left).toHaveLength(0);
    expect(k.orders.collected('ana', 1).status).toBe('collected');
    expect(k.orders.ordersFor('ana').readyForPickup).toBe(false);
  });

  it('stays notified while another order is still ready', async () => {
    await k.orders.placeOrder(k.ana, [water(1)]);
    await k.orders.placeOrder(k.ana, [water(1)]);
    await k.orders.markReady(1, 'Chef');
    await k.orders.markReady(2, 'Chef');
    k.orders.collected('ana', 1);
    expect(k.orders.ordersFor('ana').readyForPickup).toBe(true);
    k.orders.collected('ana', 2);
    expect(k.orders.ordersFor('ana').readyForPickup).toBe(false);
  });

  it('refuses unknown, repeated, early and other people\'s orders', async () => {
    await k.orders.placeOrder(k.ana, [water(1)]);
    await expect(k.orders.markReady(99, 'Chef')).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(() => k.orders.collected('ana', 1)).toThrow(OrderValidationError); // not ready
    expect(() => k.orders.collected('ben', 1)).toThrow(OrderNotFoundError);
    await k.orders.markReady(1, 'Chef');
    await expect(k.orders.markReady(1, 'Chef')).rejects.toBeInstanceOf(OrderValidationError);
  });

  it('lists what the kitchen is still preparing', async () => {
    await k.orders.placeOrder(k.ana, [water(1)]);
    await k.orders.placeOrder(k.ben, [water(1)]);
    await k.orders.markReady(1, 'Chef');
    expect(k.orders.preparing().map((o) => o.orderNumber)).toEqual([2]);
  });
});

describe('after a restart', () => {
  it('removes leftover order tasks but never a recipe or a chef\'s own prep step', async () => {
    await k.orders.placeOrder(k.ana, [burger(1)]);
    await k.menu.addPrep({ meal: 'Garden Salad' }, { itemName: 'Wash lettuce', type: 'order', itemQuantity: 1, steps: 'Rinse' }); // type "order" but not an order task name
    const removed = await k.orders.clearOrphanedTasks();
    expect(removed).toBe(3); // Beef Patty, Brioche Bun, Onion for order #1
    const left = (await k.menu.showAllPrep()).map((p) => p.itemName);
    expect(left).toContain('Wash lettuce');
    expect(left).toContain('Beef Patty'); // the recipe
    expect(left.some((n) => n.startsWith('#1 '))).toBe(false);
    expect(await k.orders.clearOrphanedTasks()).toBe(0);
  });
});
