import { Dish } from "./Dish";
import { DishRow } from "./DishRow";

export const dishToRow = (d: Partial<Dish>): Partial<DishRow> => {
    const { prepList: _ignored, ...rest } = d;
    return rest;
};