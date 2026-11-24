import { SqlDatabaseM } from '../models/SqlDatabaseM';
export interface IStockRepository {
  updateItem(date: Date, itemID: string): Promise<void>;
  removeItem(date: Date, itemID: string): Promise<void>;
  updateExpiryDate(date: Date, itemID: string): Promise<void>;
  updateQuantity(itemID: string, newQuantity: number): Promise<void>;
  updateDates(itemID: string, dateAdded: Date, expiryDate: Date | null): Promise<void>;
  addItem(date: Date, itemID: string, itemName: string, quantity: number, type?: string): Promise<void>;
  getItem(itemID: string): Promise<SqlDatabaseM | null>;
  getItemName(itemID: string): Promise<string | null>
  getAllItems(): Promise<SqlDatabaseM[]>;
}