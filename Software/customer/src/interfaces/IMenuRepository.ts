import type { Meal, Side } from "../models/Dish";

// Read-only menu access.
export interface IMenuRepository {
    showAllMeals(): Promise<Meal[]>;
    showAllSides(): Promise<Side[]>;
    getMeal(name: string): Promise<Meal>;
    getSide(name: string): Promise<Side>;
}