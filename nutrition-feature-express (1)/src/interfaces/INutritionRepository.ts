import { Meal, Side } from '../models/Dish';
import { IMenuRepository } from './IMenuRepository';

// Nutrition / menu management: everything in IMenuRepository plus writes.
export interface INutritionRepository extends IMenuRepository {
    addMeal(meal: Meal): Promise<Meal>;
    addSide(side: Side): Promise<Side>;
    updateMeal(name: string, changes: Partial<Omit<Meal, "name" | "prepList">>): Promise<Meal>;
    updateSide(name: string, changes: Partial<Omit<Side, "name" | "prepList">>): Promise<Side>;
    deleteMeal(mealName: string): Promise<void>;
    deleteSide(sideName: string): Promise<void>;
}