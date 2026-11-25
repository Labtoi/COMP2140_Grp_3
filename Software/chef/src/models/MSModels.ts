export type Allergen =
  | "gluten" | "dairy" | "eggs" | "peanuts" | "tree_nuts"
  | "soy" | "fish" | "shellfish" | "sesame";

export interface Prep {
  id?: string;
  itemName: string;
  type: string;
  itemQuantity: number;
  steps: string;
}

/** Shape shared by SqlDatabaseMeals and SqlDatabaseSides. */
export interface Dish {
  name: string;
  details: string;
  price: number;
  calories: number;
  carbohydrates: number;
  protein: number;
  sodium: number;
  fats: number;
  vitamins: number;
  allergens: Allergen[];
  prepList: Prep[];
}

export type Meal = Dish;
export type Side = Dish;

/* ---------- DB row types (snake_case, as stored in Supabase) ---------- */

export interface PrepRow {
  id: string;
  item_name: string;
  type: string;
  item_quantity: number;
  steps: string;
  meal_name: string | null;
  side_name: string | null;
}

export interface DishRow {
  name: string;
  details: string;
  price: number;
  calories: number;
  carbohydrates: number;
  protein: number;
  sodium: number;
  fats: number;
  vitamins: number;
  allergens: Allergen[];
  prep?: PrepRow[];
}

export type SqlDatabaseMealsRow = DishRow;
export type SqlDatabaseSidesRow = DishRow;

/* ---------- mappers ---------- */

export const prepFromRow = (r: PrepRow): Prep => ({
  id: r.id,
  itemName: r.item_name,
  type: r.type,
  itemQuantity: Number(r.item_quantity),
  steps: r.steps,
});

export const dishFromRow = (r: DishRow): Dish => ({
  name: r.name,
  details: r.details,
  price: Number(r.price),
  calories: Number(r.calories),
  carbohydrates: Number(r.carbohydrates),
  protein: Number(r.protein),
  sodium: Number(r.sodium),
  fats: Number(r.fats),
  vitamins: Number(r.vitamins),
  allergens: r.allergens ?? [],
  prepList: (r.prep ?? []).map(prepFromRow),
});

/** prepList is not a column, so it is stripped here. */
export const dishToRow = (d: Partial<Dish>): Partial<DishRow> => {
  const { prepList: _ignored, ...rest } = d;
  return rest;
};

export const prepToRow = (
  p: Partial<Prep>,
): Partial<Omit<PrepRow, "id" | "meal_name" | "side_name">> => ({
  ...(p.itemName !== undefined && { item_name: p.itemName }),
  ...(p.type !== undefined && { type: p.type }),
  ...(p.itemQuantity !== undefined && { item_quantity: p.itemQuantity }),
  ...(p.steps !== undefined && { steps: p.steps }),
});
