import { Analysis, NewAnalysis } from '../models/EverythingAnalysis';
import { DateRange, ItemSales } from '../models/EverythingAnalysis';

export interface IAnalysisRepo {
    GetAnalysis(id: string): Promise< Analysis| null>;
    GetAllAnalysis(): Promise<Analysis[]>;
    GetAllIDs(): Promise<string[]>

    GetAllRevenue(dateRange: DateRange, limit?: number): Promise<number>;
    LeastPopularMeals(dateRange: DateRange, limit?: number): Promise<ItemSales[]>;
    MostPopularMeals(dateRange: DateRange, limit?: number): Promise<ItemSales[]>;
    TotalMealsSold(dateRange: DateRange, limit?: number): Promise<number>;
    LeastPopularSides(dateRange: DateRange, limit?: number): Promise<ItemSales[]>;
    MostPopularSides(dateRange: DateRange, limit?: number): Promise<ItemSales[]>;
    TotalSidesSold(dateRange: DateRange, limit?: number): Promise<number>;

    RemoveAnalysis(id: string): Promise<void>;
    AddAnalysis(analysis: NewAnalysis): Promise<Analysis>;
}