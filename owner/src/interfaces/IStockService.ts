import { SqlDatabaseM } from '../models/SqlDatabaseM';

export interface IStockService {
  restockItem(itemID: string, itemName: string, quantity: number, expiryDate: Date): Promise<void>;
  expiryPeriod(withinDays?: number): Promise<SqlDatabaseM[]>;
  expiryPeriodItem(itemID: string): Promise<number | null>;
  itemAvailabilityForMealPrep(itemID: string): Promise<boolean>;
  amountUsed(itemID: string, quantity: number): Promise<void>;
  getAllItems(): Promise<SqlDatabaseM[]>;
  getItem(itemID: string): Promise<SqlDatabaseM | null>;
  getItemName(itemID: string): Promise<string |null>
  removeItem(itemID: string): Promise<void>;
}