import { Prep } from "./Prep";
import { PrepRow } from "./PrepRow";

export const prepToRow = (
    p: Partial<Prep>,
): Partial<Omit<PrepRow, "id" | "meal_name" | "side_name">> => ({
    ...(p.itemName !== undefined && { item_name: p.itemName }),
    ...(p.type !== undefined && { type: p.type }),
    ...(p.itemQuantity !== undefined && { item_quantity: p.itemQuantity }),
    ...(p.steps !== undefined && { steps: p.steps }),
});