import type { INutritionRepository } from '../interfaces/INutritionRepository';
import type { IOwnerNutritionServiceRepo } from '../interfaces/IOwnerNutritionServiceRepo';
import type { Allergen, Dish } from '../models/MSModels';

// ---- Types and messages used only by this feature. Kept here so no new file is needed in models/. ----

export type ItemKind = 'meal' | 'side';
export type Role = 'customer' | 'chef' | 'owner';

export interface Actor {
    id: string;
    role: Role;
}

/** The six numeric nutrition fields on Dish. Stored per 100 g (SRS TS-3) and scaled to the portion shown. */
export type NutritionFacts = Pick<Dish, 'calories' | 'carbohydrates' | 'protein' | 'sodium' | 'fats' | 'vitamins'>;

/** A dish as sent to the browser. Prep steps belong to Req 5 and are staff-only (DC-7), so they are left out. */
export type MenuEntry = Omit<Dish, 'prepList'>;

/** What a caller sends to create an item. */
export interface NewDish {
    kind: ItemKind;
    name: string;
    details?: string;
    /** Dollars with up to 2 decimals, like the numeric(8,2) price column (e.g. 12.5). */
    price: number;
    nutrition?: NutritionFacts;
    allergens?: string[];
}

/** What the customer sees for one item at one portion size. */
export interface NutritionView {
    name: string;
    available: boolean;
    message?: string;
    weightG?: number;
    calories?: number;
    proteinG?: number;
    carbohydratesG?: number;
    fatsG?: number;
    sodiumMg?: number;
    vitamins?: number;
    allergens: string;
}

export const NUTRITION_UNAVAILABLE = 'Nutritional information not available';
export const ALLERGENS_UNAVAILABLE = 'Allergen information not available';

/** Runtime copy of the Allergen type, used to validate input. */
export const ALLERGEN_LIST = [
    'gluten', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'fish', 'shellfish', 'sesame',
] as const satisfies readonly Allergen[];

// Compile error here means an allergen was added to the Allergen type but not to ALLERGEN_LIST.
const _allergenListIsComplete: [Exclude<Allergen, (typeof ALLERGEN_LIST)[number]>] extends [never] ? true : never = true;
void _allergenListIsComplete;

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class UnauthorizedError extends Error {
    constructor(message = 'Only the chef can add, update or remove nutritional information and allergens.') {
        super(message);
    }
}

export function parseKind(value: string): ItemKind {
    if (value !== 'meal' && value !== 'side') throw new ValidationError('kind must be "meal" or "side"');
    return value;
}

const NUTRITION_KEYS = ['calories', 'carbohydrates', 'protein', 'sodium', 'fats', 'vitamins'] as const;
const NO_NUTRITION: NutritionFacts = { calories: 0, carbohydrates: 0, protein: 0, sodium: 0, fats: 0, vitamins: 0 };

/** Stored values are per this many grams (SRS TS-3: "250 g of an item at 100 kcal per 100 g shows 250 kcal"). */
const BASIS_G = 100;

/**
 * Dish has no "nutrition recorded" flag and the repository turns missing columns into 0, so an item
 * whose six values are all 0 is treated as having no nutritional data (SRS TS-2).
 */
export const hasNutritionData = (d: NutritionFacts): boolean => NUTRITION_KEYS.some((k) => d[k] > 0);

/** Matches the numeric(8,2) price column: 0 up to 999999.99, at most 2 decimal places. */
const isValidPrice = (p: unknown): boolean =>
    typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 999999.99 && Math.abs(p * 100 - Math.round(p * 100)) < 1e-6;

const stripPrep = (d: Dish): MenuEntry => {
    const { prepList: _prepList, ...rest } = d;
    return rest;
};

/** SqlMSRepository throws `"<name>" not found in <table>` for a missing row; Supabase errors are plain objects. */
const isNotFound = (e: unknown): boolean => /not\s*found/i.test(String((e as { message?: unknown })?.message ?? ''));

