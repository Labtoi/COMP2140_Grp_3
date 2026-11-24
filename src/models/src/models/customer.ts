import { preferences } from "./preferences.js";

export interface customer {

    customerID: string;

    customerName: string;

    customerPassword: string;

    customerPreferences: preferences;
}