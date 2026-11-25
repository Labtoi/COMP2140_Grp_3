import type { Prep } from '../../../shared/src/models/Prep';
import type { Meal } from '../models/Meal';
import type { MealSide } from '../models/MealSide';

/**
 * PrepList (class diagram): one item on the preparation list, for a meal or a side.
 * The properties are public and PrepInformation is the only function, as in the diagram.
 * OrderProcessing creates these from an order's recipe and forwards them to the prep database.
 */
export class PrepList {
    public itemId = '';
    public itemName = '';
    public type = '';
    /** Whole units: a fractional amount is rounded up, so the kitchen never prepares too little. */
    public itemQuantity = 0;
    public steps = '';
    public meal: Meal | null = null;
    public side: MealSide | null = null;

    constructor(owner: { meal?: Meal; side?: MealSide } = {}) {
        this.meal = owner.meal ?? null;
        this.side = owner.side ?? null;
    }

    /** Takes the details from a Prep and presents them as one line of the preparation list. */
    PrepInformation(prep: Prep): string {
        this.itemId = prep.id ?? '';
        this.itemName = prep.itemName;
        this.type = prep.type;
        this.itemQuantity = Math.ceil(prep.itemQuantity);
        this.steps = prep.steps;

        const forDish = this.meal?.mealName ?? this.side?.sideName;
        const head = `${this.itemQuantity} x ${this.itemName}${this.type ? ` (${this.type})` : ''}`;
        return `${head}${forDish ? ` for ${forDish}` : ''}${this.steps ? `: ${this.steps}` : ''}`;
    }
}
