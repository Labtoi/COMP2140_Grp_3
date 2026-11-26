import { IStockRepository } from '../interfaces/IStockRepository';
import { IStockService } from '../interfaces/IStockService';
import { SqlDatabaseM } from '../models/SqlDatabaseM';

// Thrown when a request breaks a stock rule (routes return 400).
export class StockValidationError extends Error {}

// Stock rules for "DatabaseM"; all database access goes through IStockRepository.
export class StockManagement implements IStockService {
  constructor(private readonly _stockRepository: IStockRepository) {}

  // Adds a delivery: new items are created, existing ones get the quantity added. Dates are reset.
  async restockItem(itemID: string, itemName: string, quantity: number, expiryDate: Date) {
    const today = new Date();
    const existing = await this._stockRepository.getItem(itemID);
    if (!existing) {
      await this._stockRepository.addItem(today, itemID, itemName, quantity);
    } else {
      await this._stockRepository.updateQuantity(itemID, existing.itemQuantity + quantity);
    }
    await this._stockRepository.updateDates(itemID, today, expiryDate);
  }

  // Days until an item expires (rounded up; <= 0 means expired), or null if unknown or no expiry.
  async expiryPeriodItem(itemID: string): Promise<number | null> {
    const item = await this._stockRepository.getItem(itemID);
    if (!item || !item.expiryDate) return null;
    return Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86_400_000);
  }

  // Items expiring within `withinDays` days, including already expired ones.
  async expiryPeriod(withinDays = 7): Promise<SqlDatabaseM[]> {
    const items = await this._stockRepository.getAllItems();
    return items.filter(i => {
      if (!i.expiryDate) return false;
      const days = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / 86_400_000);
      return days <= withinDays;
    });
  }

  // True if the item exists, has stock left and is not expired.
  async itemAvailabilityForMealPrep(itemID: string): Promise<boolean> {
    const item = await this._stockRepository.getItem(itemID);
    if (!item || item.itemQuantity <= 0) return false;
    return !item.expiryDate || new Date(item.expiryDate).getTime() >= Date.now();
  }

  // Deducts used stock; throws if missing or insufficient. A negative amount returns stock.
  async amountUsed(itemID: string, quantity: number) {
    const item = await this._stockRepository.getItem(itemID);
    if (!item) throw new StockValidationError(`Item ${itemID} not found`);
    if (quantity > item.itemQuantity) throw new StockValidationError('Not enough stock');
    await this._stockRepository.updateQuantity(itemID, item.itemQuantity - quantity);
  }


  // Pass-throughs for the routes.
  async getAllItems(): Promise<SqlDatabaseM[]> {
    return this._stockRepository.getAllItems();
  }

  async getItem(itemID: string): Promise<SqlDatabaseM | null> {
    return this._stockRepository.getItem(itemID);
  }

  async getItemName(itemID: string): Promise<string | null>{
    return this._stockRepository.getItemName(itemID);
  }

  async removeItem(itemID: string): Promise<void> {
    await this._stockRepository.removeItem(new Date(), itemID);
  }
}