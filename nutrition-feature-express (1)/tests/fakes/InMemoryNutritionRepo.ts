import { INutritionRepository } from '../../src/interfaces/INutritionRepository';
import { ItemKind, Meal, MenuItem, Side } from '../../src/models/MenuItem';

/** Test double so the service can be tested without a database. */
export class InMemoryNutritionRepo implements INutritionRepository {
  private rows = new Map<string, MenuItem>();
  private k = (kind: ItemKind, name: string) => `${kind}:${name.trim().toLowerCase()}`;
  private put(i: MenuItem) { this.rows.set(this.k(i.kind, i.name), structuredClone(i)); }
  private all(kind: ItemKind) { return [...this.rows.values()].filter((i) => i.kind === kind).map((i) => structuredClone(i)); }
  private one(kind: ItemKind, name: string) { const r = this.rows.get(this.k(kind, name)); return r ? structuredClone(r) : null; }

  async ShowAllMeals() { return this.all('meal') as Meal[]; }
  async ShowAllSides() { return this.all('side') as Side[]; }
  async GetMeal(n: string) { return this.one('meal', n) as Meal | null; }
  async GetSide(n: string) { return this.one('side', n) as Side | null; }
  async AddMeal(m: Meal) { this.put(m); }
  async AddSide(s: Side) { this.put(s); }
  async UpdateMeal(m: Meal) { this.put(m); }
  async UpdateSide(s: Side) { this.put(s); }
  async DeleteMeal(n: string) { this.rows.delete(this.k('meal', n)); }
  async DeleteSide(n: string) { this.rows.delete(this.k('side', n)); }
}
