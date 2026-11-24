import { chef } from "../models/chef.js";
import { customer } from "../models/customer.js";

export interface IChefRepo {
    GetAllCustomers(): Promise<customer[]>;
    GetAllChefs(): Promise<chef[]>;
    GetCustomerPassword(customerID: string): Promise<string>;
    GetChefPassword(chefID: string): Promise<string>;
    ChangeCustomerPassword(customerID: string, newPassword: string): Promise<void>;
    ChangeChefPassword(chefID: string, newPassword: string): Promise<void>;
    GetChefByID(chefID: string): Promise<chef>;
    RemoveCustomer(customerID: string): Promise<void>;
    AddChef(chef: chef): Promise<void>;
}
