import { IAnalysisRepo } from '../interfaces/IAnalysisRepo';
import { Analysis } from '../models/Analysis';

export class ValidationError extends Error {}
export type AnalysisDraft = Pick<Analysis, 'id' | 'date' | 'meals' | 'sides'>;
export type AnalysisInput = Analysis;

export class StockAnalysis {
  constructor(private readonly repo: IAnalysisRepo) {}

  getAll(): Promise<Analysis[]> {
    return this.repo.GetAllAnalysis();
  }

  getAllIds(): Promise<string[]> {
    return this.repo.GetAllIDs();
  }

  getById(id: string): Promise<Analysis | null> {
    return this.repo.GetAnalysis(id);
  }

  async add(input: AnalysisInput): Promise<Analysis> {
    if (await this.repo.GetAnalysis(input.id)) {
      throw new ValidationError(`id "${input.id}" already exists`);
    }
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

  /*private validate(a: AnalysisInput): void {
    if (!a.id) throw new ValidationError('id is required');
    if (!a.date) throw new ValidationError('date is required');
    const numbers = [a.revenue, a.totalSold, a.mealsSold, a.sidesSold];
    if (numbers.some((n) => typeof n !== 'number' || Number.isNaN(n) || n < 0)) {
      throw new ValidationError('revenue and sold counts must be non-negative numbers');
    }
    if (!Array.isArray(a.meals) || !Array.isArray(a.sides)) {
      throw new ValidationError('meals and sides must be lists');
    }
  }*/
}