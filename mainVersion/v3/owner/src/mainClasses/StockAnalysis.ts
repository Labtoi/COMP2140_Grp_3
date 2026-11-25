import { IAnalysisRepo } from '../interfaces/IAnalysisRepo';
import { Analysis } from '../models/EverythingAnalysis';
import { DateRange, ItemSales } from '../models/EverythingAnalysis';

export class ValidationError extends Error {}
export type AnalysisDraft = Pick<Analysis, 'id' | 'date' | 'meals' | 'sides'>;
export type AnalysisInput = Analysis;


export class StockAnalysis {
  constructor(private readonly repo: IAnalysisRepo) {}

  private checkRange(range: DateRange, limit: number): void {
    const ok = /^\d{4}-\d{2}-\d{2}$/;
    if (!ok.test(range.start) || !ok.test(range.end)) throw new ValidationError('dates must look like YYYY-MM-DD');
    if (range.start > range.end) throw new ValidationError('start date must not be after end date');
    
    const updatedYear = new Date().getFullYear();
    const updatedMonth = new Date().getMonth() + 1; // getMonth() returns 0-11, so add 1 for 1-12
    const updatedDay = new Date().getDate();

    const year1 = Number(range.start.split('-')[0]);
    const year2 = Number(range.end.split('-')[0]);
    if (year1 > updatedYear || year2 > updatedYear) throw new ValidationError('dates must not be in the future');

    const month1 = Number(range.start.split('-')[1]);
    const month2 = Number(range.end.split('-')[1]);
    const day1 = Number(range.end.split('-')[2]);
    const day2 = Number(range.end.split('-')[2]);
    if (month1<1 || month1>12 || month2<1 || month2>12) throw new ValidationError('Start and end date months must be between 1 and 12.');
    if (month1>updatedMonth || month2>updatedMonth) throw new ValidationError('Start and end date months should not be in the future.');
    if (day1>updatedDay || day2>updatedDay) throw new ValidationError('Start and end date days should not be in the future.');
    
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ValidationError('limit must be a whole number from 1 to 50');
  }
  
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

  async add(input: AnalysisInput): Promise<Analysis> {
    return this.repo.AddAnalysis(input);
  }

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
      revenue: Math.round(revenue * 100) / 100,   // avoids floating-point noise like 38.970000000000006
    });
  }

  remove(id: string): Promise<void> {
    return this.repo.RemoveAnalysis(id);
  } 
}