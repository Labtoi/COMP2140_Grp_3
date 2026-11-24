// Outdated, switching to Dish Model

export type ItemKind = 'meal' | 'side';
export type Role = 'customer' | 'chef' | 'owner';

export interface Actor {
    id: string;
    role: Role;
}

/** Stored per 100 g and scaled to the portion being viewed. */
export interface NutritionFacts {
    caloriesPer100g: number;
    proteinPer100g: number;
    carbohydratesPer100g: number;
    fatsPer100g: number;
    sodiumMgPer100g: number;
    vitamins: string;
    defaultWeightG: number;
}

interface BaseItem {
    id: string;
    name: string;
    details: string;
    costCents: number;      // integer cents (SRS QA-1)
    allergens: string[];    // empty = nothing recorded, shown as "not available"
    nutrition?: NutritionFacts;
}

export type Meal = BaseItem & { kind: 'meal' };
export type Side = BaseItem & { kind: 'side' };
export type MenuItem = Meal | Side;

/** What a caller sends to create an item. The service generates the id. */
export interface NewMenuItem {
    kind: ItemKind;
    name: string;
    details?: string;
    costCents: number;
    allergens?: string[];
    nutrition?: NutritionFacts;
}

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
    vitamins?: string;
    allergens: string;
}

export const NUTRITION_UNAVAILABLE = 'Nutritional information not available';
export const ALLERGENS_UNAVAILABLE = 'Allergen information not available';
