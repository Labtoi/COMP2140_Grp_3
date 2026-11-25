import { InMemoryMsRepository } from '../fakes/InMemoryMsRepository';
import { InMemoryStockRepository } from '../fakes/InMemoryStockRepository';
import { InMemoryAnalysisRepo } from '../fakes/InMemoryAnalysisRepo';
import { StockManagement } from '../../owner/src/mainClasses/StockManagement';
import { StockAnalysis } from '../../owner/src/mainClasses/StockAnalysis';
import { NutritionInformation } from '../../shared/src/mainClasses/NutritionInformation';
import { OrderProcessing, type OrderCustomer } from '../../shared/src/mainClasses/OrderProcessing';
import type { Dish } from '../../shared/src/models/Dish';

const dish = (name: string, price: number, allergens: Dish['allergens'] = []): Dish => ({
  name, details: `${name} details`, price, calories: 300, carbohydrates: 30, protein: 20, sodium: 400, fats: 10, vitamins: 2,
  allergens, prepList: [],
});

/**
 * A small kitchen: the real StockManagement, StockAnalysis, NutritionInformation and OrderProcessing
 * on in-memory databases (the real classes are what is being tested; only the databases are fakes).
 *
 *   Classic Burger  (gluten, dairy)  $12.50  Beef Patty 150, Brioche Bun 1, Onion 20
 *   Garden Salad                     $9.00   Romaine 150, Onion 30
 *   Fries (side)                     $4.00   Potatoes 300
 *   Water (side)                     $1.00   no recipe
 */
export async function makeKitchen() {
  const menu = new InMemoryMsRepository();
  const stockDb = new InMemoryStockRepository();
  const analysisDb = new InMemoryAnalysisRepo();

  await menu.addMeal(dish('Classic Burger', 12.5, ['gluten', 'dairy']));
  await menu.addMeal(dish('Garden Salad', 9));
  await menu.addSide(dish('Fries', 4));
  await menu.addSide(dish('Water', 1));
  const recipe = async (owner: { meal: string } | { side: string }, itemName: string, itemQuantity: number, steps = `Prepare ${itemName}`) =>
    menu.addPrep(owner, { itemName, type: 'ingredient', itemQuantity, steps });
  await recipe({ meal: 'Classic Burger' }, 'Beef Patty', 150, 'Grill 4 minutes per side');
  await recipe({ meal: 'Classic Burger' }, 'Brioche Bun', 1);
  await recipe({ meal: 'Classic Burger' }, 'Onion', 20);
  await recipe({ meal: 'Garden Salad' }, 'Romaine', 150);
  await recipe({ meal: 'Garden Salad' }, 'Onion', 30);
  await recipe({ side: 'Fries' }, 'Potatoes', 300);

  stockDb.seed('S1', 'Beef Patty', 1000).seed('S2', 'Brioche Bun', 20).seed('S3', 'Onion', 500)
    .seed('S4', 'Romaine', 1000).seed('S5', 'Potatoes', 3000);

  const stock = new StockManagement(stockDb);
  const analysis = new StockAnalysis(analysisDb);
  const nutrition = new NutritionInformation(menu);
  const orders = new OrderProcessing({ menu, prepRepo: menu, stock, analysis, nutrition });
  const ana: OrderCustomer = { customerID: 'ana', customerName: 'Ana', allergies: [] };
  const ben: OrderCustomer = { customerID: 'ben', customerName: 'Ben', allergies: [] };
  return { menu, stockDb, analysisDb, stock, analysis, nutrition, orders, ana, ben };
}

export type Kitchen = Awaited<ReturnType<typeof makeKitchen>>;
export const burger = (quantity = 1) => ({ kind: 'meal' as const, name: 'Classic Burger', quantity });
export const salad = (quantity = 1) => ({ kind: 'meal' as const, name: 'Garden Salad', quantity });
export const fries = (quantity = 1) => ({ kind: 'side' as const, name: 'Fries', quantity });
export const water = (quantity = 1) => ({ kind: 'side' as const, name: 'Water', quantity });
