import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createOrderRouter } from '../customer/src/routes/orderRouting';
import { createChefRouter } from '../chef/src/routes/chefRouting';
import { createStockRouter } from '../owner/src/routes/stockRouting';
import { createRouter as createAnalysisRouter } from '../owner/src/routes/analysisRouting';
import { createSession } from '../customer/src/middleware/customerAuth';
import { issueChefToken } from '../chef/src/middleware/chefAuth';
import { ORDER_PREP_TYPE } from '../shared/src/mainClasses/OrderProcessing';
import { burger, fries, makeKitchen, salad, water, type Kitchen } from './helpers/kitchen';

/**
 * Customer -> chef -> customer, through the real routers of all three roles on one server,
 * with the real classes and in-memory databases.
 */

const customers: Record<string, { name: string; allergies: string[] }> = { ana: { name: 'Ana', allergies: [] }, ben: { name: 'Ben', allergies: [] } };
const accounts = {
  GetCustomerByID: async (id: string) => ({
    customerID: id, customerName: customers[id].name, customerPassword: 'x',
    customerPreferences: { allergies: customers[id].allergies, foodPreferences: [] },
  }),
  GetAllChefs: async () => [{ chefID: 'chef1', chefName: 'Chef Lee', chefPassword: 'x' }],
  GetChefByID: async (id: string) => ({ chefID: id, chefName: 'Chef Lee', chefPassword: 'x' }),
} as any;

