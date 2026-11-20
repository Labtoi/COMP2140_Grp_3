
import { Meal } from "./models/Meal.js";
import { MealSide } from "./models/MealSide.js";

const meal = new Meal("M001", "Chicken and Rice", 850);
const side = new MealSide("S001", "Plantain", 150);

console.log("Meal:", meal.mealName);
console.log("Side:", side.sideName);
console.log("Total:", meal.costM + side.cost);
