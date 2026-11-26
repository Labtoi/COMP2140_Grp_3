import { Allergen } from "."
import { Prep } from "."

export interface Dish {
    name: string;
    details: string;
    price: number;
    calories: number;
    carbohydrates: number;
    protein: number;
    sodium: number;
    fats: number;
    vitamins: number;
    allergens: Allergen[];
    prepList: Prep[];
}

export type Meal = Dish;
export type Side = Dish;