function cleanAllergens(list: unknown): Allergen[] {
    if (!Array.isArray(list)) throw new ValidationError('allergens must be a list');
    const out = new Set<Allergen>();
    for (const raw of list) {
        const a = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_'); // "Tree nuts" -> "tree_nuts"
        if (!a) continue;
        if (!(ALLERGEN_LIST as readonly string[]).includes(a)) {
            throw new ValidationError(`unknown allergen "${raw}". Use: ${ALLERGEN_LIST.join(', ')}`);
        }
        out.add(a as Allergen);
    }
    return [...out];
}

/** Checks the values that were given. With partial = false every one of the six must be present. */
function readFacts(input: unknown, partial: boolean): Partial<NutritionFacts> {
    if (!input || typeof input !== 'object') throw new ValidationError('nutrition facts are required');
    const given = input as Record<string, unknown>;
    const out: Partial<NutritionFacts> = {};
    for (const k of NUTRITION_KEYS) {
        const v = given[k];
        if (v === undefined) {
            if (!partial) throw new ValidationError(`${k} is required`);
            continue;
        }
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            throw new ValidationError(`${k} must be a number that is 0 or more`);
        }
        out[k] = v;
    }
    return out;
}

function requireSomeData(f: NutritionFacts) {
    if (!hasNutritionData(f)) throw new ValidationError('at least one nutrition value must be above 0');
}

export class NutritionInformation {
    // The interfaces are injected through the constructor, same pattern as the analysis service.
    // The Owner only gets the narrow read-only view (class diagram: IOwnerNutritionServiceRepo).
    constructor(
        private readonly repo: INutritionRepository,
        private readonly ownerRepo: IOwnerNutritionServiceRepo = repo,
    ) {}

    // ---- Customer side (SR-3.1, SR-3.2) ----

    async getAll(kind: ItemKind): Promise<MenuEntry[]> {
        const dishes = kind === 'meal' ? await this.repo.showAllMeals() : await this.repo.showAllSides();
        return dishes.map(stripPrep);
    }

    async getInformation(kind: ItemKind, name: string, weightG?: number): Promise<NutritionView> {
        return this.mealInformation(await this.find(kind, name), weightG);
    }

    /** MealInformation(meal) in the class diagram. Scales the per-100 g values to the portion. */
    mealInformation(dish: MenuEntry, weightG?: number): NutritionView {
        const allergens = dish.allergens.length ? dish.allergens.join(', ') : ALLERGENS_UNAVAILABLE;
        if (!hasNutritionData(dish)) {
            return { name: dish.name, available: false, message: NUTRITION_UNAVAILABLE, allergens };
        }
        const w = weightG ?? BASIS_G;
        if (!Number.isFinite(w) || w <= 0) throw new ValidationError('weight must be greater than 0 g');
        const scale = (per100: number) => Math.round((per100 * w) / 10) / 10; // 1 decimal place
        return {
            name: dish.name, available: true, weightG: w,
            calories: Math.round((dish.calories * w) / BASIS_G),
            proteinG: scale(dish.protein),
            carbohydratesG: scale(dish.carbohydrates),
            fatsG: scale(dish.fats),
            sodiumMg: Math.round((dish.sodium * w) / BASIS_G),
            vitamins: scale(dish.vitamins),
            allergens,
        };
    }

    // ---- Owner side: read-only (IOwnerNutritionServiceRepo) ----

    async getOwnerOverview(actor: Actor): Promise<{ meals: NutritionView[]; sides: NutritionView[] }> {
        if (actor.role !== 'owner' && actor.role !== 'chef') {
            throw new UnauthorizedError('Only the owner or chef can view the full nutrition overview.');
        }
        const [meals, sides] = await Promise.all([this.ownerRepo.showAllMeals(), this.ownerRepo.showAllSides()]);
        return { meals: meals.map((m) => this.mealInformation(m)), sides: sides.map((s) => this.mealInformation(s)) };
    }

    // ---- Chef side (SR-3.3) ----

