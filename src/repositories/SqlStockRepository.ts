import { pool } from '../config/db';
import { IStockRepository } from '../interfaces/IStockRepository';
import { SqlDatabaseM } from '../models/SqlDatabaseM';

function toModel(row: any): SqlDatabaseM {
  return {
    itemID: row.item_id,
    itemName: row.item_name,
    itemQuantity: Number(row.item_quantity), // numeric comes back as a string
    dateAdded: row.date_added,
    expiryDate: row.expiry_date,
    type: row.type,
  };
}

export class SqlStockRepository implements IStockRepository {
  async getItem(itemID: string) {
    const { rows } = await pool.query(
      'select * from "DatabaseM" where item_id = $1', [itemID]);
    return rows[0] ? toModel(rows[0]) : null;
  }

  async getAllItems() {
    const { rows } = await pool.query('select * from "DatabaseM" order by item_name');
    return rows.map(toModel);
  }

  async addItem(date: Date, itemID: string, itemName: string, quantity: number, type?: string) {
  await pool.query(
    'insert into "DatabaseM" (item_id, item_name, item_quantity, date_added, type) values ($1, $2, $3, $4, $5)',
    [itemID, itemName, quantity, date, type ?? null]);
}

  async removeItem(date: Date, itemID: string) {
    await pool.query('delete from "DatabaseM" where item_id = $1', [itemID]);
  }

  async updateItem(date: Date, itemID: string) {
  await pool.query(
    'update "DatabaseM" set date_added = $1 where item_id = $2',
    [date, itemID]);
 }

 async updateExpiryDate(date: Date, itemID: string) {
  await pool.query(
    'update "DatabaseM" set expiry_date = $1 where item_id = $2',
    [date, itemID]);
 } 
 async updateQuantity(itemID: string, newQuantity: number) {
  await pool.query(
    'update "DatabaseM" set item_quantity = $1 where item_id = $2',
    [newQuantity, itemID]);
}

async updateDates(itemID: string, dateAdded: Date, expiryDate: Date | null) {
  await pool.query(
    'update "DatabaseM" set date_added = $1, expiry_date = $2 where item_id = $3',
    [dateAdded, expiryDate, itemID]);
}
}