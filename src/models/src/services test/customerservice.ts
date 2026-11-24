//For testing purposes

import { SqlAccountRepository } from "../repositories/SqlAccountRepository.js";
import { customer } from "../models/customer.js";

export class CustomerService {
    private accountRepository: SqlAccountRepository;
    constructor() {
        this.accountRepository = new SqlAccountRepository();
    }

    async addCustomer(customer: customer): Promise<void> {
        await this.accountRepository.AddCustomer(customer);
    }
}
