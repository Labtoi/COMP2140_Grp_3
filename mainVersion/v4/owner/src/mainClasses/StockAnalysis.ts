import { IAnalysisRepo } from '../interfaces/IAnalysisRepo';
import { Analysis } from '../models/EverythingAnalysis';
import { DateRange, ItemSales } from '../models/EverythingAnalysis';

// Thrown when a request breaks an analysis rule (routes return 400).
export class ValidationError extends Error {}
export type AnalysisDraft = Pick<Analysis, 'id' | 'date' | 'meals' | 'sides'>;
export type AnalysisInput = Analysis;


// Sales analysis for "DatabaseA"; each accepted order is saved as one record.
export class StockAnalysis {
  constructor(private readonly repo: IAnalysisRepo) {}

  // Rejects bad dates (YYYY-MM-DD, start <= end, not in the future) or a limit outside 1-50.
  private checkRange(range: DateRange, limit: number): void {
    const ok = /^\d{4}-\d{2}-\d{2}$/;
    if (!ok.test(range.start) || !ok.test(range.end)) throw new ValidationError('dates must look like YYYY-MM-DD');
    if (range.start > range.end) throw new ValidationError('start date must not be after end date');
    
    const updatedYear = new Date().getFullYear();
    const updatedMonth = new Date().getMonth() + 1;
    const updatedDay = new Date().getDate();

    const year1 = Number(range.start.split('-')[0]);
    const year2 = Number(range.end.split('-')[0]);
    if (year1 > updatedYear || year2 > updatedYear) throw new ValidationError('dates must not be in the future');

    const month1 = Number(range.start.split('-')[1]);
    const month2 = Number(range.end.split('-')[1]);
    // NOTE: day1 reads the END date, and the future-date checks compare year, month and day separately.
    const day1 = Number(range.end.split('-')[2]);
    const day2 = Number(range.end.split('-')[2]);
    if (month1<1 || month1>12 || month2<1 || month2>12) throw new ValidationError('Start and end date months must be between 1 and 12.');
    if (month1>updatedMonth || month2>updatedMonth) throw new ValidationError('Start and end date months should not be in the future.');
    if (day1>updatedDay || day2>updatedDay) throw new ValidationError('Start and end date days should not be in the future.');
    
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ValidationError('limit must be a whole number from 1 to 50');
  }
  
  // Top / bottom sellers in a date range, up to `limit`.
  mostPopularMeals(range: DateRange, limit = 5): Promise<ItemSales[]> {
    this.checkRange(range, limit);
    return this.repo.MostPopularMeals(range, limit);
  }
  leastPopularMeals(range: DateRange, limit = 5): Promise<ItemSales[]> {
    this.checkRange(range, limit);
    return this.repo.LeastPopularMeals(range, limit);
  }
  mostPopularSides(range: DateRange, limit = 5): Promise<ItemSales[]> {
    this.checkRange(range, limit);
    return this.repo.MostPopularSides(range, limit);
  }
  leastPopularSides(range: DateRange, limit = 5): Promise<ItemSales[]> {
    this.checkRange(range, limit);
    return this.repo.LeastPopularSides(range, limit);
  }

  // Totals for a date range.
  totalMealsSold(range: DateRange): Promise<number> {
    this.checkRange(range, 1);
    return this.repo.TotalMealsSold(range);
  }
  
  getTotalRevenue(range: DateRange): Promise<number> {
    this.checkRange(range, 1);
    return this.repo.GetAllRevenue(range);
  }

  totalSidesSold(range: DateRange): Promise<number> {
    this.checkRange(range, 1);
    return this.repo.TotalSidesSold(range);
  }

  // Lookups of saved records.
  getAll(): Promise<Analysis[]> {
    return this.repo.GetAllAnalysis();
  }

  getAllIds(): Promise<string[]> {
    return this.repo.GetAllIDs();
  }

  getById(id: string): Promise<Analysis | null> {
    return this.repo.GetAnalysis(id);
  }

  async idExists(id: string): Promise<boolean> {
    return (await this.repo.GetAnalysis(id)) !== null;
  }

  // Saves a complete record as given.
  async add(input: AnalysisInput): Promise<Analysis> {
    return this.repo.AddAnalysis(input);
  }

  // Saves a sale from its items; works out meals sold, sides sold, total and revenue.
  async addFromItems(draft: AnalysisDraft): Promise<Analysis> {
    const items = [...draft.meals, ...draft.sides];
    if (items.some((i) => !Number.isFinite(i.price) || !Number.isFinite(i.quantity) || i.price < 0 || i.quantity < 0)) {
      throw new ValidationError('every item needs a non-negative price and quantity (name:price:quantity)');
    }

    const sum = (list: { quantity: number }[]) => list.reduce((total, i) => total + i.quantity, 0);
    const mealsSold = sum(draft.meals);
    const sidesSold = sum(draft.sides);
    const revenue = items.reduce((total, i) => total + i.price * i.quantity, 0);

    return this.add({
      ...draft,
      mealsSold,
      sidesSold,
      totalSold: mealsSold + sidesSold,
      revenue: Math.round(revenue * 100) / 100,
    });
  }

  // Deletes a record (also used to undo a failed order).
  remove(id: string): Promise<void> {
    return this.repo.RemoveAnalysis(id);
  } 
}