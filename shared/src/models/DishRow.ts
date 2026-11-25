// DB Dish Row types

import { Allergen } from './Allergen'
import { PrepRow } from './PrepRow'

export interface DishRow {
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
    prep?: PrepRow[];
}

export type SqlDatabaseMealsRow = DishRow;
export type SqlDatabaseSidesRow = DishRow;