    async createItem(actor: Actor, input: NewDish): Promise<MenuEntry> {
        this.assertCanEdit(actor);
        const kind = parseKind(String(input?.kind));
        const name = String(input.name ?? '').trim();
        if (!name) throw new ValidationError('name is required');
        if (!isValidPrice(input.price)) {
            throw new ValidationError('price must be between 0 and 999999.99, with at most 2 decimal places');
        }
        let facts = NO_NUTRITION;
        if (input.nutrition) {
            facts = readFacts(input.nutrition, false) as NutritionFacts;
            requireSomeData(facts);
        }
        const allergens = input.allergens === undefined ? [] : cleanAllergens(input.allergens);
        if (await this.findOrNull(kind, name)) throw new ValidationError(`${kind} "${name}" already exists`);

        const dish: Dish = {
            name, details: String(input.details ?? '').trim(), price: input.price,
            ...facts, allergens, prepList: [],
        };
        const saved = kind === 'meal' ? await this.repo.addMeal(dish) : await this.repo.addSide(dish);
        return stripPrep(saved);
    }

    async addNutrition(actor: Actor, kind: ItemKind, name: string, facts: NutritionFacts, allergens?: string[]): Promise<MenuEntry> {
        this.assertCanEdit(actor);
        const full = readFacts(facts, false) as NutritionFacts;
        requireSomeData(full);
        const cleaned = allergens === undefined ? undefined : cleanAllergens(allergens);
        const dish = await this.find(kind, name);
        if (hasNutritionData(dish)) throw new ValidationError(`"${name}" already has nutritional information. Use update instead.`);
        return this.save(kind, dish.name, { ...full, ...(cleaned && { allergens: cleaned }) });
    }

    /** Only the values given are changed; allergens are left alone unless a list is given. */
    async updateNutrition(actor: Actor, kind: ItemKind, name: string, facts: Partial<NutritionFacts> = {}, allergens?: string[]): Promise<MenuEntry> {
        this.assertCanEdit(actor);
        const changes = readFacts(facts, true);
        const cleaned = allergens === undefined ? undefined : cleanAllergens(allergens);
        if (!Object.keys(changes).length && !cleaned) throw new ValidationError('nothing to update');
        const dish = await this.find(kind, name);
        if (!hasNutritionData(dish)) throw new ValidationError(`"${name}" has no nutritional information to update. Use add instead.`);
        requireSomeData({ ...dish, ...changes });
        return this.save(kind, dish.name, { ...changes, ...(cleaned && { allergens: cleaned }) });
    }

    /** Replaces the allergen list without touching nutrition values. An empty list clears it. */
    async setAllergens(actor: Actor, kind: ItemKind, name: string, allergens: string[]): Promise<MenuEntry> {
        this.assertCanEdit(actor);
        const cleaned = cleanAllergens(allergens);
        const dish = await this.find(kind, name);
        return this.save(kind, dish.name, { allergens: cleaned });
    }

    /** Clears nutrition values and allergens so the item falls back to "not available". */
    async removeNutrition(actor: Actor, kind: ItemKind, name: string): Promise<void> {
        this.assertCanEdit(actor);
        const dish = await this.find(kind, name);
        await this.save(kind, dish.name, { ...NO_NUTRITION, allergens: [] });
    }

    // ---- helpers ----

    // The Owner is read-only per the class diagram, so only the chef may edit.
    private assertCanEdit(actor: Actor) {
        if (actor?.role !== 'chef') throw new UnauthorizedError();
    }

    private get(kind: ItemKind, name: string): Promise<Dish> {
        return kind === 'meal' ? this.repo.getMeal(name) : this.repo.getSide(name);
    }
    private async findOrNull(kind: ItemKind, name: string): Promise<Dish | null> {
        try {
            return await this.get(kind, name);
        } catch (e) {
            if (isNotFound(e)) return null;
            throw e; // a real database error must not look like "not found"
        }
    }
    private async find(kind: ItemKind, name: string): Promise<Dish> {
        const dish = await this.findOrNull(kind, name);
        if (!dish) throw new NotFoundError(`"${name}" was not found`);
        return dish;
    }
    private async save(kind: ItemKind, name: string, changes: Partial<Omit<Dish, 'name' | 'prepList'>>): Promise<MenuEntry> {
        const saved = kind === 'meal' ? await this.repo.updateMeal(name, changes) : await this.repo.updateSide(name, changes);
        return stripPrep(saved);
    }
}
