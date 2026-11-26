import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createOrderRouter } from '../customer/src/routes/orderRouting';
import { createSession } from '../customer/src/middleware/customerAuth';
import type { ICustomerRepo } from '../customer/src/interfaces/ICustomerRepo';
import { burger, fries, makeKitchen, water, type Kitchen } from './helpers/kitchen';

const accounts = {
  GetCustomerByID: async (id: string) => ({
    customerID: id, customerName: id === 'ana' ? 'Ana' : 'Ben',
    customerPreferences: { allergies: id === 'ben' ? ['dairy'] : [], foodPreferences: [] },
  }),
} as unknown as ICustomerRepo;

let k: Kitchen; let server: Server; let base = '';
const ana = createSession('ana');
const ben = createSession('ben');

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { // rebuild the router per request so each test gets a fresh kitchen
    createOrderRouter({ accounts, orders: k.orders, nutrition: k.nutrition })(req, res, next);
  });
  server = await new Promise<Server>((ok) => { const s = app.listen(0, () => ok(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });
beforeEach(async () => { k = await makeKitchen(); });

const call = async (method: string, path: string, opts: { token?: string; chefKey?: string; body?: unknown } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const r = await fetch(base + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  return { status: r.status, cache: r.headers.get('cache-control'), json: await r.json() as any };
};

describe('login is required', () => {
  it.each([['GET', '/Menu'], ['GET', '/Menu/meal/Classic%20Burger'], ['POST', '/Orders'], ['GET', '/Orders/mine'], ['POST', '/Orders/1/collected']])(
    '%s %s -> 401 without a session', async (m, p) => { expect((await call(m, p)).status).toBe(401); });
  it('rejects a made-up token', async () => { expect((await call('GET', '/Menu', { token: 'nope' })).status).toBe(401); });
});

describe('menu', () => {
  it('returns meals and sides with nutrition and allergens, not cached', async () => {
    const r = await call('GET', '/Menu', { token: ana });
    expect(r.status).toBe(200);
    expect(r.cache).toBe('no-store');
    expect(r.json.data.meals.map((m: any) => m.name)).toEqual(['Classic Burger', 'Garden Salad']);
    expect(r.json.data.sides.map((m: any) => m.name)).toEqual(['Fries', 'Water']);
    expect(r.json.data.meals[0].allergens).toEqual(['gluten', 'dairy']);
    expect(r.json.data.meals[0].nutrition.available).toBe(true);
  });
  it('warns using the logged-in customer\'s own allergies', async () => {
    const r = await call('GET', '/Menu', { token: ben });
    expect(r.json.data.meals.find((m: any) => m.name === 'Classic Burger').allergyWarning).toEqual(['dairy']);
  });
  it('gives a nutrition label for a portion', async () => {
    const r = await call('GET', '/Menu/meal/Classic%20Burger?weight=200', { token: ana });
    expect(r.status).toBe(200);
    expect(r.json.data.name ?? r.json.data.item?.name).toBeTruthy();
  });
  it('404 for an unknown item, 400 for a bad kind or weight', async () => {
    expect((await call('GET', '/Menu/meal/Nothing', { token: ana })).status).toBe(404);
    expect((await call('GET', '/Menu/drink/Water', { token: ana })).status).toBe(400);
    expect((await call('GET', '/Menu/meal/Classic%20Burger?weight=-5', { token: ana })).status).toBe(400);
  });
});

describe('orders', () => {
  it('201 with the order', async () => {
    const r = await call('POST', '/Orders', { token: ana, body: { items: [burger(1), fries(1)] } });
    expect(r.status).toBe(201);
    expect(r.json.data).toMatchObject({ orderNumber: 1, status: 'preparing', total: 16.5 });
  });
  it('409 and the dish names when stock is short, nothing used', async () => {
    k.stockDb.rows.get('S1')!.itemQuantity = 0;
    const r = await call('POST', '/Orders', { token: ana, body: { items: [burger(1)] } });
    expect(r.status).toBe(409);
    expect(r.json.unavailable).toEqual(['Classic Burger']);
    expect(JSON.stringify(r.json)).not.toContain('Beef Patty');
    expect(k.stockDb.quantity('S2')).toBe(20);
  });
  it('400 for bad input and for an allergen the customer has', async () => {
    expect((await call('POST', '/Orders', { token: ana, body: {} })).status).toBe(400);
    expect((await call('POST', '/Orders', { token: ana, body: { items: [{ kind: 'meal', name: 'Classic Burger', quantity: 0 }] } })).status).toBe(400);
    expect((await call('POST', '/Orders', { token: ben, body: { items: [burger(1)] } })).status).toBe(400);
  });
  it('429 past the active-order limit', async () => {
    for (let i = 0; i < 3; i++) await call('POST', '/Orders', { token: ana, body: { items: [water(1)] } });
    expect((await call('POST', '/Orders', { token: ana, body: { items: [water(1)] } })).status).toBe(429);
  });
  it('shows only the customer\'s own orders', async () => {
    await call('POST', '/Orders', { token: ana, body: { items: [water(1)] } });
    expect((await call('GET', '/Orders/mine', { token: ana })).json.data.orders).toHaveLength(1);
    expect((await call('GET', '/Orders/mine', { token: ben })).json.data.orders).toHaveLength(0);
    expect((await call('POST', '/Orders/1/collected', { token: ben })).status).toBe(404);
  });
});