let k: Kitchen; let server: Server; let base = '';
const ana = createSession('ana');
const ben = createSession('ben');
const chef = issueChefToken('chef1');
const ghostChef = issueChefToken('nobody'); // a valid token for a chef who no longer exists
process.env.OWNER_KEY = 'owner-secret';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { // fresh kitchen per test
    const router = express.Router();
    router.use(createOrderRouter({ accounts, orders: k.orders, nutrition: k.nutrition }));
    router.use(createChefRouter(k.nutrition, k.menu as any, accounts, k.orders));
    router.use(createStockRouter(k.stock));
    router.use(createAnalysisRouter(k.analysis));
    router(req, res, next);
  });
  server = await new Promise<Server>((ok) => { const s = app.listen(0, () => ok(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });
beforeEach(async () => { k = await makeKitchen(); });

const call = async (method: string, path: string, opts: { token?: string; owner?: boolean; body?: unknown } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.owner) headers['x-owner-key'] = 'owner-secret';
  const r = await fetch(base + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
};
const order = (token: string, items: unknown[]) => call('POST', '/Orders', { token, body: { items } });

describe('a customer order reaches the chef', () => {
  it('shows up on the chef\'s list with the customer, the items and the prep tasks', async () => {
    expect((await call('GET', '/Chef/Orders', { token: chef })).json.data).toEqual([]);
    const placed = await order(ana, [burger(2), fries(1)]);
    expect(placed.status).toBe(201);

    const r = await call('GET', '/Chef/Orders', { token: chef });
    expect(r.status).toBe(200);
    expect(r.json.data).toHaveLength(1);
    const o = r.json.data[0];
    expect(o).toMatchObject({ orderNumber: 1, customerName: 'Ana' });
    expect(o.items.map((i: any) => `${i.quantity} ${i.name}`)).toEqual(['2 Classic Burger', '1 Fries']);
    const patty = o.tasks.find((t: any) => t.ingredient === 'Beef Patty');
    expect(patty).toMatchObject({ quantity: 300, dish: 'Classic Burger', kind: 'meal' });
    expect(patty.steps).toContain('Grill 4 minutes per side');
  });

  it('lists orders oldest first, from different customers', async () => {
    await order(ben, [water(1)]);
    await order(ana, [salad(1)]);
    const r = await call('GET', '/Chef/Orders', { token: chef });
    expect(r.json.data.map((o: any) => `${o.orderNumber}:${o.customerName}`)).toEqual(['1:Ben', '2:Ana']);
  });

  it('also saves the prep tasks in the prep database, where the chef\'s Prep tab can see them', async () => {
    await order(ana, [burger(1)]);
    const prep = (await call('GET', '/Chef/Prep', { token: chef })).json.data as any[];
    const task = prep.find((p) => p.itemName === '#1 Beef Patty for Classic Burger');
    expect(task).toMatchObject({ type: ORDER_PREP_TYPE, itemQuantity: 150 });
  });

  it('does not show an order that was denied', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 0;
    expect((await order(ana, [burger(1)])).status).toBe(409);
    expect((await call('GET', '/Chef/Orders', { token: chef })).json.data).toEqual([]);
  });

  it('is only for logged-in chefs', async () => {
    await order(ana, [water(1)]);
    expect((await call('GET', '/Chef/Orders')).status).toBe(401);
    expect((await call('GET', '/Chef/Orders', { token: ana })).status).toBe(401); // a customer session is not a chef login
    expect((await call('POST', '/Chef/Orders/1/ready', { token: ana })).status).toBe(401);
    expect((await call('GET', '/Chef/Orders', { token: ghostChef })).status).toBe(401); // chef account removed
    expect((await call('GET', '/Orders/mine', { token: chef })).status).toBe(401); // and a chef is not a customer
  });
});

describe('when the chef completes the order, the customer is notified', () => {
  it('the whole journey', async () => {
    await order(ana, [burger(1), fries(1)]);
    await order(ben, [water(1)]);
    expect((await call('GET', '/Orders/mine', { token: ana })).json.data.readyForPickup).toBe(false);

    const done = await call('POST', '/Chef/Orders/1/ready', { token: chef });
    expect(done.status).toBe(200);
    expect(done.json.data).toMatchObject({ orderNumber: 1, status: 'ready', readyBy: 'Chef Lee' });

    // Ana is told; Ben (whose order is still being prepared) is not
    const anaView = (await call('GET', '/Orders/mine', { token: ana })).json.data;
    expect(anaView.readyForPickup).toBe(true);
    expect(anaView.orders[0]).toMatchObject({ orderNumber: 1, status: 'ready', readyBy: 'Chef Lee' });
    expect((await call('GET', '/Orders/mine', { token: ben })).json.data.readyForPickup).toBe(false);

    // gone from the chef's list; Ben's order is still there; Ana's prep tasks are cleared
    expect((await call('GET', '/Chef/Orders', { token: chef })).json.data.map((o: any) => o.orderNumber)).toEqual([2]);
    const prep = (await call('GET', '/Chef/Prep', { token: chef })).json.data as any[];
    expect(prep.filter((p) => String(p.itemName).startsWith('#1 '))).toHaveLength(0);
    expect(prep.filter((p) => String(p.itemName).startsWith('#2 ')).length).toBe(0); // water has no recipe

    // Ana picks it up; the notification clears
    expect((await call('POST', '/Orders/1/collected', { token: ana })).json.data.status).toBe('collected');
    expect((await call('GET', '/Orders/mine', { token: ana })).json.data.readyForPickup).toBe(false);
  });

  it('a customer cannot mark their own order ready', async () => {
    await order(ana, [water(1)]);
    expect((await call('POST', '/Chef/Orders/1/ready', { token: ana })).status).toBe(401);
    expect((await call('GET', '/Orders/mine', { token: ana })).json.data.readyForPickup).toBe(false);
  });

  it('refuses an unknown order, a bad number and a repeat', async () => {
    await order(ana, [water(1)]);
    expect((await call('POST', '/Chef/Orders/99/ready', { token: chef })).status).toBe(404);
    expect((await call('POST', '/Chef/Orders/abc/ready', { token: chef })).status).toBe(400);
    expect((await call('POST', '/Chef/Orders/1/ready', { token: chef })).status).toBe(200);
    expect((await call('POST', '/Chef/Orders/1/ready', { token: chef })).status).toBe(400);
  });
});

describe('the owner sees the effect of an accepted order', () => {
  it('stock goes down and analysis records the sale', async () => {
    await order(ana, [burger(2), fries(1), water(1)]);
    const stock = await call('GET', '/Stock', { owner: true });
    expect(stock.status).toBe(200);
    const qty = (name: string) => (stock.json.data as any[]).find((i) => i.itemName === name).itemQuantity;
    expect(qty('Beef Patty')).toBe(700);
    expect(qty('Potatoes')).toBe(2700);

    const sales = await call('GET', '/Analysis', { owner: true });
    expect(sales.status).toBe(200);
    const rows = sales.json.data as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ revenue: 30, mealsSold: 2, sidesSold: 2 });
  });

  it('a denied order changes neither', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 100;
    await order(ana, [burger(1)]);
    expect(((await call('GET', '/Analysis', { owner: true })).json.data as any[])).toHaveLength(0);
    expect(k.stockDb.quantity('S1')).toBe(100);
  });
});
