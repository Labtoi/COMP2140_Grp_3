import type { IMenuRepository } from '../interfaces/IMenuRepository';
import type { IPreplistRepository, PrepOwner } from '../interfaces/IPrepListRepository';
import type { IStockService } from '../../../owner/src/interfaces/IStockService';
import type { Dish } from '../models/Dish';
import type { Prep } from '../models/Prep';
import type { SqlDatabaseM } from '../../../owner/src/models/SqlDatabaseM';
import { Customer } from '../../../customer/src/models/Customer';
import { Meal } from '../../../customer/src/models/Meal';
import { MealSide } from '../../../customer/src/models/MealSide';
import { Order } from '../../../customer/src/models/Order';
import { Preferences } from '../../../customer/src/models/Preferences';
import { User } from '../../../customer/src/models/User';
import { Menu, itemKey, matchAllergies, type MenuKind, type MenuLayoutView } from '../../../customer/src/mainClasses/Menu';
import type { NutritionInformation } from './NutritionInformation';
import { PrepList } from '../../../customer/src/mainClasses/PrepList';
import type { StockAnalysis } from '../../../owner/src/mainClasses/StockAnalysis';
import { StockValidationError } from '../../../owner/src/mainClasses/StockManagement';

// ---- errors (the routes turn these into 400 / 404 / 409 / 429) ----

export class OrderValidationError extends Error {}
export class OrderNotFoundError extends Error {}
export class OrderLimitError extends Error {}
/** The kitchen cannot make the order. `unavailable` lists the dishes that cannot be made; `details` is for the logs only. */
export class OrderDeniedError extends Error {
    constructor(message: string, public readonly unavailable: string[], public readonly details: string[] = []) {
        super(message);
    }
}

// ---- limits ----

export const MAX_LINES = 20;
export const MAX_QUANTITY = 10;
/** Stops one account from draining the stock with a pile of orders. */
export const MAX_ACTIVE_ORDERS = 3;
/** Prep rows for an order use this type, so the dish's own recipe rows can be told apart from them. */
export const ORDER_PREP_TYPE = 'order';

// ---- types ----

export interface OrderCustomer { customerID: string; customerName: string; allergies: readonly string[] }
export interface RequestedItem { kind: MenuKind; name: string; quantity: number }
export type OrderStatus = 'preparing' | 'ready' | 'collected';

export interface OrderItemView { kind: MenuKind; name: string; quantity: number; price: number; lineTotal: number }
export interface OrderView {
    orderNumber: number;
    status: OrderStatus;
    placedAt: string;
    readyAt?: string;
    readyBy?: string;
    items: OrderItemView[];
    total: number;
    receipt: string;
}
export interface MyOrders { orders: OrderView[]; readyForPickup: boolean }

/** One prep task the chef has to do for an order (the same rows saved to the prep database). */
export interface KitchenTask { name: string; ingredient: string; quantity: number; steps: string; dish: string; kind: MenuKind }
/** An order as the chef sees it. */
export interface KitchenOrder {
    orderNumber: number; customerName: string; placedAt: string; items: OrderItemView[]; tasks: KitchenTask[];
}

export interface OrderProcessingDeps {
    /** Dishes and their recipes (SqlDatabaseMeals / SqlDatabaseSides). */
    menu: IMenuRepository;
    /** The prep database. */
    prepRepo: IPreplistRepository;
    /** StockManagement: availability and use of stock (updates SqlDatabaseM through IStockRepository). */
    stock: IStockService;
    /** StockAnalysis: receives each accepted order (updates SqlDatabaseA through IAnalysisRepository). */
    analysis: Pick<StockAnalysis, 'addFromItems' | 'remove'>;
    nutrition: Pick<NutritionInformation, 'mealInformation'>;
    now?: () => Date;
}

