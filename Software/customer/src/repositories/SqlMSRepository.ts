import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IMenuRepository,
  INutritionRepository,
  IPreplistRepository,
  IOwnerNutritionServiceRepo,
  PrepOwner,
} from "../interfaces/index";
import {
  type Meal, type Side, type Prep, type Dish,
  type DishRow, type PrepRow,
  dishFromRow, dishToRow, prepFromRow, prepToRow,
} from "../models/index";

/** The two Supabase tables that back SqlDatabaseMeals / SqlDatabaseSides. */
const MEALS = "SqlRepositoryMeals";
const SIDES = "SqlRepositorySides";
const PREP = "Prep";
type DishTable = typeof MEALS | typeof SIDES;

const DISH_SELECT = "*, prep(*)"; // pulls prepList in one query

export class SqlMSRepository
  implements IMenuRepository, INutritionRepository, IPreplistRepository, IOwnerNutritionServiceRepo
{
  constructor(private readonly db: SupabaseClient) {}

  /* ------------------------------ meals ------------------------------ */
  showAllMeals = () => this.listDishes(MEALS);
  getMeal = (name: string) => this.getDish(MEALS, name);
  addMeal = (meal: Meal) => this.addDish(MEALS, "meal_name", meal);
  updateMeal = (name: string, changes: Partial<Omit<Meal, "name" | "prepList">>) =>
    this.updateDish(MEALS, name, changes);
  deleteMeal = (mealName: string) => this.deleteDish(MEALS, mealName);

  /* ------------------------------ sides ------------------------------ */
  showAllSides = () => this.listDishes(SIDES);
  getSide = (name: string) => this.getDish(SIDES, name);
  addSide = (side: Side) => this.addDish(SIDES, "side_name", side);
  updateSide = (name: string, changes: Partial<Omit<Side, "name" | "prepList">>) =>
    this.updateDish(SIDES, name, changes);
  deleteSide = (sideName: string) => this.deleteDish(SIDES, sideName);

  /* ------------------------------ prep ------------------------------- */
  async showAllPrep(): Promise<Prep[]> {
    const { data, error } = await this.db.from(PREP).select("*").returns<PrepRow[]>();
    if (error) throw error;
    return (data ?? []).map(prepFromRow);
  }

async getPrep(name: string): Promise<Prep> {
  const { data, error } = await this.db
    .from(PREP).select("*").eq("item_name", name).limit(1).returns<PrepRow[]>();
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error(`Prep "${name}" not found`);
  return prepFromRow(row);
}

  async addPrep(owner: PrepOwner, prep: Prep): Promise<Prep> {
    const link = "meal" in owner ? { meal_name: owner.meal } : { side_name: owner.side };
    const { data, error } = await this.db
      .from(PREP)
      .insert({ ...prepToRow(prep), ...link })
      .select().single<PrepRow>();
    if (error) throw error;
    return prepFromRow(data);
  }

  async updatePrep(name: string, changes: Partial<Omit<Prep, "id">>): Promise<Prep> {
    const { data, error } = await this.db
      .from(PREP).update(prepToRow(changes)).eq("item_name", name)
      .select().single<PrepRow>();
    if (error) throw error;
    return prepFromRow(data);
  }

  async removePrep(name: string): Promise<void> {
    const { error } = await this.db.from(PREP).delete().eq("item_name", name);
    if (error) throw error;
  }

  /* --------------------- shared dish helpers ------------------------- */
  private async listDishes(table: DishTable): Promise<Dish[]> {
    const { data, error } = await this.db
      .from(table).select(DISH_SELECT).order("name").returns<DishRow[]>();
    if (error) throw error;
    return (data ?? []).map(dishFromRow);
  }

  private async getDish(table: DishTable, name: string): Promise<Dish> {
    const { data, error } = await this.db
      .from(table).select(DISH_SELECT).eq("name", name).maybeSingle<DishRow>();
    if (error) throw error;
    if (!data) throw new Error(`"${name}" not found in ${table}`);
    return dishFromRow(data);
  }

  private async addDish(
    table: DishTable,
    fk: "meal_name" | "side_name",
    dish: Dish,
  ): Promise<Dish> {
    const { error } = await this.db.from(table).insert(dishToRow(dish));
    if (error) throw error;

    if (dish.prepList.length) {
      const { error: prepErr } = await this.db.from(PREP).insert(
        dish.prepList.map((p) => ({ ...prepToRow(p), [fk]: dish.name })),
      );
      if (prepErr) {
        // best-effort rollback so we don't leave a dish without its prep steps
        await this.db.from(table).delete().eq("name", dish.name);
        throw prepErr;
      }
    }
    return this.getDish(table, dish.name);
  }

  private async updateDish(
    table: DishTable,
    name: string,
    changes: Partial<Omit<Dish, "name" | "prepList">>,
  ): Promise<Dish> {
    const { error } = await this.db.from(table).update(dishToRow(changes)).eq("name", name);
    if (error) throw error;
    return this.getDish(table, name);
  }

  private async deleteDish(table: DishTable, name: string): Promise<void> {
    // prep rows are removed by ON DELETE CASCADE
    const { error } = await this.db.from(table).delete().eq("name", name);
    if (error) throw error;
  }
}