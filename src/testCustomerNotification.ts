
import { User } from "./models/User.js";
import { Customer } from "./models/Customer.js";
import { Preferences } from "./models/Preferences.js";
import { Order } from "./models/Order.js";

const user = new User("ramone123", "C001");
const preferences = new Preferences();

const customer = new Customer(
  user,
  preferences,
  "Ramone",
  "Student customer"
);

const order = new Order(1, "Ramone");

console.log("Before:", customer.ReadyForPickup());

customer.OrderReady("Chef John", "Ramone", order);

console.log("After:", customer.ReadyForPickup());

customer.ReadyForPickupReset();

console.log("Reset:", customer.ReadyForPickup());
