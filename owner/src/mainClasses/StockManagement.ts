import { IStockRepository } from '../interfaces/IStockRepository';
import { IStockService } from '../interfaces/IStockService';
import { SqlDatabaseM } from '../models/SqlDatabaseM';

// Thrown when a request breaks a stock rule; the routes turn it into a 400
export class StockValidationError extends Error {}

export class StockManagement implements IStockService {
  constructor(private readonly _stockRepository: IStockRepository) {}

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

  async expiryPeriodItem(itemID: string): Promise<number | null> {
    const item = await this._stockRepository.getItem(itemID);
    if (!item || !item.expiryDate) return null;
    return Math.ceil((item.expiryDate.getTime() - Date.now()) / 86_400_000);
  }

  async expiryPeriod(withinDays = 7): Promise<SqlDatabaseM[]> {
    const items = await this._stockRepository.getAllItems();
    return items.filter(i => {
      if (!i.expiryDate) return false;
      const days = Math.ceil((i.expiryDate.getTime() - Date.now()) / 86_400_000);
      return days <= withinDays;
    });
  }

  async itemAvailabilityForMealPrep(itemID: string): Promise<boolean> {
    const item = await this._stockRepository.getItem(itemID);
    if (!item || item.itemQuantity <= 0) return false;
    return !item.expiryDate || item.expiryDate.getTime() >= Date.now();
  }

  async amountUsed(itemID: string, quantity: number) {
    const item = await this._stockRepository.getItem(itemID);
    if (!item) throw new StockValidationError(`Item ${itemID} not found`);
    if (quantity > item.itemQuantity) throw new StockValidationError('Not enough stock');
    await this._stockRepository.updateQuantity(itemID, item.itemQuantity - quantity);
  }

  // Pass-throughs for the routes
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