interface Line { kind: MenuKind; dish: Dish; quantity: number }
interface Need { key: string; name: string; needed: number; dishes: Set<string> }
interface Task { owner: PrepOwner; prep: Prep; list: PrepList; ingredient: string; dish: string; kind: MenuKind }
interface Reservation { itemID: string; name: string; needed: number }
interface OrderRecord {
    orderNumber: number; customerID: string; customerName: string; status: OrderStatus;
    order: Order; items: OrderItemView[]; total: number; placedAt: string;
    readyAt?: string; readyBy?: string; taskNames: string[]; tasks: KitchenTask[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const round2 = (n: number) => Math.round(n * 100) / 100;
const isNotFound = (e: unknown) => /not\s*found/i.test(String((e as { message?: unknown })?.message ?? ''));

/**
 * Places orders and keeps track of them.
 *
 *   order -> PrepList (made from each dish's recipe)
 *         -> StockManagement (IStockService): is there stock for it? if not, the order is denied
 *         -> stock used (SqlDatabaseM, through IStockRepository)
 *         -> prep info saved to the prep database (IPreplistRepository)
 *         -> order details to StockAnalysis (SqlDatabaseA, through IAnalysisRepository)
 *
 * If any step fails, the steps before it are undone, so a failed order leaves no trace.
 * Orders are held in memory, like login sessions: a server restart forgets them.
 */
export class OrderProcessing {
    private readonly records = new Map<number, OrderRecord>();
    private readonly customers = new Map<string, Customer>();
    private nextNumber = 1;
    private chain: Promise<unknown> = Promise.resolve();

    constructor(private readonly deps: OrderProcessingDeps) {}

    // ---- the menu, with what can be made right now ----

    async getMenu(customerAllergies: readonly string[] = []): Promise<MenuLayoutView> {
        const [meals, sides] = await Promise.all([this.deps.menu.showAllMeals(), this.deps.menu.showAllSides()]);
        const menu = Menu.fromDishes(meals, sides, (d) => this.deps.nutrition.mealInformation(d));

        const unavailable = new Set<string>();
        const lines: Line[] = [
            ...meals.map((dish): Line => ({ kind: 'meal', dish, quantity: 1 })),
            ...sides.map((dish): Line => ({ kind: 'side', dish, quantity: 1 })),
        ];
        try {
            const stock = await this.stockView();
            for (const line of lines) {
                const { blocked } = await this.checkStock(stock, this.needsOf([line]));
                if (blocked.size) unavailable.add(itemKey(line.kind, line.dish.name));
            }
        } catch (e) {
            // The menu is still worth showing when stock cannot be read, but nothing can be ordered
            // because availability cannot be confirmed. The real error goes to the server log.
            console.error('Could not read stock for the menu:', e);
            for (const line of lines) unavailable.add(itemKey(line.kind, line.dish.name));
        }
        return menu.MenuLayout({ unavailable, customerAllergies });
    }

    /**
     * Orders are held in memory, so after a restart the order tasks saved in the prep database belong to
     * orders that are no longer tracked. This removes them. Call it once when the server starts.
     * Only rows of type "order" named like "#12 Beef Patty for Classic Burger" are touched, never a dish's recipe.
     */
    async clearOrphanedTasks(): Promise<number> {
        const orphans = (await this.deps.prepRepo.showAllPrep()).filter((p) => p.type === ORDER_PREP_TYPE && /^#\d+ .+ for .+$/.test(p.itemName));
        for (const p of orphans) await this.deps.prepRepo.removePrep(p.itemName);
        return orphans.length;
    }

    // ---- placing an order ----

    placeOrder(customer: OrderCustomer, requested: unknown): Promise<OrderView> {
        // One at a time, so two customers cannot both be given the last of an ingredient.
        return this.exclusive(() => this.place(customer, requested));
    }

    private async place(customer: OrderCustomer, requested: unknown): Promise<OrderView> {
        const items = this.cleanItems(requested);
        const active = [...this.records.values()].filter((r) => r.customerID === customer.customerID && r.status === 'preparing');
        if (active.length >= MAX_ACTIVE_ORDERS) {
            throw new OrderLimitError(`You already have ${active.length} orders being prepared. Please wait until one is ready.`);
        }

        const lines = await this.loadLines(items);
        for (const l of lines) {
            const hits = matchAllergies(l.dish.allergens, customer.allergies);
            if (hits.length) {
                throw new OrderValidationError(`${l.dish.name} contains ${hits.join(', ')}, which is in your allergy profile, so it can't be ordered.`);
            }
        }

        const orderNumber = this.nextNumber;
        const order = new Order(orderNumber, customer.customerName);
        for (const l of lines) {
            for (let i = 0; i < l.quantity; i++) {
                if (l.kind === 'meal') order.AddMeal(new Meal(l.dish.name, l.dish.name, l.dish.price));
                else order.AddSide(new MealSide(l.dish.name, l.dish.name, l.dish.price));
            }
        }
        if (!order.ValidateOrder()) throw new OrderValidationError('Add at least one item to your order.');

        // 1. the order goes to the PrepList: what has to be prepared, and how much of each ingredient
        const tasks = this.buildTasks(orderNumber, lines);
        // 2. StockManagement says whether the stock is there
        const reservations = await this.reserve(lines);

        const placedAt = (this.deps.now?.() ?? new Date()).toLocaleString('sv-SE');
        const analysisId = `ORD-${Date.parse(placedAt)}-${orderNumber}`;
        const draft = {
            id: analysisId, date: placedAt,
            meals: lines.filter((l) => l.kind === 'meal').map((l) => ({ name: l.dish.name, price: l.dish.price, quantity: l.quantity })),
            sides: lines.filter((l) => l.kind === 'side').map((l) => ({ name: l.dish.name, price: l.dish.price, quantity: l.quantity })),
        };

        // 3-5. use the stock, save the prep info, tell StockAnalysis. Anything that fails undoes what came before.
        const undo: Array<() => Promise<void>> = [];
        try {
            for (const r of reservations) {
                try {
                    await this.deps.stock.amountUsed(r.itemID, r.needed);
                } catch (e) {
                    if (e instanceof StockValidationError) {
                        // stock changed since the check (another server, or a restock/use by staff)
                        throw new OrderDeniedError('Sorry, we no longer have enough stock for this order.', this.dishNames(lines), [`${r.name}: ${e.message}`]);
                    }
                    throw e;
                }
                // StockManagement has no "return stock" method; a negative amount adds it back.
                undo.push(() => this.deps.stock.amountUsed(r.itemID, -r.needed));
            }
            for (const t of tasks) {
                await this.deps.prepRepo.addPrep(t.owner, t.prep);
                undo.push(() => this.deps.prepRepo.removePrep(t.prep.itemName));
            }
            await this.deps.analysis.addFromItems(draft);
            undo.push(() => this.deps.analysis.remove(analysisId));
        } catch (e) {
            for (const step of undo.reverse()) {
                try { await step(); } catch (undoError) { console.error('Could not undo an order step', undoError); }
            }
            throw e;
        }

        // accepted
        this.nextNumber += 1;
        const itemViews: OrderItemView[] = lines.map((l) => ({
            kind: l.kind, name: l.dish.name, quantity: l.quantity, price: l.dish.price, lineTotal: round2(l.dish.price * l.quantity),
        }));
        const record: OrderRecord = {
            orderNumber, customerID: customer.customerID, customerName: customer.customerName, status: 'preparing',
            order, items: itemViews, total: round2(order.TotalCost()), placedAt, taskNames: tasks.map((t) => t.prep.itemName),
            tasks: tasks.map((t) => ({
                name: t.prep.itemName, ingredient: t.ingredient, quantity: t.prep.itemQuantity, steps: t.prep.steps,
                dish: t.dish, kind: t.kind,
            })),
        };
        this.records.set(orderNumber, record);
        this.customerFor(customer).OrderReadyReset();
        this.prune();
        return this.view(record);
    }

    // ---- pickup notification ----

    /** A customer's orders and whether any is ready (the Customer class carries the notification, INotification). */
    ordersFor(customerID: string): MyOrders {
        const orders = [...this.records.values()].filter((r) => r.customerID === customerID)
            .sort((a, b) => b.orderNumber - a.orderNumber).map((r) => this.view(r));
        return { orders, readyForPickup: this.customers.get(customerID)?.ReadyForPickup() ?? false };
    }

    /** The kitchen has finished an order: its prep tasks come off the list and the customer is notified. */
    markReady(orderNumber: number, chefName: string): Promise<OrderView> {
        return this.exclusive(async () => {
            const r = this.find(orderNumber);
            if (r.status !== 'preparing') throw new OrderValidationError(`Order #${orderNumber} is already ${r.status}.`);
            for (const name of r.taskNames) await this.deps.prepRepo.removePrep(name); // a failure here leaves the order as it was, so it can be retried
            r.status = 'ready';
            r.readyAt = (this.deps.now?.() ?? new Date()).toISOString();
            r.readyBy = chefName;
            const customer = this.customers.get(r.customerID);
            customer?.OrderReady(chefName, customer.realName, r.order);
            return this.view(r);
        });
    }

    /** The customer has picked the order up. */
    collected(customerID: string, orderNumber: number): OrderView {
        const r = this.records.get(orderNumber);
        if (!r || r.customerID !== customerID) throw new OrderNotFoundError(`Order #${orderNumber} was not found.`);
        if (r.status !== 'ready') throw new OrderValidationError(`Order #${orderNumber} is not ready yet.`);
        r.status = 'collected';
        const stillReady = [...this.records.values()].some((o) => o.customerID === customerID && o.status === 'ready');
        if (!stillReady) {
            const customer = this.customers.get(customerID);
            customer?.ReadyForPickupReset();
            customer?.OrderReadyReset();
        }
        return this.view(r);
    }

    /** Orders the kitchen is still working on, oldest first, with the prep tasks the chef has to do. */
    preparing(): KitchenOrder[] {
        return [...this.records.values()].filter((r) => r.status === 'preparing')
            .sort((a, b) => a.orderNumber - b.orderNumber)
            .map((r) => ({ orderNumber: r.orderNumber, customerName: r.customerName, placedAt: r.placedAt, items: r.items, tasks: r.tasks }));
    }

    // ---- building the prep list ----

    private needsOf(lines: Line[]): Map<string, Need> {
        const needs = new Map<string, Need>();
        for (const l of lines) {
            for (const p of this.recipe(l.dish)) {
                const key = norm(p.itemName);
                const need = needs.get(key) ?? { key, name: p.itemName, needed: 0, dishes: new Set<string>() };
                need.needed += p.itemQuantity * l.quantity;
                need.dishes.add(itemKey(l.kind, l.dish.name));
                needs.set(key, need);
            }
        }
        return needs;
    }

    /** A dish's own prep rows are its recipe. Rows made for earlier orders are not. */
    private recipe(dish: Dish): Prep[] {
        return dish.prepList.filter((p) => p.type !== ORDER_PREP_TYPE);
    }

    private buildTasks(orderNumber: number, lines: Line[]): Task[] {
        const tasks: Task[] = [];
        for (const l of lines) {
            for (const p of this.recipe(l.dish)) {
                const list = new PrepList(l.kind === 'meal' ? { meal: new Meal(l.dish.name, l.dish.name, l.dish.price) } : { side: new MealSide(l.dish.name, l.dish.name, l.dish.price) });
                list.PrepInformation({
                    // the name is unique to this order and dish, so staff can update or remove it without touching the recipe
                    itemName: `#${orderNumber} ${p.itemName} for ${l.dish.name}`,
                    type: ORDER_PREP_TYPE,
                    itemQuantity: p.itemQuantity * l.quantity,
                    steps: `${l.quantity} x ${l.dish.name}. ${p.steps}`.trim(),
                });
                const prep: Prep = { itemName: list.itemName, type: list.type, itemQuantity: list.itemQuantity, steps: list.steps };
                tasks.push({
                    owner: l.kind === 'meal' ? { meal: l.dish.name } : { side: l.dish.name }, prep, list,
                    ingredient: p.itemName, dish: l.dish.name, kind: l.kind,
                });
            }
        }
        return tasks;
    }

    // ---- stock ----

    private async stockView() {
        const items = await this.deps.stock.getAllItems();
        const memo = new Map<string, Promise<boolean>>();
        const usable = (id: string) => {
            if (!memo.has(id)) memo.set(id, this.deps.stock.itemAvailabilityForMealPrep(id));
            return memo.get(id)!;
        };
        return { items, usable };
    }

    /** Which ingredients can be covered from stock. Nothing is changed here. */
    private async checkStock(stock: Awaited<ReturnType<OrderProcessing['stockView']>>, needs: Map<string, Need>) {
        const reservations: Reservation[] = [];
        const blocked = new Set<string>();
        const reasons: string[] = [];
        const fail = (need: Need, reason: string) => {
            reasons.push(`${need.name}: ${reason}`);
            need.dishes.forEach((d) => blocked.add(d));
        };
        for (const need of needs.values()) {
            const matches = stock.items.filter((i) => norm(i.itemName) === need.key);
            if (!matches.length) { fail(need, 'no stock record'); continue; }
            const usable: SqlDatabaseM[] = [];
            for (const m of matches) if (await stock.usable(m.itemID)) usable.push(m);
            if (!usable.length) { fail(need, 'out of stock or expired'); continue; }
            const enough = usable.filter((m) => m.itemQuantity >= need.needed)
                .sort((a, b) => (a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity) - (b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity)); // use the batch that expires first
            if (!enough.length) { fail(need, `need ${need.needed}, have ${Math.max(...usable.map((m) => m.itemQuantity))}`); continue; }
            reservations.push({ itemID: enough[0].itemID, name: need.name, needed: need.needed });
        }
        return { reservations, blocked, reasons };
    }

    private async reserve(lines: Line[]): Promise<Reservation[]> {
        const { reservations, blocked, reasons } = await this.checkStock(await this.stockView(), this.needsOf(lines));
        if (blocked.size) {
            const names = lines.filter((l) => blocked.has(itemKey(l.kind, l.dish.name))).map((l) => l.dish.name);
            throw new OrderDeniedError(
                `Sorry, we can't make ${names.join(', ')} right now. Nothing was ordered.`, [...new Set(names)], reasons);
        }
        return reservations;
    }

    // ---- helpers ----

    private cleanItems(requested: unknown): RequestedItem[] {
        if (!Array.isArray(requested) || !requested.length) throw new OrderValidationError('Add at least one item to your order.');
        if (requested.length > MAX_LINES) throw new OrderValidationError(`An order can have at most ${MAX_LINES} different items.`);
        const merged = new Map<string, RequestedItem>();
        for (const r of requested) {
            const kind = r?.kind;
            const name = typeof r?.name === 'string' ? r.name.trim() : '';
            const quantity = r?.quantity;
            if (kind !== 'meal' && kind !== 'side') throw new OrderValidationError('Each item must be a meal or a side.');
            if (!name) throw new OrderValidationError('Each item needs a name.');
            if (!Number.isInteger(quantity) || quantity < 1) throw new OrderValidationError('Each quantity must be a whole number of 1 or more.');
            const key = itemKey(kind, name);
            const total = (merged.get(key)?.quantity ?? 0) + quantity;
            if (total > MAX_QUANTITY) throw new OrderValidationError(`You can order at most ${MAX_QUANTITY} of any one item.`);
            merged.set(key, { kind, name, quantity: total });
        }
        return [...merged.values()];
    }

    private async loadLines(items: RequestedItem[]): Promise<Line[]> {
        return Promise.all(items.map(async (i): Promise<Line> => {
            try {
                const dish = i.kind === 'meal' ? await this.deps.menu.getMeal(i.name) : await this.deps.menu.getSide(i.name);
                return { kind: i.kind, dish, quantity: i.quantity };
            } catch (e) {
                if (isNotFound(e)) throw new OrderValidationError(`"${i.name}" is not on the menu.`);
                throw e; // a database error must not look like a bad order
            }
        }));
    }

    private dishNames(lines: Line[]) { return lines.map((l) => l.dish.name); }

    private customerFor(c: OrderCustomer): Customer {
        let customer = this.customers.get(c.customerID);
        if (!customer) {
            customer = new Customer(new User(c.customerName, c.customerID), new Preferences([...c.allergies]), c.customerName);
            this.customers.set(c.customerID, customer);
        }
        return customer;
    }

    private find(orderNumber: number): OrderRecord {
        const r = this.records.get(orderNumber);
        if (!r) throw new OrderNotFoundError(`Order #${orderNumber} was not found.`);
        return r;
    }

    private view(r: OrderRecord): OrderView {
        return {
            orderNumber: r.orderNumber, status: r.status, placedAt: r.placedAt, readyAt: r.readyAt, readyBy: r.readyBy,
            items: r.items, total: r.total, receipt: r.order.Receipt(),
        };
    }

    /** Forgets orders that were picked up more than 12 hours ago. */
    private prune() {
        const cutoff = (this.deps.now?.() ?? new Date()).getTime() - 12 * 3_600_000;
        for (const [n, r] of this.records) if (r.status === 'collected' && Date.parse(r.readyAt ?? r.placedAt) < cutoff) this.records.delete(n);
    }

    private exclusive<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.chain.then(fn, fn);
        this.chain = run.catch(() => undefined);
        return run;
    }
}
