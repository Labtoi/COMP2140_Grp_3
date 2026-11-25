// DB Preparation List Item

export interface PrepRow {
    id: string;
    item_name: string;
    type: string;
    item_quantity: number;
    steps: string;
    meal_name: string | null;
    side_name: string | null;
}