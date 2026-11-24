//Also for testing purposes
import { CustomerService } from "./src/services test/customerservice.js";

const customerService = new CustomerService();

async function main() {
    const newCustomer = {
        customerID: "4",
        customerName: "John Database",
        customerPassword: "pas8witapush",
        customerPreferences: {
            allergies: ["dih", "peanuts"],
            foodPreferences: ["MEAT", "gluten-free"]
        }
    };
    await customerService.addCustomer(newCustomer);
}
main();