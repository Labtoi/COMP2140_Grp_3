
import { Meal } from "./Meal.js";
import { MealSide } from "./MealSide.js";
import type { OrderStatistics } from "./OrderStatistics.js";

export class Order implements OrderStatistics {
  private mealOrder: Meal[] = [];
  private sideOrder: MealSide[] = [];

  constructor(
    private orderNumber: number,
    private customerName: string
  ) {}

  public AddMeal(meal: Meal): void {
    this.mealOrder.push(meal);
  }

  public AddSide(side: MealSide): void {
    this.sideOrder.push(side);
  }

  public totalMealSize(): number {
    return this.mealOrder.length + this.sideOrder.length;
  }

  public TotalCost(): number {
    const mealTotal = this.mealOrder.reduce(
      (total, meal) => total + meal.costM,
      0
    );

    const sideTotal = this.sideOrder.reduce(
      (total, side) => total + side.cost,
      0
    );

    return mealTotal + sideTotal;
  }

  public GetOrder(): Order {
    return this;
  }

  public GetMeal(): Meal[] {
    return [...this.mealOrder];
  }

  public GetSide(): MealSide[] {
    return [...this.sideOrder];
  }

  public GetMealSize(): number {
    return this.totalMealSize();
  }

public ValidateOrder(): boolean {
    // Implement validation logic here
    return this.totalMealSize() > 0;
  }

  public Receipt(): string {
    return `Order #${this.orderNumber}
Customer: ${this.customerName}
Items: ${this.totalMealSize()}
Total: ${this.TotalCost()}`;
  }
}
