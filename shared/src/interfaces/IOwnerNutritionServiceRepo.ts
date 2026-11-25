import { IMenuRepository } from "./IMenuRepository";

// Narrow, read-only view used by the Owner.
export type IOwnerNutritionServiceRepo = Pick<
    IMenuRepository,
    "showAllMeals" | "showAllSides"
>;