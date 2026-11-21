import { IAnalysisRepo } from '../interfaces/IAnalysisRepo';
import { Analysis } from '../models/Analysis';

export class ValidationError extends Error {}

export type AnalysisInput = Analysis;

export class AnalysisService {
  // The interface is injected through the constructor. No "new databaseAnalysisRepository" here.
  constructor(private readonly repo: IAnalysisRepo) {}

  ids = GetAllIDs();

  getAll(): Promise<Analysis[]> {
    return this.repo.GetAllAnalysis();
  }

  getById(id: string): Promise<Analysis | null> {
    return this.repo.GetAnalysis(id);
  }

  async add(input: AnalysisInput): Promise<Analysis> {
    this.validate(input);
    // the service generates the id, so callers can't choose or overwrite it
    return this.repo.AddAnalysis();
  }

  addToDatabase(){
    while (input = id){
      AnalysisInput.id = input("Enter the ID, enter a new id if it already exists")
    }
    while (!validate){
      AnalysisInput.revenue = input("Enter a positive revenue: ")
      AnalysisInput.total_sold = input("Enter the total sold: ")
      AnalysisInput.meals = input("Enter meals:").split(",")
      AnalysisInput.sides = input("Enter sides:").split(",")
      AnalysisInput.mealsSold = input("Enter the amount of meals sold: ")
      AnalysisInput.sidesSold = input("Enter the amount of sides sold: ")
    }
    add(AnalysisInput)
  }

  remove(id: string): Promise<void> {
    return this.repo.RemoveAnalysis(id);
  }

  private validate(a: AnalysisInput): void {
    if (!a.date) throw new ValidationError('date is required');
    const numbers = [a.revenue, a.totalSold, a.mealsSold, a.sidesSold];
    if (numbers.some((n) => typeof n !== 'number' || Number.isNaN(n) || n < 0)) {
      throw new ValidationError('revenue and sold counts must be non-negative numbers');
    }
    if (!Array.isArray(a.meals) || !Array.isArray(a.sides)) {
      throw new ValidationError('meals and sides must be lists');
    }
  }
}