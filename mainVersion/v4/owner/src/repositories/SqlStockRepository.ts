import { Pool } from 'pg';
import { IStockRepository } from '../interfaces/IStockRepository';
import { SqlDatabaseM } from '../models/SqlDatabaseM';

// config/postgres.ts makes pg return DATE columns as plain "YYYY-MM-DD" text, but the rest of the code
// (StockManagement, orders) works with Date objects and calls .getTime() on them. Turn the text into a Date
// at local midnight, so the day never shifts when it is shown again.
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(String(value));
}

function toModel(row: any): SqlDatabaseM {
  return {
    itemID: row.item_id,
    itemName: row.item_name,
    itemQuantity: Number(row.item_quantity), // numeric comes back as a string
    dateAdded: toDate(row.date_added) as Date,
    expiryDate: toDate(row.expiry_date),
    type: row.type,
  };
}

export class SqlStockRepository implements IStockRepository {
  constructor(private readonly pool: Pool) {}

  async getItem(itemID: string) {
    const { rows } = await this.pool.query(
      'select * from "DatabaseM" where item_id = $1', [itemID]);
    return rows[0] ? toModel(rows[0]) : null;
  }

  async getItemName(itemID: string){
    const { rows } = await this.pool.query(
      'select item_name from "DatabaseM" where item_id = $1', [itemID]);
    return rows[0] ?.item_name ?? null;
  }
  
  async getAllItems() {
    const { rows } = await this.pool.query(
      'select * from "DatabaseM" order by item_name');
    return rows.map(toModel);
  }

  async addItem(date: Date, itemID: string, itemName: string, quantity: number, type?: string) {
    await this.pool.query(
      'insert into "DatabaseM" (item_id, item_name, item_quantity, date_added, type) values ($1, $2, $3, $4, $5)',
      [itemID, itemName, quantity, date, type ?? null]);
  }

  async updateItem(date: Date, itemID: string) {
    await this.pool.query(
      'update "DatabaseM" set date_added = $1 where item_id = $2', [date, itemID]);
  }

  async updateExpiryDate(date: Date, itemID: string) {
    await this.pool.query(
      'update "DatabaseM" set expiry_date = $1 where item_id = $2', [date, itemID]);
  }

  async updateQuantity(itemID: string, newQuantity: number) {
    await this.pool.query(
      'update "DatabaseM" set item_quantity = $1 where item_id = $2', [newQuantity, itemID]);
  }

  async updateDates(itemID: string, dateAdded: Date, expiryDate: Date | null) {
    await this.pool.query(
      'update "DatabaseM" set date_added = $1, expiry_date = $2 where item_id = $3',
      [dateAdded, expiryDate, itemID]);
  }

  async removeItem(date: Date, itemID: string) {
    await this.pool.query('delete from "DatabaseM" where item_id = $1', [itemID]);
  }
}