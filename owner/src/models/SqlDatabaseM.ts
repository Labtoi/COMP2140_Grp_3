export interface SqlDatabaseM {
  itemID: string;
  itemName: string;
  itemQuantity: number;
  dateAdded: Date;
  expiryDate: Date | null;
  type: string | null;
}