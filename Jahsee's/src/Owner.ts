import { createInterface } from 'readline/promises';
import pool from './config/postgres';
import { databaseAnalysisRepository } from './repositories/databaseAnalysisRepository';
import { StockAnalysis, ValidationError } from './mainClasses/StockAnalysis';

// same wiring as server.ts: the interface is satisfied by the database repository
const stock = new StockAnalysis(new databaseAnalysisRepository(pool));
const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = async (q: string) => (await rl.question(q)).trim();
const askNumber = async (q: string) => Number(await ask(q));

// typed like:  Jerk Chicken:1500, Curry Goat:1800
function parseItems(text: string) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, price] = s.split(':');
      return { name: name.trim(), price: Number(price) };
    });
}

async function addToDatabase() {
  while (true) {
    const analysis = {
      id: await ask('ID: '),
      date: await ask('Date (YYYY-MM-DD): '),
      revenue: await askNumber('Revenue: '),
      totalSold: await askNumber('Total sold: '),
      meals: parseItems(await ask('Meals (name:price, name:price): ')),
      sides: parseItems(await ask('Sides (name:price, name:price): ')),
      mealsSold: await askNumber('Meals sold: '),
      sidesSold: await askNumber('Sides sold: '),
    };
    try {
      await stock.add(analysis);
      console.log('Saved.\n');
      return;
    } catch (e) {
      if (e instanceof ValidationError) console.log(`Not saved: ${e.message}. Try again.\n`);
      else throw e;
    }
  }
}

async function main() {
  while (true) {
    const choice = await ask('1) Add  2) List  3) Remove  4) Quit > ');
    if (choice === '1') await addToDatabase();
    else if (choice === '2') console.table(await stock.getAll());
    else if (choice === '3') {
      console.log('Existing IDs:', (await stock.getAllIds()).join(', '));
      await stock.remove(await ask('ID to remove: '));
    } else if (choice === '4') break;
  }
  rl.close();
  await pool.end();
}

main();