import { customer } from "../../../shared/src/models/accountsModels.js";

export interface ICustomerRepo {
    AddCustomer(customer: customer): Promise<void>;
    RemoveCustomer(customerID: string): Promise<void>;
    GetCustomerPassword(customerID: string): Promise<string>;
    FindCustomerPassword(customerID: string): Promise<string | null>;
    ChangeCustomerPassword(customerID: string, newPassword: string): Promise<void>;
    GetCustomerByID(customerID: string): Promise<customer>;
    EditCustomer(customerID: string, updatedCustomer: Partial<customer>): Promise<void>;
}