import { IAnalysisRepo } from '../../owner/src/interfaces/IAnalysisRepo';
import { Analysis, NewAnalysis } from '../../owner/src/models/EverythingAnalysis';

/** In-memory stand-in for SqlAnalysisRepository (the "DatabaseA" table). Only what orders use is real. */
export class InMemoryAnalysisRepo implements IAnalysisRepo {
  readonly rows = new Map<string, Analysis>();
  failAdd = false;

  async AddAnalysis(a: NewAnalysis) {
    if (this.failAdd) throw new Error('analysis database unavailable');
    this.rows.set(a.id, structuredClone(a));
    return structuredClone(a);
  }
  async RemoveAnalysis(id: string) { this.rows.delete(id); }
  async GetAnalysis(id: string) { return this.rows.get(id) ?? null; }
  async GetAllAnalysis() { return [...this.rows.values()]; }
  async GetAllIDs() { return [...this.rows.keys()]; }
  async GetAllRevenue() { return [...this.rows.values()].reduce((t, r) => t + r.revenue, 0); }
  async TotalMealsSold() { return [...this.rows.values()].reduce((t, r) => t + r.mealsSold, 0); }
  async TotalSidesSold() { return [...this.rows.values()].reduce((t, r) => t + r.sidesSold, 0); }
  async LeastPopularMeals() { return []; }
  async MostPopularMeals() { return []; }
  async LeastPopularSides() { return []; }
  async MostPopularSides() { return []; }
}
