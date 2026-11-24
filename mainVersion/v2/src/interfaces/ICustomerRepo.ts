import { customer } from "../models/accountsModels.js";

export interface ICustomerRepo {
    AddCustomer(customer: customer): Promise<void>;
    RemoveCustomer(customerID: string): Promise<void>;
    GetCustomerPassword(customerID: string): Promise<string>;
    ChangeCustomerPassword(customerID: string, newPassword: string): Promise<void>;
    GetCustomerByID(customerID: string): Promise<customer>;
    EditCustomer(customerID: string, updatedCustomer: customer): Promise<void>;
}