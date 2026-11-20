
import { Order } from "./models/Order.js";
import { Meal } from "./models/Meal.js";
import { MealSide } from "./models/MealSide.js";

const order = new Order(1, "Ramone");

const meal = new Meal("M001", "Chicken and Rice", 850);
const side = new MealSide("S001", "Plantain", 150);

order.AddMeal(meal);
order.AddSide(side);

console.log("Items:", order.GetMealSize());
console.log("Total:", order.TotalCost());
console.log("Meals:", order.GetMeal().length);
console.log("Sides:", order.GetSide().length);
console.log(order.Receipt());
