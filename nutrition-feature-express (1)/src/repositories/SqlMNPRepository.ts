import { Pool } from 'pg';
import { INutritionRepository } from '../interfaces/INutritionRepository';
import { ItemKind, Meal, MenuItem, NutritionFacts, Side } from '../models/MenuItem';

const COLUMNS =
  'id, kind, name, details, cost_cents, allergens, calories_per_100g, protein_per_100g, ' +
  'carbohydrates_per_100g, fats_per_100g, sodium_mg_per_100g, vitamins, default_weight_g';

type Row = {
  id: string;
  kind: ItemKind;
  name: string;
  details: string;
  cost_cents: number;
  allergens: string[];
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  carbohydrates_per_100g: number | null;
  fats_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  vitamins: string | null;
  default_weight_g: number | null;
};

function toItem(r: Row): MenuItem {
  const nutrition: NutritionFacts | undefined =
    r.calories_per_100g === null
      ? undefined
      : {
          caloriesPer100g: r.calories_per_100g,
          proteinPer100g: r.protein_per_100g ?? 0,
          carbohydratesPer100g: r.carbohydrates_per_100g ?? 0,
          fatsPer100g: r.fats_per_100g ?? 0,
          sodiumMgPer100g: r.sodium_mg_per_100g ?? 0,
          vitamins: r.vitamins ?? '',
          defaultWeightG: r.default_weight_g ?? 100,
        };
  return {
    id: r.id, kind: r.kind, name: r.name, details: r.details,
    costCents: r.cost_cents, allergens: r.allergens, nutrition,
  } as MenuItem;
}

// calories, protein, carbs, fats, sodium, vitamins, default weight (all NULL when no nutrition is stored)
const nutritionParams = (n?: NutritionFacts) => [
  n?.caloriesPer100g ?? null, n?.proteinPer100g ?? null, n?.carbohydratesPer100g ?? null,
  n?.fatsPer100g ?? null, n?.sodiumMgPer100g ?? null, n?.vitamins ?? null, n?.defaultWeightG ?? null,
];

export class SqlMNPRepository implements INutritionRepository {
  // The pool is injected, same as databaseAnalysisRepository.
  constructor(private readonly pool: Pool) {}

  private async list(kind: ItemKind): Promise<MenuItem[]> {
    const { rows } = await this.pool.query<Row>(
      `SELECT ${COLUMNS} FROM menu_items WHERE kind = $1 ORDER BY name`, [kind]);
    return rows.map(toItem);
  }

  private async get(kind: ItemKind, name: string): Promise<MenuItem | null> {
    const { rows } = await this.pool.query<Row>(
      `SELECT ${COLUMNS} FROM menu_items WHERE kind = $1 AND lower(name) = lower($2)`, [kind, name]);
    return rows[0] ? toItem(rows[0]) : null;
  }

  private async insert(item: MenuItem): Promise<void> {
    await this.pool.query(
      `INSERT INTO menu_items (${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [item.id, item.kind, item.name, item.details, item.costCents, item.allergens, ...nutritionParams(item.nutrition)]);
  }

  private async update(item: MenuItem): Promise<void> {
    await this.pool.query(
      `UPDATE menu_items SET details = $3, cost_cents = $4, allergens = $5,
         calories_per_100g = $6, protein_per_100g = $7, carbohydrates_per_100g = $8,
         fats_per_100g = $9, sodium_mg_per_100g = $10, vitamins = $11, default_weight_g = $12
       WHERE kind = $1 AND lower(name) = lower($2)`,
      [item.kind, item.name, item.details, item.costCents, item.allergens, ...nutritionParams(item.nutrition)]);
  }

  private async remove(kind: ItemKind, name: string): Promise<void> {
    await this.pool.query('DELETE FROM menu_items WHERE kind = $1 AND lower(name) = lower($2)', [kind, name]);
  }

  async ShowAllMeals() { return (await this.list('meal')) as Meal[]; }
  async ShowAllSides() { return (await this.list('side')) as Side[]; }
  async GetMeal(mealName: string) { return (await this.get('meal', mealName)) as Meal | null; }
  async GetSide(sideName: string) { return (await this.get('side', sideName)) as Side | null; }
  AddMeal(meal: Meal) { return this.insert(meal); }
  AddSide(side: Side) { return this.insert(side); }
  UpdateMeal(meal: Meal) { return this.update(meal); }
  UpdateSide(side: Side) { return this.update(side); }
  DeleteMeal(mealName: string) { return this.remove('meal', mealName); }
  DeleteSide(sideName: string) { return this.remove('side', sideName); }
}
