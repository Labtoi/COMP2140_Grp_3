import { chef } from "../models/accountsModels.js";
import { customer } from "../models/accountsModels.js";

export interface IChefRepo {
    GetAllCustomers(): Promise<customer[]>;
    GetAllChefs(): Promise<chef[]>;
    GetCustomerPassword(customerID: string): Promise<string>;
    GetChefPassword(chefID: string): Promise<string>;
    ChangeCustomerPassword(customerID: string, newPassword: string): Promise<void>;
    ChangeChefPassword(chefID: string, newPassword: string): Promise<void>;
    GetCustomerByID(customerID: string): Promise<customer>;
    GetChefByID(chefID: string): Promise<chef>;
    RemoveChef(chefID: string): Promise<void>;
    RemoveCustomer(customerID: string): Promise<void>;
    AddChef(chef: chef): Promise<void>;
}
