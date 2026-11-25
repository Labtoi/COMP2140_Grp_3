import type { IMenuRepository } from '../../../shared/src/interfaces/IMenuRepository';
import type { Allergen } from '../../../shared/src/models/Allergen';
import type { Dish } from '../../../shared/src/models/Dish';
import { Meal } from '../models/Meal';
import { MealSide } from '../models/MealSide';
import { ALLERGENS_UNAVAILABLE, NUTRITION_UNAVAILABLE, type NutritionView } from '../../../shared/src/mainClasses/NutritionInformation';

export type MenuKind = 'meal' | 'side';

/** Meals and sides can share a name, so anything keyed by item uses "meal:Name" / "side:Name". */
export const itemKey = (kind: MenuKind, name: string) => `${kind}:${name}`;

// ---- allergy matching (SRS SR-2.3, SR-2.4, QA-2) ----

const normalise = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Words customers type in their profile that are not an Allergen name. */
const SYNONYMS: Record<string, Allergen> = {
    milk: 'dairy', lactose: 'dairy', cheese: 'dairy', butter: 'dairy',
    wheat: 'gluten', flour: 'gluten',
    shrimp: 'shellfish', prawn: 'shellfish', crab: 'shellfish', lobster: 'shellfish',
    almond: 'tree_nuts', cashew: 'tree_nuts', walnut: 'tree_nuts', pecan: 'tree_nuts', hazelnut: 'tree_nuts', pistachio: 'tree_nuts',
};

/**
 * The dish allergens that match something in the customer's profile. The profile is free text, so matching is
 * deliberately generous ("nuts" matches tree_nuts and peanuts): warning too much is safe, warning too little is not.
 */
export function matchAllergies(dishAllergens: readonly string[], profile: readonly string[]): string[] {
    const terms = profile.map(normalise).filter(Boolean).map((t) => SYNONYMS[t] ?? SYNONYMS[t.replace(/e?s$/, '')] ?? t); // "almonds" -> almond
    return dishAllergens.filter((a) =>
        terms.some((t) => a === t || (t.length >= 3 && (a.includes(t) || t.includes(a)))));
}

// ---- what the page receives ----

export interface MenuItemView {
    kind: MenuKind;
    id: string;
    name: string;
    details: string;
    price: number;
    /** False when the kitchen cannot make it right now (not enough stock). */
    available: boolean;
    allergens: Allergen[];
    /** Profile allergens found in this item. Empty means clear (SR-2.4). */
    allergyWarning: string[];
    nutrition: NutritionView;
}

export interface MenuLayoutView {
    meals: MenuItemView[];
    sides: MenuItemView[];
}

export interface MenuLayoutOptions {
    /** itemKey() values for items that cannot be made right now. */
    unavailable?: ReadonlySet<string>;
    customerAllergies?: readonly string[];
}

export type DescribeDish = (dish: Dish) => NutritionView;

/**
 * Menu (class diagram): the meals and sides that can be ordered, in the Meal and MealSide models,
 * and MenuLayout, which arranges them for display with their nutrition and allergen information.
 */
export class Menu {
    constructor(
        public mealOrder: Meal[] = [],
        public sideOrder: MealSide[] = [],
        private readonly dishes: ReadonlyMap<string, Dish> = new Map(),
        private readonly describe?: DescribeDish,
    ) {}

    /** Builds a Menu from the dishes IMenuRepository returns (the database has no ids, so the name is the id). */
    static fromDishes(meals: readonly Dish[], sides: readonly Dish[], describe?: DescribeDish): Menu {
        const dishes = new Map<string, Dish>();
        meals.forEach((d) => dishes.set(itemKey('meal', d.name), d));
        sides.forEach((d) => dishes.set(itemKey('side', d.name), d));
        return new Menu(
            meals.map((d) => new Meal(d.name, d.name, d.price)),
            sides.map((d) => new MealSide(d.name, d.name, d.price)),
            dishes,
            describe,
        );
    }

    /** Reads the menu through IMenuRepository (SqlDatabaseMeals and SqlDatabaseSides). */
    static async load(repo: IMenuRepository, describe?: DescribeDish): Promise<Menu> {
        const [meals, sides] = await Promise.all([repo.showAllMeals(), repo.showAllSides()]);
        return Menu.fromDishes(meals, sides, describe);
    }

    /** Arranges both lists for display: sorted by name, each item with its nutrition, allergens and warnings. */
    MenuLayout(options: MenuLayoutOptions = {}): MenuLayoutView {
        const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
        return {
            meals: this.mealOrder.map((m) => this.view('meal', m.mealID, m.mealName, m.costM, options)).sort(byName),
            sides: this.sideOrder.map((s) => this.view('side', s.sideID, s.sideName, s.cost, options)).sort(byName),
        };
    }

    private view(kind: MenuKind, id: string, name: string, price: number, o: MenuLayoutOptions): MenuItemView {
        const dish = this.dishes.get(itemKey(kind, name));
        const allergens = dish?.allergens ?? [];
        return {
            kind, id, name, price,
            details: dish?.details ?? '',
            available: !o.unavailable?.has(itemKey(kind, name)),
            allergens,
            allergyWarning: matchAllergies(allergens, o.customerAllergies ?? []),
            nutrition: dish && this.describe
                ? this.describe(dish)
                : { name, available: false, message: NUTRITION_UNAVAILABLE, allergens: ALLERGENS_UNAVAILABLE },
        };
    }
}
