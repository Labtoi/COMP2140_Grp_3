import { createInterface } from 'readline/promises';
import pool from './config/postgres';
import { databaseAnalysisRepository } from './repositories/databaseAnalysisRepository';
import { StockAnalysis, ValidationError } from './mainClasses/StockAnalysis';
import { Analysis } from './models/Analysis';

// same wiring as server.ts: the interface is satisfied by the database repository
const stock = new StockAnalysis(new databaseAnalysisRepository(pool));
const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = async (q: string) => (await rl.question(q)).trim();
const askNumber = async (q: string) => Number(await ask(q));
const pause = () => ask('\nPress Enter to continue...');


// typed like:  Jerk Chicken:1500:8, Curry Goat:1800:4
function parseItems(text: string) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [name, price, quantity] = s.split(':');
      return { name: name.trim(), price: Number(price), quantity: Number(quantity) };
    });
}

async function addToDatabase() {
  while (true) {
    
    let id = await ask('ID: ');
    while (await stock.idExists(id)) {
      console.log(`ID "${id}" already exists. Please enter a different ID.`);
      id = await ask('ID: ');
    }

    const draft = {
      id,
      date: new Date().toLocaleString('sv-SE'),
      meals: parseItems(await ask('Meals (name:price:qty, ...): ')),
      sides: parseItems(await ask('Sides (name:price:qty, ...): ')),
    };
    try {
      const saved = await stock.addFromItems(draft);
      console.log(`Saved. Total sold: ${saved.totalSold}, revenue: ${saved.revenue}\n`);
      return;
    } catch (e) {
      if (e instanceof ValidationError) console.log(`Not saved: ${e.message}. Try again.\n`);
      else throw e;
    }
  }
}

const formatItems = (items: { name: string; price: number; quantity?: number }[]) =>
  items.map((i) => `    ${i.name} ($${i.price} x ${i.quantity ?? '?'}) = $${(i.price * (i.quantity ?? 0))}`).join('\n');

async function listSpecific(analysis: Analysis[]) {
  if (analysis.length === 0) {
    console.log('No entries yet.\n');
    return;
  }

  for (const a of analysis) {
    console.log('\n----------------------------------------');
    console.log(`ID: ${a.id}     Date: ${a.date}`);
    console.log('\n------');
    console.log('Meals:');
    console.log(formatItems(a.meals));
    console.log('Sides:');
    console.log(formatItems(a.sides));
    console.log('------\n');
    console.log(`Sold: ${a.mealsSold} meals + ${a.sidesSold} sides = ${a.totalSold}`);
    console.log(`Revenue: $${a.revenue}`);
    console.log('------------');
  }
  console.log('\n----------------------------------------\n');
}

async function listAll() {
  const all = await stock.getAll();
  await listSpecific(all);
}

async function showPopular() {
  const range = {
    start: await ask('Start date (YYYY-MM-DD): '),
    end: await ask('End date (YYYY-MM-DD): '),
  };
  while (true) {
    try {
      console.log('\n--------------------------------');
      const choice = await askNumber(`1)Most Popular Meals  2)Least Popular Meals  3)Most Popular Sides  4)Least Popular Sides 5)Exit> `);
      if (choice === 1) {
        const report = await stock.mostPopularMeals(range);
        if (report.length === 0) return console.log('No meals sold in that range.\n');
        console.log('\nTop meals:');
        report.forEach((m, i) => console.log(`  ${i + 1}. ${m.name} - ${m.quantitySold} sold`));
      }
      else if (choice === 2) {
        const report = await stock.leastPopularMeals(range);
        if (report.length === 0) return console.log('No meals sold in that range.\n');
        console.log('\nLeast popular meals:');
        report.forEach((m, i) => console.log(`  ${i + 1}. ${m.name} - ${m.quantitySold} sold`));
      }
      else if (choice === 3) {
        const report = await stock.mostPopularSides(range);
        if (report.length === 0) return console.log('No sides sold in that range.\n');
        console.log('\nTop sides:');
        report.forEach((m, i) => console.log(`  ${i + 1}. ${m.name} - ${m.quantitySold} sold`));
      }
      else if (choice === 4) {
        const report = await stock.leastPopularSides(range);
        if (report.length === 0) return console.log('No sides sold in that range.\n');
        console.log('\nLeast popular sides:');
        report.forEach((m, i) => console.log(`  ${i + 1}. ${m.name} - ${m.quantitySold} sold`));
      }
      else if (choice === 5) return;
    } catch (e) {
      if (e instanceof ValidationError) console.log(`Not shown: ${e.message}\n`);
      else throw e;
    }
  }
}

async function totalSales() {
  const range = {
    start: await ask('Start date (YYYY-MM-DD): '),
    end: await ask('End date (YYYY-MM-DD): '),
  };
  try{
    const totalMeals = await stock.totalMealsSold(range);
    const totalSides = await stock.totalSidesSold(range);
    const totalRevenue = await stock.getTotalRevenue(range);
    console.log(`\nTotal meals sold: ${totalMeals}`);
    console.log(`Total sides sold: ${totalSides}`);
    console.log(`Total revenue: $${totalRevenue}`);
  }
  catch (e) {
    if (e instanceof ValidationError) console.log(`Not shown: ${e.message}\n`);
    else throw e;
  }
}
async function main() {
  while (true) {
    console.clear();
    console.log('\nTesting purposes only "1" !')
    const choice = await ask('1)Add  2)List  3)Get Specific Analysis  4)showPopular 5)totalSales  6)Remove  7)Quit > ');
    
    if (choice === '1') {await addToDatabase(); await pause();}
        
    else if (choice === '2') {await listAll(); await pause();}

    else if (choice === '3') {
      console.log('Existing IDs:', (await stock.getAllIds()).join(', '));
      const id = await ask('ID to view: ');
      if (await stock.idExists(id)) {
        const specific = await stock.getById(id);
        await listSpecific(specific ? [specific] : []);
        await pause();
      }else{
        console.log('ID not found. Nothing to show.'); await pause();
      }      
    }
    else if (choice === '4') {
      await showPopular();
      await pause();
    }
    else if (choice === '5') {
      await totalSales();
      await pause();
    }
    else if (choice === '6') {
      console.log('Existing IDs:', (await stock.getAllIds()).join(', '));
      const id = await ask('ID to remove: ');
      if (await stock.idExists(id)) {
        await stock.remove(id); await pause();
      } else {
        console.log('ID not found. Nothing removed.'); await pause();
      }
    } else if (choice === '7') break;
  }
  rl.close();
  await pool.end();
}
 
main();