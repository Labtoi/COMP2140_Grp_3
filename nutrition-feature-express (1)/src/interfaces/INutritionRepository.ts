import { Meal, Side } from '../models/MenuItem';

export interface IMenuRepository {
    ShowAllMeals(): Promise<Meal[]>;
    ShowAllSides(): Promise<Side[]>;
    GetMeal(mealName: string): Promise<Meal | null>;
    GetSide(sideName: string): Promise<Side | null>;
}

export interface INutritionRepository extends IMenuRepository {
    AddMeal(meal: Meal): Promise<void>;
    AddSide(side: Side): Promise<void>;
    UpdateMeal(meal: Meal): Promise<void>;
    UpdateSide(side: Side): Promise<void>;
    DeleteMeal(mealName: string): Promise<void>;
    DeleteSide(sideName: string): Promise<void>;
}
