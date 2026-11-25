export interface DateRange { start: string; end: string }   // "YYYY-MM-DD"
export interface ItemSales { name: string; quantitySold: number }

export interface Meal_SideA {
    name: string;
    price: number;
    quantity: number;
}

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