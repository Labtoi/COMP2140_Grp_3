
import { Order } from "./models/Order.js";
import { Meal } from "./models/Meal.js";
import { MealSide } from "./models/MealSide.js";

// Test 1: Empty order
const emptyOrder = new Order(2, "Customer A");

console.log("Empty order items:", emptyOrder.GetMealSize());
console.log("Empty order total:", emptyOrder.TotalCost());

// Test 2: Multiple meals and sides
const order = new Order(3, "Customer B");

order.AddMeal(new Meal("M001", "Chicken", 850));
order.AddMeal(new Meal("M002", "Fish", 1000));

order.AddSide(new MealSide("S001", "Plantain", 150));
order.AddSide(new MealSide("S002", "Salad", 200));

console.log("Multiple order items:", order.GetMealSize());
console.log("Multiple order total:", order.TotalCost());

// Test 3: Returned arrays should not modify the order
const meals = order.GetMeal();
meals.pop();

console.log("Meals still in order:", order.GetMeal().length);


console.log("Empty order valid:", emptyOrder.ValidateOrder());
console.log("Multiple order valid:", order.ValidateOrder());
