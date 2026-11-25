import { Prep } from "./Prep";
import { PrepRow } from "./PrepRow";

export const prepFromRow = (r: PrepRow): Prep => ({
    id: r.id,
    itemName: r.item_name,
    type: r.type,
    itemQuantity: Number(r.item_quantity),
    steps: r.steps,
});