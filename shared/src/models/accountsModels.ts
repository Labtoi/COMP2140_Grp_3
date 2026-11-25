export interface chef {

    chefID: string;

    chefName: string;

    chefPassword: string;
}

export interface preferences {

    allergies: string[]
    
    foodPreferences: string[]
}

export interface customer {

    customerID: string;

    customerName: string;

    customerPassword: string;

    customerPreferences: preferences;
}