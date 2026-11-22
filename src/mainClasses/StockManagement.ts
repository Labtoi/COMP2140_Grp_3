import { IStockRepository } from '../interfaces/IStockRepository';

export class StockManagement {
  constructor(private readonly _stockRepository: IStockRepository) {}

  // Add new stock, or add to an existing item and reset its dates
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

  // Days until expiry (negative = already expired, null = no expiry date)
  async expiryPeriodItem(itemID: string): Promise<number | null> {
    const item = await this._stockRepository.getItem(itemID);
    if (!item || !item.expiryDate) return null;
    return Math.ceil((item.expiryDate.getTime() - Date.now()) / 86_400_000);
  }

  // Items expiring within the next N days (7 is a placeholder)
  async expiryPeriod(withinDays = 7) {
    const items = await this._stockRepository.getAllItems();
    return items.filter(i => {
      if (!i.expiryDate) return false;
      const days = Math.ceil((i.expiryDate.getTime() - Date.now()) / 86_400_000);
      return days <= withinDays;
    });
  }

  // In stock and not expired
  async itemAvailabilityForMealPrep(itemID: string): Promise<boolean> {
    const item = await this._stockRepository.getItem(itemID);
    if (!item || item.itemQuantity <= 0) return false;
    return !item.expiryDate || item.expiryDate.getTime() >= Date.now();
  }

  // Subtract used quantity, refusing to go below zero
  async amountUsed(itemID: string, quantity: number) {
    const item = await this._stockRepository.getItem(itemID);
    if (!item) throw new Error(`Item ${itemID} not found`);
    if (quantity > item.itemQuantity) throw new Error('Not enough stock');
    await this._stockRepository.updateQuantity(itemID, item.itemQuantity - quantity);
  }
}