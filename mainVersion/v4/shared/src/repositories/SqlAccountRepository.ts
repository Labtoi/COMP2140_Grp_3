import { supabase } from "../config/supabase.js";
import { customer } from "../models/accountsModels.js";
import { chef } from "../models/accountsModels.js";
import { IChefRepo } from "../interfaces/IChefRepo.js";
import { ICustomerRepo } from "../../../customer/src/interfaces/ICustomerRepo.js";

export class SqlAccountRepository implements IChefRepo, ICustomerRepo {
    async AddCustomer(customer: customer): Promise<void> {
        const { error } = await supabase
        .from("Customer")
        .insert(customer);
        if (error) {
            throw new Error(`Failed to add customer: ${error.message}`);
        }
    }

    async RemoveCustomer(customerID: string): Promise<void> {
        const { error } = await supabase
        .from("Customer")
        .delete()
        .eq("customerID", customerID);
        if (error) {
            throw new Error(`Failed to remove customer: ${error.message}`);
        }
    }

    async GetCustomerPassword(customerID: string): Promise<string> {
        const { data, error } = await supabase
            .from("Customer")
            .select("customerPassword")
            .eq("customerID", customerID)
            .single();
        if (error) {
            throw new Error(`Failed to get customer password: ${error.message}`);
        }
        return data.customerPassword;
    }

    // Returns null when there is no such customer (unlike GetCustomerPassword, which throws).
    async FindCustomerPassword(customerID: string): Promise<string | null> {
        const { data, error } = await supabase
            .from("Customer")
            .select("customerPassword")
            .eq("customerID", customerID)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to look up customer: ${error.message}`);
        }
        return data ? data.customerPassword : null;
    }

    async ChangeCustomerPassword(customerID: string, newPassword: string): Promise<void> {
        const { error } = await supabase
            .from("Customer")
            .update({ customerPassword: newPassword })
            .eq("customerID", customerID);
        if (error) {
            throw new Error(`Failed to change customer password: ${error.message}`);
        }
    }

    async GetCustomerByID(customerID: string): Promise<customer> {
        const { data, error } = await supabase
            .from("Customer")
            .select("customerID, customerName, customerPreferences")
            .eq("customerID", customerID)
            .single();
        if (error) {
            throw new Error(`Failed to get customer by ID: ${error.message}`);
        }
        return data as customer;
    }

    async EditCustomer(customerID: string, updatedCustomer: Partial<customer>): Promise<void> {
        const { error } = await supabase
            .from("Customer")
            .update(updatedCustomer)
            .eq("customerID", customerID);
        if (error) {
            throw new Error(`Failed to edit customer: ${error.message}`);
        }
    }

    async GetAllCustomers(): Promise<customer[]> {
        const { data, error } = await supabase
            .from("Customer")
            .select("customerID, customerName, customerPreferences");
        if (error) {
            throw new Error(`Failed to get all customers: ${error.message}`);
        }
        return data as customer[];
    }

    async GetAllChefs(): Promise<chef[]> {
        const { data, error } = await supabase
            .from("Chef")
            .select("*");
        if (error) {
            throw new Error(`Failed to get all chefs: ${error.message}`);
        }
        return data as chef[];
    }

    async GetChefPassword(chefID: string): Promise<string> {
        const { data, error } = await supabase
            .from("Chef")
            .select("chefPassword")
            .eq("chefID", chefID)
            .single();
        if (error) {
            throw new Error(`Failed to get chef password: ${error.message}`);
        }
        return data.chefPassword;
    }

    async ChangeChefPassword(chefID: string, newPassword: string): Promise<void> {
        const { error } = await supabase
            .from("Chef")
            .update({ chefPassword: newPassword })
            .eq("chefID", chefID);
        if (error) {
            throw new Error(`Failed to change chef password: ${error.message}`);
        }
    }

    async GetChefByID(chefID: string): Promise<chef> {
        const { data, error } = await supabase
            .from("Chef")
            .select("*")
            .eq("chefID", chefID)
            .single();
        if (error) {
            throw new Error(`Failed to get chef by ID: ${error.message}`);
        }
        return data as chef;
    }

    async AddChef(chef: chef): Promise<void> {
        const { error } = await supabase
            .from("Chef")
            .insert(chef);
        if (error) {
            throw new Error(`Failed to add chef: ${error.message}`);
        }
    }

    async RemoveChef(chefID: string): Promise<void> {
        const { error } = await supabase
            .from("Chef")
            .delete()
            .eq("chefID", chefID);
        if (error) {
            throw new Error(`Failed to remove chef: ${error.message}`);
        }
    }
}
