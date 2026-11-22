import { Meal_SideA } from './Meal_SideA';

export interface Analysis {
    id: string;
    date: string;
    revenue: number;
    totalSold: number;
    meals: Meal_SideA[];
    sides: Meal_SideA[];
    mealsSold: number;
    sidesSold: number;
}
export type NewAnalysis = Analysis;