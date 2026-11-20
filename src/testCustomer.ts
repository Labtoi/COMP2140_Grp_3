
import { User } from "./models/User.js";
import { Customer } from "./models/Customer.js";
import { Preferences } from "./models/Preferences.js";

const user = new User("ramone123", "C001");

const preferences = new Preferences(
  ["Peanuts"],
  ["No pepper"]
);

const customer = new Customer(
  user,
  preferences,
  "Ramone",
  "Student customer"
);

console.log("Name:", customer.getName());
console.log("Real name:", customer.realName);
console.log("Allergies:", customer.getAllergies());
console.log("Preferences:", customer.getPreferences());
