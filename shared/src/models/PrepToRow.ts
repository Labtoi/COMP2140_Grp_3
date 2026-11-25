import { Dish } from "./Dish";
import { DishRow } from "./DishRow";
import { prepFromRow } from "./PrepFromRow";

export const dishFromRow = (r: DishRow): Dish => ({
    name: r.name,
    details: r.details,
    price: Number(r.price),
    calories: Number(r.calories),
    carbohydrates: Number(r.carbohydrates),
    protein: Number(r.protein),
    sodium: Number(r.sodium),
    fats: Number(r.fats),
    vitamins: Number(r.vitamins),
    allergens: r.allergens ?? [],
    prepList: (r.prep ?? []).map(prepFromRow),
});