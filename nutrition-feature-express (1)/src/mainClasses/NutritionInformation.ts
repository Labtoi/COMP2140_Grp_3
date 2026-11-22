import { randomUUID } from 'crypto';
import { INutritionRepository } from '../interfaces/INutritionRepository';
import {
  ALLERGENS_UNAVAILABLE, NUTRITION_UNAVAILABLE,
  Actor, ItemKind, MenuItem, NewMenuItem, NutritionFacts, NutritionView,
} from '../models/MenuItem';

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class UnauthorizedError extends Error {
  constructor() {
    super('Only authorized staff can change nutritional information and allergens.');
  }
}

export function parseKind(value: string): ItemKind {
  if (value !== 'meal' && value !== 'side') throw new ValidationError('kind must be "meal" or "side"');
  return value;
}

const canEdit = (a: Actor) => a.role === 'chef' || a.role === 'owner';

const cleanAllergens = (list: unknown): string[] => {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new ValidationError('allergens must be a list');
  return [...new Set(list.map((a) => String(a).trim().toLowerCase()).filter(Boolean))];
};

function validateFacts(f: NutritionFacts | undefined): NutritionFacts {
  if (!f || typeof f !== 'object') throw new ValidationError('nutrition facts are required');
  const nums = [f.caloriesPer100g, f.proteinPer100g, f.carbohydratesPer100g, f.fatsPer100g, f.sodiumMgPer100g];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0)) {
    throw new ValidationError('nutrition values must be numbers that are 0 or more');
  }
  if (typeof f.defaultWeightG !== 'number' || !(f.defaultWeightG > 0)) {
    throw new ValidationError('serving weight must be above 0 g');
  }
  return { ...f, vitamins: String(f.vitamins ?? '').trim() };
}

export class NutritionInformation {
  // The interface is injected through the constructor, same pattern as the analysis service.
  constructor(private readonly repo: INutritionRepository) {}

  // ---- Customer side (SR-3.1, SR-3.2) ----

  getAll(kind: ItemKind): Promise<MenuItem[]> {
    return kind === 'meal' ? this.repo.ShowAllMeals() : this.repo.ShowAllSides();
  }

  async getInformation(kind: ItemKind, name: string, weightG?: number): Promise<NutritionView> {
    return this.mealInformation(await this.find(kind, name), weightG);
  }

  /** MealInformation(meal) in the class diagram. Scales per-100 g values to the portion. */
  mealInformation(item: MenuItem, weightG?: number): NutritionView {
    const allergens = item.allergens.length ? item.allergens.join(', ') : ALLERGENS_UNAVAILABLE;
    const n = item.nutrition;
    if (!n) return { name: item.name, available: false, message: NUTRITION_UNAVAILABLE, allergens };

    const w = weightG ?? n.defaultWeightG;
    if (!Number.isFinite(w) || w <= 0) throw new ValidationError('weight must be greater than 0 g');
    const scale = (per100: number) => Math.round((per100 * w) / 10) / 10; // 1 decimal place
    return {
      name: item.name, available: true, weightG: w,
      calories: Math.round((n.caloriesPer100g * w) / 100),
      proteinG: scale(n.proteinPer100g),
      carbohydratesG: scale(n.carbohydratesPer100g),
      fatsG: scale(n.fatsPer100g),
      sodiumMg: Math.round((n.sodiumMgPer100g * w) / 100),
      vitamins: n.vitamins,
      allergens,
    };
  }

  // ---- Staff side (SR-3.3) ----

  async createItem(actor: Actor, input: NewMenuItem): Promise<MenuItem> {
    this.assertCanEdit(actor);
    const kind = parseKind(input?.kind);
    const name = String(input.name ?? '').trim();
    if (!name) throw new ValidationError('name is required');
    if (!Number.isInteger(input.costCents) || input.costCents < 0) {
      throw new ValidationError('costCents must be a whole number that is 0 or more');
    }
    if (await this.findOrNull(kind, name)) throw new ValidationError(`${kind} "${name}" already exists`);

    const item = {
      id: randomUUID(), kind, name, details: String(input.details ?? '').trim(),
      costCents: input.costCents, allergens: cleanAllergens(input.allergens),
      nutrition: input.nutrition ? validateFacts(input.nutrition) : undefined,
    } as MenuItem;
    if (item.kind === 'meal') await this.repo.AddMeal(item);
    else await this.repo.AddSide(item);
    return item;
  }

  async addNutrition(actor: Actor, kind: ItemKind, name: string, facts: NutritionFacts, allergens?: string[]) {
    this.assertCanEdit(actor);
    const item = await this.find(kind, name);
    if (item.nutrition) throw new ValidationError(`"${name}" already has nutritional information. Use update instead.`);
    return this.write(item, facts, allergens);
  }

  async updateNutrition(actor: Actor, kind: ItemKind, name: string, facts: NutritionFacts, allergens?: string[]) {
    this.assertCanEdit(actor);
    const item = await this.find(kind, name);
    if (!item.nutrition) throw new ValidationError(`"${name}" has no nutritional information to update. Use add instead.`);
    return this.write(item, facts, allergens);
  }

  /** Clears nutrition facts and allergens so the item falls back to "not available". */
  async removeNutrition(actor: Actor, kind: ItemKind, name: string): Promise<void> {
    this.assertCanEdit(actor);
    const item = await this.find(kind, name);
    await this.save({ ...item, nutrition: undefined, allergens: [] } as MenuItem);
  }

  // ---- helpers ----

  private assertCanEdit(actor: Actor) {
    if (!canEdit(actor)) throw new UnauthorizedError();
  }
  private async findOrNull(kind: ItemKind, name: string): Promise<MenuItem | null> {
    return kind === 'meal' ? this.repo.GetMeal(name) : this.repo.GetSide(name);
  }
  private async find(kind: ItemKind, name: string): Promise<MenuItem> {
    const item = await this.findOrNull(kind, name);
    if (!item) throw new NotFoundError(`"${name}" was not found`);
    return item;
  }
  private async write(item: MenuItem, facts: NutritionFacts, allergens?: string[]): Promise<MenuItem> {
    const next = { ...item, nutrition: validateFacts(facts), allergens: cleanAllergens(allergens) } as MenuItem;
    await this.save(next);
    return next;
  }
  private async save(item: MenuItem): Promise<void> {
    if (item.kind === 'meal') await this.repo.UpdateMeal(item);
    else await this.repo.UpdateSide(item);
  }
}
