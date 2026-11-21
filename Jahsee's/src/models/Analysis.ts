import { Meal_A } from './Meal_A';
import { Side_A } from './Side_A';

export interface Analysis {
    id: string;
    date: string;
    revenue: number;
    totalSold: number;
    meals: Meal_A[];
    sides: Side_A[];
    mealsSold: number;
    sidesSold: number;
}
export type NewAnalysis = Analysis;