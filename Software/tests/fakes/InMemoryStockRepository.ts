import { IStockRepository } from '../../owner/src/interfaces/IStockRepository';
import { SqlDatabaseM } from '../../owner/src/models/SqlDatabaseM';

/** In-memory stand-in for SqlStockRepository (the "DatabaseM" table). */
export class InMemoryStockRepository implements IStockRepository {
  readonly rows = new Map<string, SqlDatabaseM>();
  /** Set to make the next quantity update fail, to test undoing a half-finished order. */
  failUpdateFor: string | null = null;

  seed(itemID: string, itemName: string, itemQuantity: number, expiryDate: Date | null = new Date(Date.now() + 30 * 86_400_000)) {
    this.rows.set(itemID, { itemID, itemName, itemQuantity, dateAdded: new Date(), expiryDate, type: null });
    return this;
  }
  quantity(itemID: string) { return this.rows.get(itemID)!.itemQuantity; }

  async getItem(id: string) { const r = this.rows.get(id); return r ? { ...r } : null; }
  async getItemName(id: string) { return this.rows.get(id)?.itemName ?? null; }
  async getAllItems() { return [...this.rows.values()].map((r) => ({ ...r })); }
  async addItem(date: Date, itemID: string, itemName: string, quantity: number, type?: string) {
    this.rows.set(itemID, { itemID, itemName, itemQuantity: quantity, dateAdded: date, expiryDate: null, type: type ?? null });
  }
  async updateItem(date: Date, id: string) { this.rows.get(id)!.dateAdded = date; }
  async updateExpiryDate(date: Date, id: string) { this.rows.get(id)!.expiryDate = date; }
  async updateQuantity(id: string, q: number) {
    if (this.failUpdateFor === id) throw new Error('stock database unavailable');
    this.rows.get(id)!.itemQuantity = q;
  }
  async updateDates(id: string, added: Date, expiry: Date | null) { Object.assign(this.rows.get(id)!, { dateAdded: added, expiryDate: expiry }); }
  async removeItem(_d: Date, id: string) { this.rows.delete(id); }
}
